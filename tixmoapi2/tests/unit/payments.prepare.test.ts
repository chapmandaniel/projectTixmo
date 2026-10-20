// Mock-only provider and transactional store. No environment, DB or Stripe transport.
jest.mock('stripe', () =>
  jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() } }))
);
jest.mock('../../src/config/environment', () => ({
  config: { stripeSecretKey: 'mock-only', paymentCurrency: 'cad', nodeEnv: 'test' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: { $transaction: jest.fn() },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    confirmOrderInTransaction: jest.fn(),
    cancelOrderInTransaction: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn() },
}));
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentService } from '../../src/api/payments/service';
import prisma from '../../src/config/prisma';

let service: PaymentService, stripe: any, order: any, attempt: any, intents: Map<string, any>;
let loseResponse: boolean, failLink: boolean, duringCreate: (() => void) | undefined;
const tx = {
  $queryRaw: jest.fn(),
  order: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
  paymentAttempt: { upsert: jest.fn(), update: jest.fn() },
};
beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  (Stripe as unknown as jest.Mock).mockImplementation(() => ({
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  }));
  service = new PaymentService();
  stripe = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  order = {
    id: 'order-a',
    userId: 'buyer-a',
    orderNumber: 'A',
    totalAmount: new Decimal(12),
    currency: 'cad',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentIntentId: null,
    expiresAt: new Date(Date.now() + 600_000),
    createdAt: new Date(),
    event: { status: 'ON_SALE', deletedAt: null },
  };
  attempt = null;
  intents = new Map();
  loseResponse = false;
  failLink = false;
  duringCreate = undefined;
  tx.order.findUnique.mockImplementation(async ({ where }) =>
    where.id === order.id ? { ...order } : null
  );
  tx.order.findUniqueOrThrow.mockImplementation(async () => ({ ...order }));
  tx.order.update.mockImplementation(async ({ data }) => {
    Object.assign(order, data);
    return { ...order };
  });
  tx.paymentAttempt.upsert.mockImplementation(async ({ create }) => {
    if (!attempt) attempt = { id: 'attempt-a', createdAt: new Date(), ...create };
    return { ...attempt };
  });
  tx.paymentAttempt.update.mockImplementation(async ({ data }) => {
    if (failLink) {
      failLink = false;
      throw new Error('DB unavailable');
    }
    Object.assign(attempt, data);
    return { ...attempt };
  });
  // Serialize the in-memory store like the real per-order lock, and roll back
  // attempted local writes when the transaction rejects.
  let tail = Promise.resolve();
  (prisma.$transaction as jest.Mock).mockImplementation(async (work) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const beforeOrder = { ...order },
      beforeAttempt = attempt ? { ...attempt } : null;
    try {
      return await work(tx);
    } catch (error) {
      order = beforeOrder;
      attempt = beforeAttempt;
      throw error;
    } finally {
      release();
    }
  });
  stripe.paymentIntents.create.mockImplementation(async (params: any, opts: any) => {
    const previous = intents.get(opts.idempotencyKey);
    if (
      previous &&
      (previous.amount !== params.amount ||
        previous.currency !== params.currency ||
        JSON.stringify(previous.metadata) !== JSON.stringify(params.metadata))
    ) {
      throw new Error('Stripe idempotency parameter conflict');
    }
    const intent = previous || {
      ...params,
      metadata: { ...params.metadata },
      id: 'pi-one',
      status: 'requires_payment_method',
      client_secret: 'mock-client-secret',
    };
    intents.set(opts.idempotencyKey, intent);
    duringCreate?.();
    duringCreate = undefined;
    if (loseResponse) {
      loseResponse = false;
      throw new Error('lost response');
    }
    return { ...intent, metadata: { ...intent.metadata } };
  });
  stripe.paymentIntents.retrieve.mockImplementation(async (id: string) => {
    const intent = [...intents.values()].find((value) => value.id === id);
    return intent ? { ...intent, metadata: { ...intent.metadata } } : undefined;
  });
});
const prepare = () => service.createPaymentIntent('order-a', 'buyer-a');

test('sequential retries reuse the durable attempt and same provider intent', async () => {
  const first = await prepare();
  expect(await prepare()).toEqual(first);
  expect(attempt).toMatchObject({
    id: 'attempt-a',
    orderId: 'order-a',
    amount: 1200,
    currency: 'cad',
    paymentIntentId: 'pi-one',
  });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi-one');
  await expect(service.createPaymentIntent('order-a', 'other-buyer')).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
});
test('concurrent preparation converges on one immutable provider operation', async () => {
  const results = await Promise.all([prepare(), prepare(), prepare()]);
  expect(new Set(results.map((result) => result.paymentIntentId))).toEqual(new Set(['pi-one']));
  expect(intents.size).toBe(1);
  expect(order.paymentIntentId).toBe('pi-one');
  expect(
    stripe.paymentIntents.create.mock.calls.every(
      (call: any) =>
        call[1].idempotencyKey === 'payment-attempt-a' && call[0].metadata.attemptId === 'attempt-a'
    )
  ).toBe(true);
});
test('lost provider response retains the committed attempt and retries the same identity', async () => {
  loseResponse = true;
  await expect(prepare()).rejects.toThrow('lost response');
  expect(order.paymentIntentId).toBeNull();
  expect(attempt).toMatchObject({ id: 'attempt-a', amount: 1200, paymentIntentId: null });
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(intents.size).toBe(1);
  expect(
    new Set(stripe.paymentIntents.create.mock.calls.map((call: any) => call[1].idempotencyKey))
  ).toEqual(new Set(['payment-attempt-a']));
});
test('DB linkage failure rolls back locally then retries without another provider intent', async () => {
  failLink = true;
  await expect(prepare()).rejects.toThrow('DB unavailable');
  expect(order.paymentIntentId).toBeNull();
  expect(attempt.paymentIntentId).toBeNull();
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(intents.size).toBe(1);
});
test.each(['amount', 'currency', 'orderId', 'userId'])(
  'provider %s mismatch rejects without relinking or replacement',
  async (field) => {
    await prepare();
    const before = { ...order };
    tx.order.update.mockClear();
    tx.paymentAttempt.update.mockClear();
    const intent = [...intents.values()][0];
    if (field === 'amount') intent.amount++;
    else if (field === 'currency') intent.currency = 'usd';
    else intent.metadata[field] = 'other';
    await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.paymentAttempt.update).not.toHaveBeenCalled();
    expect(order).toEqual(before);
  }
);
test.each(['processing', 'succeeded', 'canceled'])(
  'stored %s intent reconciles and never yields a new client session',
  async (status) => {
    await prepare();
    [...intents.values()][0].status = status;
    const reconcile = jest.spyOn(service as any, 'reconcileIntent').mockResolvedValue(undefined);
    await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(intents.size).toBe(1);
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ id: 'pi-one', status }));
  }
);
test('expired provider idempotency guarantee rejects an unlinked attempt', async () => {
  loseResponse = true;
  await expect(prepare()).rejects.toThrow('lost response');
  attempt.createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  stripe.paymentIntents.create.mockClear();
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
});
test.each(['expired', 'paid', 'succeeded', 'cancelled-event'])(
  '%s reservation rejects before provider I/O',
  async (change) => {
    if (change === 'expired') order.expiresAt = new Date(Date.now() - 1);
    if (change === 'paid') order.status = 'PAID';
    if (change === 'succeeded') order.paymentStatus = 'SUCCEEDED';
    if (change === 'cancelled-event') order.event.status = 'CANCELLED';
    await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  }
);
test.each([
  'paid',
  'canceled',
  'different-intent',
  'amount',
  'currency',
  'succeeded',
  'failed',
  'expired',
])('async %s change never yields a usable client session', async (change) => {
  const reconcile = jest.spyOn(service as any, 'reconcileIntent').mockResolvedValue(undefined);
  duringCreate = () => {
    if (change === 'paid') {
      order.status = 'PAID';
      order.paymentStatus = 'SUCCEEDED';
    }
    if (change === 'canceled') order.status = 'CANCELLED';
    if (change === 'different-intent') order.paymentIntentId = 'pi-other';
    if (change === 'amount') order.totalAmount = new Decimal(99);
    if (change === 'currency') order.currency = 'usd';
    if (change === 'succeeded') order.paymentStatus = 'SUCCEEDED';
    if (change === 'failed') order.paymentStatus = 'FAILED';
    if (change === 'expired') order.expiresAt = new Date(Date.now() - 1);
  };
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(intents.size).toBe(1);
  if (change === 'different-intent') expect(order.paymentIntentId).toBe('pi-other');
  if (['paid', 'succeeded'].includes(change)) expect(order.paymentStatus).toBe('SUCCEEDED');
  if (change === 'failed') expect(order.paymentStatus).toBe('FAILED');
  if (change === 'canceled' || change === 'expired') expect(reconcile).toHaveBeenCalled();
});
test('an explicit retry of an already failed pending payment reuses its existing operation', async () => {
  await prepare();
  order.paymentStatus = 'FAILED';
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(order.paymentStatus).toBe('PROCESSING');
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  expect(intents.size).toBe(1);
});
test('changed amount after lost response requires reconciliation while attempt remains immutable', async () => {
  loseResponse = true;
  await expect(prepare()).rejects.toThrow('lost response');
  order.totalAmount = new Decimal(99);
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(intents.size).toBe(1);
  expect(attempt.amount).toBe(1200);
  expect(order.paymentIntentId).toBeNull();
});
