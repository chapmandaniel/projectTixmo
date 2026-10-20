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
