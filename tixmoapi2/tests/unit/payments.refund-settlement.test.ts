// Exercise the real refund reconciler with in-memory persistence and transport.
// This suite must also run without the integration database setup.
jest.mock('stripe', () => jest.fn());
jest.mock('../../src/config/environment', () => ({
  config: { nodeEnv: 'test', stripeSecretKey: 'synthetic-transport-only' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    paymentRefund: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentRefundLine: { upsert: jest.fn().mockResolvedValue({}) },
    order: { updateMany: jest.fn() },
  },
}));
jest.mock('../../src/services/order-inventory.service', () => ({ lockOrder: jest.fn() }));
jest.mock('../../src/api/orders/service', () => ({
  orderService: { finalizeRefund: jest.fn() },
}));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));

import Stripe from 'stripe';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';

const db = prisma as any;
const finalizeRefund = orderService.finalizeRefund as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let record: any;
let order: any;
let provider: any;
let reconcile: () => Promise<void>;

const response = (status: string) => ({
  id: 're_settlement',
  payment_intent: 'pi_settlement',
  amount: 1200,
  currency: 'cad',
  metadata: { refundId: 'refund_settlement' },
  status,
  failure_reason: status === 'failed' ? 'synthetic-provider-failure' : null,
});

beforeEach(() => {
  jest.resetAllMocks();
  record = {
    id: 'refund_settlement',
    orderId: 'order_settlement',
    paymentIntentId: 'pi_settlement',
    stripeRefundId: 're_settlement',
    amount: 1200,
    currency: 'cad',
    reason: 'ORDER_REFUND',
    status: 'PROCESSING',
    errorMessage: null,
    createdAt: new Date(),
  };
  order = {
    id: record.orderId,
    paymentIntentId: record.paymentIntentId,
    status: 'PAID',
    refundStatus: 'PROCESSING',
    paymentStatus: 'SUCCEEDED',
    paymentClosedAt: null,
  };
  const matches = (where: Record<string, any>, row: Record<string, any>) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === 'object' && 'not' in value
        ? row[key] !== value.not
        : row[key] === value
    );
  db.paymentRefund.findUniqueOrThrow.mockImplementation(() => Promise.resolve({ ...record }));
  db.paymentRefund.update.mockImplementation(({ data }: any) => {
    Object.assign(record, data);
    return Promise.resolve({ ...record });
  });
  // A conditional write checks the CURRENT durable row, not a worker's snapshot.
  db.paymentRefund.updateMany.mockImplementation(({ where, data }: any) => {
    if (!matches(where, record)) return Promise.resolve({ count: 0 });
    Object.assign(record, data);
    return Promise.resolve({ count: 1 });
  });
  db.order.updateMany.mockImplementation(({ where, data }: any) => {
    if (!matches(where, order)) return Promise.resolve({ count: 0 });
    Object.assign(order, data);
    return Promise.resolve({ count: 1 });
  });
  finalizeRefund.mockImplementation(() => {
    order.status = 'REFUNDED';
    order.refundStatus = 'SUCCEEDED';
    order.paymentStatus = 'REFUNDED';
    return Promise.resolve({ ...order });
  });
  provider = {
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: record.paymentIntentId,
        status: 'succeeded',
        amount_received: 1200,
        currency: 'cad',
      }),
    },
    refunds: {
      retrieve: jest.fn().mockResolvedValue(response('succeeded')),
      list: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue(response('succeeded')),
    },
  };
  (Stripe as unknown as jest.Mock).mockImplementation(() => provider);
  const service = new PaymentService() as unknown as {
    reconcileRefund: (id: string) => Promise<void>;
  };
  reconcile = () => service.reconcileRefund(record.id);
});

describe.each(['ORDER_REFUND', 'UNEXPECTED_PAYMENT'])('settlement for %s', (reason) => {
  test.each(['pending', 'failed', 'canceled'])(
    'a delayed %s response cannot overwrite another worker success',
    async (status) => {
      record.reason = reason;
      if (reason !== 'ORDER_REFUND') order.status = 'CANCELLED';
      const staleResponse = deferred<ReturnType<typeof response>>();
      const staleRequestStarted = deferred<void>();
      provider.refunds.retrieve
        .mockImplementationOnce(() => {
          staleRequestStarted.resolve();
          return staleResponse.promise;
        })
        .mockResolvedValueOnce(response('succeeded'));

      const staleWorker = reconcile();
      try {
        await staleRequestStarted.promise;
        await reconcile();
        expect(record.status).toBe('SUCCEEDED');
        staleResponse.resolve(response(status));
        await staleWorker;

        expect(record.status).toBe('SUCCEEDED');
        expect(record.errorMessage).toBeNull();
        if (reason === 'ORDER_REFUND') {
          expect(order.status).toBe('REFUNDED');
          expect(order.refundStatus).toBe('SUCCEEDED');
          expect(order.paymentStatus).toBe('REFUNDED');
        } else {
          expect(order.status).toBe('CANCELLED');
          expect(order.paymentStatus).toBe('SUCCEEDED');
          expect(order.paymentClosedAt).toBeInstanceOf(Date);
          expect(finalizeRefund).not.toHaveBeenCalled();
        }
        expect(provider.refunds.create).not.toHaveBeenCalled();
      } finally {
        staleResponse.resolve(response(status));
        await staleWorker;
      }
    }
  );
});

test('the delayed worker can finish an order after successful settlement but failed finalization', async () => {
  const staleResponse = deferred<ReturnType<typeof response>>();
  const staleRequestStarted = deferred<void>();
  provider.refunds.retrieve
    .mockImplementationOnce(() => {
      staleRequestStarted.resolve();
      return staleResponse.promise;
    })
    .mockResolvedValueOnce(response('succeeded'));
  finalizeRefund.mockRejectedValueOnce(new Error('synthetic finalization interruption'));

  const staleWorker = reconcile();
  try {
    await staleRequestStarted.promise;
    await expect(reconcile()).rejects.toThrow('synthetic finalization interruption');
    expect(record.status).toBe('SUCCEEDED');
    expect(order.status).toBe('PAID');
    staleResponse.resolve(response('pending'));
    await staleWorker;
    expect(record.status).toBe('SUCCEEDED');
    expect(order.status).toBe('REFUNDED');
    expect(order.refundStatus).toBe('SUCCEEDED');
    expect(order.paymentStatus).toBe('REFUNDED');
    expect(provider.refunds.create).not.toHaveBeenCalled();
  } finally {
    staleResponse.resolve(response('pending'));
    await staleWorker;
  }
});

test.each([
  ['pending', 'PROCESSING'],
  ['failed', 'FAILED'],
  ['canceled', 'FAILED'],
  ['succeeded', 'SUCCEEDED'],
])('ordinary %s response records %s without false fulfillment', async (status, expected) => {
  provider.refunds.retrieve.mockResolvedValue(response(status));
  await reconcile();
  expect(record.status).toBe(expected);
  expect(order.refundStatus).toBe(expected);
  expect(order.status).toBe(expected === 'SUCCEEDED' ? 'REFUNDED' : 'PAID');
  expect(finalizeRefund).toHaveBeenCalledTimes(expected === 'SUCCEEDED' ? 1 : 0);
});

test('a usd refund row follows the cad PaymentIntent before the provider refund is created', async () => {
  record.currency = 'usd';
  record.stripeRefundId = null;
  await reconcile();
  expect(provider.paymentIntents.retrieve).toHaveBeenCalledWith(record.paymentIntentId);
  expect(provider.refunds.create).toHaveBeenCalledWith(
    expect.objectContaining({ payment_intent: record.paymentIntentId, amount: record.amount }),
    expect.objectContaining({ idempotencyKey: `refund-${record.id}` })
  );
  expect(record.currency).toBe('cad');
  expect(record.status).toBe('SUCCEEDED');
  expect(finalizeRefund).toHaveBeenCalledWith(record.orderId);
});

test.each([{ amount: 1300 }, { currency: 'usd' }, { payment_intent: 'pi_another_order' }])(
  'mismatched provider response %j cannot settle a refund',
  async (mismatch) => {
    provider.refunds.retrieve.mockResolvedValue({ ...response('succeeded'), ...mismatch });
    await expect(reconcile()).rejects.toThrow('Processor refund does not match the request');
    expect(record.status).toBe('PROCESSING');
    expect(finalizeRefund).not.toHaveBeenCalled();
    expect(db.paymentRefund.update).not.toHaveBeenCalled();
    expect(db.paymentRefund.updateMany).not.toHaveBeenCalled();
  }
);

test('already successful settlement retries finalization without another provider request', async () => {
  record.status = 'SUCCEEDED';
  await reconcile();
  expect(order.status).toBe('REFUNDED');
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});

test('manual late-paid exceptions never become automatic refund work', async () => {
  record.reason = 'LATE_PAYMENT';
  await reconcile();
  expect(record.status).toBe('PROCESSING');
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(finalizeRefund).not.toHaveBeenCalled();
});

test('new provider refund keeps its durable request identity', async () => {
  record.stripeRefundId = null;
  await reconcile();
  expect(provider.refunds.create).toHaveBeenCalledWith(
    {
      payment_intent: record.paymentIntentId,
      amount: record.amount,
      metadata: { refundId: record.id, orderId: record.orderId },
    },
    { idempotencyKey: `refund-${record.id}` }
  );
  expect(record.status).toBe('SUCCEEDED');
  expect(order.status).toBe('REFUNDED');
});

// Reproduce external-refund identity mismatches, not approval of another financial action.
// Provider rejection is simulated; actual Stripe exception qualification remains W07.
test.each([1200, 400])(
  'external %i-cent refund without platform metadata is not falsely settled after rejected create',
  async (amount) => {
    record.stripeRefundId = null;
    const beforeRecord = { ...record },
      beforeOrder = { ...order };
    provider.refunds.list.mockResolvedValue({
      data: [
        {
          ...response('succeeded'),
          id: 're_external',
          amount,
          metadata: {},
        },
      ],
    });
    const rejection = new Error('Synthetic provider: amount already refunded');
    provider.refunds.create.mockRejectedValue(rejection);
    await expect(reconcile()).rejects.toBe(rejection);
    expect(provider.refunds.list).toHaveBeenCalledWith({
      payment_intent: record.paymentIntentId,
      limit: 100,
    });
    expect(provider.refunds.create).toHaveBeenCalledTimes(1);
    expect(provider.refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: record.paymentIntentId,
        amount: beforeRecord.amount,
        metadata: { refundId: record.id, orderId: record.orderId },
      },
      { idempotencyKey: `refund-${record.id}` }
    );
    expect(provider.refunds.retrieve).not.toHaveBeenCalled();
    expect(db.paymentRefund.update).not.toHaveBeenCalled();
    expect(db.paymentRefund.updateMany).not.toHaveBeenCalled();
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(finalizeRefund).not.toHaveBeenCalled();
    expect(record).toEqual(beforeRecord);
    expect(order).toEqual(beforeOrder);
  }
);

test('linked under-amount partial refund fails closed without financial or local settlement', async () => {
  const beforeRecord = { ...record },
    beforeOrder = { ...order };
  provider.refunds.retrieve.mockResolvedValue({ ...response('succeeded'), amount: 400 });
  await expect(reconcile()).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(provider.refunds.list).not.toHaveBeenCalled();
  expect(db.paymentRefund.update).not.toHaveBeenCalled();
  expect(db.paymentRefund.updateMany).not.toHaveBeenCalled();
  expect(db.order.updateMany).not.toHaveBeenCalled();
  expect(finalizeRefund).not.toHaveBeenCalled();
  expect(record).toEqual(beforeRecord);
  expect(order).toEqual(beforeOrder);
});
