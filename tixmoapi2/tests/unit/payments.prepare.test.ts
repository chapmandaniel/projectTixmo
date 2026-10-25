// Fully mocked: never imports real environment, database, or Stripe transport.
jest.mock('stripe', () => jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() } })));
jest.mock('../../src/config/environment', () => ({ config: { stripeSecretKey: 'mock-only', paymentCurrency: 'CAD' } }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/config/prisma', () => ({ __esModule: true, default: { order: { updateMany: jest.fn(), findUnique: jest.fn() } } }));
jest.mock('../../src/api/orders/service', () => ({ orderService: { getOrderById: jest.fn(), confirmOrder: jest.fn() } }));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn() } }));
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import prisma from '../../src/config/prisma';

let service: PaymentService, stripe: any, order: any, intents: Map<string, any>;
const db = prisma.order as any;
let loseResponse: boolean;
beforeEach(() => {
  jest.clearAllMocks();
  service = new PaymentService();
  stripe = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  order = { id: 'order-a', userId: 'buyer-a', orderNumber: 'A', totalAmount: 12, status: 'PENDING', paymentStatus: 'PENDING', paymentIntentId: null, createdAt: new Date() };
  intents = new Map(); loseResponse = false;
  (orderService.getOrderById as jest.Mock).mockImplementation(async (id, buyer) => id === order.id && buyer === order.userId ? { ...order } : null);
  stripe.paymentIntents.create.mockImplementation(async (params: any, opts: any) => {
    const previous = intents.get(opts.idempotencyKey);
    if (previous && (previous.amount !== params.amount || previous.currency !== params.currency)) throw new Error('Stripe idempotency parameter conflict');
    const intent = previous || { ...params, id: 'pi-one', status: 'requires_payment_method', client_secret: 'mock-client-secret' };
    intents.set(opts.idempotencyKey, intent);
    if (loseResponse) { loseResponse = false; throw new Error('lost response'); }
    return intent;
  });
  stripe.paymentIntents.retrieve.mockImplementation(async (id: string) => [...intents.values()].find(i => i.id === id));
  db.updateMany.mockImplementation(async ({ where, data }: any) => {
    const allowed = where.id === order.id && where.userId === order.userId && where.status === order.status &&
      where.totalAmount === order.totalAmount && where.paymentStatus.in.includes(order.paymentStatus) &&
      where.OR.some((clause: any) => clause.paymentIntentId === order.paymentIntentId);
    if (allowed) Object.assign(order, data);
    return { count: allowed ? 1 : 0 };
  });
});
const prepare = () => service.createPaymentIntent('order-a', 'buyer-a');

test('sequential retries retrieve the same intent and retain buyer scope', async () => {
  const first = await prepare(); expect(await prepare()).toEqual(first);
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi-one');
  expect(orderService.getOrderById).toHaveBeenCalledWith('order-a', 'buyer-a');
  await expect(service.createPaymentIntent('order-a', 'other-org-buyer')).rejects.toMatchObject({ statusCode: 404 });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
});
test('concurrent requests converge via Stripe idempotency and conditional writes', async () => {
  const results = await Promise.all([prepare(), prepare(), prepare()]);
  expect(new Set(results.map(r => r.paymentIntentId))).toEqual(new Set(['pi-one']));
  expect(intents.size).toBe(1); expect(order.paymentIntentId).toBe('pi-one');
  expect(stripe.paymentIntents.create.mock.calls.every((c: any) => c[1].idempotencyKey === 'order-payment-v1:order-a')).toBe(true);
});
test('lost Stripe response retries with the same key', async () => {
  loseResponse = true;
  await expect(prepare()).rejects.toThrow('lost response');
  expect(order.paymentIntentId).toBeNull();
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(intents.size).toBe(1);
});
test('DB write failure retries without creating a second usable intent', async () => {
  db.updateMany.mockRejectedValueOnce(new Error('DB unavailable'));
  await expect(prepare()).rejects.toThrow('DB unavailable');
  expect(order.paymentIntentId).toBeNull();
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(intents.size).toBe(1);
});
test.each(['amount', 'currency', 'orderId', 'userId'])('stored %s mismatch fails without replacement or DB write', async field => {
  await prepare(); db.updateMany.mockClear();
  const intent = [...intents.values()][0];
  if (field === 'amount') intent.amount++;
  else if (field === 'currency') intent.currency = 'usd';
  else intent.metadata[field] = 'other';
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1); expect(db.updateMany).not.toHaveBeenCalled();
});
test.each(['processing', 'succeeded', 'canceled'])('stored %s intent fails closed without replacement', async status => {
  await prepare(); db.updateMany.mockClear(); [...intents.values()][0].status = status;
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1); expect(db.updateMany).not.toHaveBeenCalled();
});
test('expired idempotency guarantee fails closed for an unlinked order', async () => {
  order.createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
});
test.each(['paid', 'failed', 'canceled', 'different-intent', 'amount'])('async %s order change cannot be overwritten', async change => {
  const create = stripe.paymentIntents.create.getMockImplementation();
  stripe.paymentIntents.create.mockImplementation(async (...args: any[]) => {
    const intent = await create(...args);
    if (change === 'paid') { order.status = 'PAID'; order.paymentStatus = 'SUCCEEDED'; }
    if (change === 'failed') order.paymentStatus = 'FAILED';
    if (change === 'canceled') order.status = 'CANCELLED';
    if (change === 'different-intent') order.paymentIntentId = 'pi-other';
    if (change === 'amount') order.totalAmount = 99;
    return intent;
  });
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 });
  expect(order.paymentIntentId).not.toBe('pi-one');
});
test('changed amount after lost response conflicts rather than minting a second intent', async () => {
  loseResponse = true; await expect(prepare()).rejects.toThrow('lost response'); order.totalAmount = 99;
  await expect(prepare()).rejects.toThrow('idempotency parameter conflict'); expect(intents.size).toBe(1);
});
test('successful webhook mismatch protection remains active', async () => {
  db.findUnique.mockResolvedValue({ ...order, paymentIntentId: 'pi-existing' });
  await expect((service as any).handlePaymentSuccess({ id: 'pi-other', metadata: { orderId: order.id } })).rejects.toMatchObject({ statusCode: 400 });
  expect(orderService.confirmOrder).not.toHaveBeenCalled();
});

test('succeeded payment is rejected before contacting Stripe even if order is pending', async () => {
  order.paymentStatus = 'SUCCEEDED';
  await expect(prepare()).rejects.toMatchObject({ statusCode: 400 });
  expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
});

// QA84 reviewer-only additions; not part of reviewed commit.
test.each([-1, 0, 1])('QA84 exact 23h cutoff offset %s milliseconds', async offset => {
  const now = Date.now(); const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  order.createdAt = new Date(now - 23 * 60 * 60 * 1000 - offset);
  try {
    if (offset < 0) await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
    else { await expect(prepare()).rejects.toMatchObject({ statusCode: 409 }); expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(db.updateMany).not.toHaveBeenCalled(); }
  } finally { clock.mockRestore(); }
});
test('QA84 linked intent remains retrievable beyond cutoff without new create', async () => {
  await prepare(); order.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
});
test.each(['requires_confirmation', 'requires_action'])('QA84 valid reusable %s status', async status => {
  await prepare(); [...intents.values()][0].status = status;
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' });
  expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
});
test('QA84 missing client secret never writes order', async () => {
  stripe.paymentIntents.create.mockResolvedValue({ id: 'pi-one', amount: 1200, currency: 'cad', metadata: { orderId: order.id, userId: order.userId }, status: 'requires_payment_method', client_secret: null });
  await expect(prepare()).rejects.toMatchObject({ statusCode: 500 }); expect(db.updateMany).not.toHaveBeenCalled();
});
test('QA84 simultaneous Stripe key-in-use failure is retryable without DB write', async () => {
  stripe.paymentIntents.create.mockRejectedValueOnce(new Error('idempotency_key_in_use'));
  await expect(prepare()).rejects.toThrow('idempotency_key_in_use'); expect(db.updateMany).not.toHaveBeenCalled();
  await expect(prepare()).resolves.toMatchObject({ paymentIntentId: 'pi-one' }); expect(intents.size).toBe(1);
});
test('QA84 currency change after lost response cannot create second intent', async () => {
  const config = require('../../src/config/environment').config;
  loseResponse = true; await expect(prepare()).rejects.toThrow('lost response');
  config.paymentCurrency = 'USD';
  try { await expect(prepare()).rejects.toThrow('idempotency parameter conflict'); expect(intents.size).toBe(1); }
  finally { config.paymentCurrency = 'CAD'; }
});
test('QA84 buyer mutation during Stripe call cannot be overwritten', async () => {
  const create = stripe.paymentIntents.create.getMockImplementation();
  stripe.paymentIntents.create.mockImplementation(async (...args: any[]) => { const intent = await create(...args); order.userId = 'other-buyer'; return intent; });
  await expect(prepare()).rejects.toMatchObject({ statusCode: 409 }); expect(order.paymentIntentId).toBeNull();
});
