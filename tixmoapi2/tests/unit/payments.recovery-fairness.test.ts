// Real payment service; every transport/bootstrap dependency is mocked.
jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: { retrieve: jest.fn() },
    events: { retrieve: jest.fn() },
    refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
  }))
);
jest.mock('../../src/config/environment', () => ({
  config: { nodeEnv: 'test', stripeSecretKey: 'synthetic' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    paymentRefund: {
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentRefundLine: { upsert: jest.fn().mockResolvedValue({}) },
    order: { findUnique: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    paymentWebhookEvent: { findMany: jest.fn(), updateMany: jest.fn() },
    paymentAttempt: { findMany: jest.fn() },
  },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    finalizeRefund: jest.fn(),
    confirmOrderInTransaction: jest.fn(),
    cancelOrderInTransaction: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn() },
}));
import Stripe from 'stripe';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';
const db = prisma as any;
let service: PaymentService;
const now = new Date('2026-10-21T12:00:00Z');
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(now);
  service = new PaymentService();
});
afterEach(() => jest.useRealTimers());
test('50 poison refunds cannot starve healthy 51st; cooldown survives a new service instance', async () => {
  const rows: any[] = Array.from({ length: 51 }, (_, i) => ({
    id: `r-${i}`,
    reason: 'ORDER_REFUND',
    status: 'REQUESTED',
    updatedAt: new Date(now.getTime() - 120000 + i),
  }));
  db.paymentRefund.findMany.mockImplementation(async ({ where, take }: any) =>
    rows
      .filter((r) => !where.updatedAt || r.updatedAt <= where.updatedAt.lte)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, take)
      .map((r) => ({ ...r }))
  );
  db.paymentRefund.updateMany.mockImplementation(async ({ where, data }: any) => {
    const r = rows.find(
      (r) => r.id === where.id && r.updatedAt.getTime() === where.updatedAt.getTime()
    );
    if (!r) return { count: 0 };
    Object.assign(r, data);
    return { count: 1 };
  });
  const reconcile = jest
    .spyOn(PaymentService.prototype as any, 'reconcileRefund')
    .mockImplementation(async (...args: any[]) => {
      if (args[0] !== 'r-50') throw new Error('synthetic poison');
      rows.splice(
        rows.findIndex((r) => r.id === 'r-50'),
        1
      );
    });
  await service.recoverRefunds();
  expect(reconcile).toHaveBeenCalledTimes(50);
  await new PaymentService().recoverRefunds();
  expect(reconcile).toHaveBeenCalledWith('r-50');
  expect(reconcile).toHaveBeenCalledTimes(51);
  await service.recoverRefunds();
  expect(reconcile).toHaveBeenCalledTimes(51);
  expect(rows.every((r) => r.errorMessage?.includes('tixmo-backend'))).toBe(true);
  jest.advanceTimersByTime(60000);
  await service.recoverRefunds();
  expect(reconcile).toHaveBeenCalledTimes(101);
  reconcile.mockRestore();
});
test('stale failure metadata is CAS fenced and never changes financial status', async () => {
  const updatedAt = new Date(0);
  db.paymentRefund.findMany.mockResolvedValue([{ id: 'r-stale', updatedAt }]);
  db.paymentRefund.updateMany.mockResolvedValue({ count: 0 });
  const reconcile = jest
    .spyOn(service as any, 'reconcileRefund')
    .mockRejectedValue(new Error('provider secret must not persist'));
  await service.recoverRefunds();
  expect(db.paymentRefund.updateMany).toHaveBeenCalledWith({
    where: { id: 'r-stale', updatedAt },
    data: { updatedAt: now, errorMessage: expect.stringContaining('tixmo-backend') },
  });
  const data = db.paymentRefund.updateMany.mock.calls[0][0].data;
  expect(data.status).toBeUndefined();
  expect(data.errorMessage).not.toContain('provider secret');
  reconcile.mockRestore();
});
test('old unlinked refund remains visible without creating beyond provider idempotency window', async () => {
  const record = {
    id: 'old',
    orderId: 'order',
    reason: 'ORDER_REFUND',
    status: 'REQUESTED',
    paymentIntentId: 'pi-old',
    amount: 1200,
    currency: 'cad',
    createdAt: new Date(now.getTime() - 24 * 3600000),
    updatedAt: new Date(0),
  };
  db.paymentRefund.findMany.mockResolvedValue([record]);
  db.paymentRefund.findUniqueOrThrow.mockResolvedValue(record);
  db.paymentRefund.updateMany.mockResolvedValue({ count: 1 });
  const provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  provider.paymentIntents.retrieve.mockResolvedValue({
    status: 'succeeded',
    amount_received: 1200,
    currency: 'cad',
  });
  provider.refunds.list.mockResolvedValue({ data: [] });
  await service.recoverRefunds();
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).not.toHaveBeenCalled();
  expect(db.paymentRefund.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ errorMessage: expect.stringContaining('reconciliation') }),
    })
  );
});

// Current main has only provider-event retrieval; no synthetic reconcile event ingress.
test.each(['provider-event'])(
  '%s retrieval poison rotates durably without processing failed retrieval twice',
  async (kind) => {
    const rows: any[] = Array.from({ length: 51 }, (_, i) => ({
      id: kind === 'provider-event' ? `evt-${i}` : `reconcile-${i}`,
      type: 'payment_intent.succeeded',
      paymentIntentId: `pi-${i}`,
      status: i % 2 ? 'FAILED' : 'PROCESSING',
      attemptGeneration: BigInt(i),
      processingStartedAt: new Date(0),
      updatedAt: new Date(now.getTime() - 120000 + i),
    }));
    db.order.findMany.mockResolvedValue([]);
    db.paymentAttempt.findMany.mockResolvedValue([]);
    db.paymentRefund.findMany.mockResolvedValue([]);
    db.paymentWebhookEvent.findMany.mockImplementation(async ({ where, take }: any) =>
      rows
        .filter((r) => !where.updatedAt || r.updatedAt <= where.updatedAt.lte)
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .slice(0, take)
        .map((r) => ({ ...r }))
    );
    db.paymentWebhookEvent.updateMany.mockImplementation(async ({ where, data }: any) => {
      const r = rows.find(
        (r) =>
          r.id === where.id &&
          r.updatedAt.getTime() === where.updatedAt.getTime() &&
          r.status === where.status &&
          r.attemptGeneration === where.attemptGeneration
      );
      if (!r) return { count: 0 };
      Object.assign(r, data);
      return { count: 1 };
    });
    // Constructors return separate mock transports: configure each instance explicitly.
    const configure = () => {
      const provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
      const retrieve =
        kind === 'provider-event' ? provider.events.retrieve : provider.paymentIntents.retrieve;
      retrieve.mockImplementation(async (id: string) => {
        if (!id.endsWith('-50')) throw new Error('private provider failure');
        return { id: 'evt-50', status: 'succeeded' };
      });
      return retrieve;
    };
    const process = jest
      .spyOn(PaymentService.prototype as any, 'processEvent')
      .mockImplementation(async () => {
        rows.splice(
          rows.findIndex((r) => r.id.endsWith('-50')),
          1
        );
      });
    const firstRetrieve = configure();
    await service.recoverPayments();
    expect(firstRetrieve).toHaveBeenCalledTimes(50);
    expect(process).not.toHaveBeenCalled();
    const restarted = new PaymentService();
    const secondRetrieve = configure();
    await restarted.recoverPayments();
    expect(secondRetrieve).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledTimes(1);
    await restarted.recoverPayments();
    expect(secondRetrieve).toHaveBeenCalledTimes(1);
    expect(rows.every((r) => r.errorMessage?.includes('owner=tixmo-backend'))).toBe(true);
    expect(rows.every((r) => !r.errorMessage.includes('private provider'))).toBe(true);
    expect(db.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: rows[0].id,
        updatedAt: expect.any(Date),
        status: rows[0].status,
        attemptGeneration: rows[0].attemptGeneration,
      },
      data: { updatedAt: now, errorMessage: expect.stringContaining('retry after 60 seconds') },
    });
    jest.advanceTimersByTime(60000);
    await restarted.recoverPayments();
    expect(secondRetrieve).toHaveBeenCalledTimes(51);
    expect(process).toHaveBeenCalledTimes(1);
    process.mockRestore();
  }
);

test('webhook retrieval failure cannot overwrite a newer generation or its financial result', async () => {
  db.order.findMany.mockResolvedValue([]);
  db.paymentAttempt.findMany.mockResolvedValue([]);
  db.paymentRefund.findMany.mockResolvedValue([]);
  const selected = {
    id: 'evt-stale',
    status: 'FAILED',
    attemptGeneration: 1n,
    updatedAt: new Date(0),
  };
  const current = { ...selected, status: 'PROCESSED', attemptGeneration: 2n, errorMessage: null };
  db.paymentWebhookEvent.findMany.mockResolvedValue([selected]);
  db.paymentWebhookEvent.updateMany.mockImplementation(async ({ where, data }: any) => {
    if (where.attemptGeneration !== current.attemptGeneration || where.status !== current.status)
      return { count: 0 };
    Object.assign(current, data);
    return { count: 1 };
  });
  const provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  provider.events.retrieve.mockRejectedValue(new Error('synthetic outage'));
  const process = jest.spyOn(service as any, 'processEvent');
  await service.recoverPayments();
  expect(process).not.toHaveBeenCalled();
  expect(db.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
    where: {
      id: selected.id,
      status: selected.status,
      attemptGeneration: 1n,
      updatedAt: selected.updatedAt,
    },
    data: { updatedAt: now, errorMessage: expect.stringContaining('owner=tixmo-backend') },
  });
  expect(current).toEqual({
    ...selected,
    status: 'PROCESSED',
    attemptGeneration: 2n,
    errorMessage: null,
  });
  expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).not.toHaveBeenCalled();
  process.mockRestore();
});
