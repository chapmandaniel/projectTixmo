// Real payment service; every transport/bootstrap dependency is mocked.
jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: { retrieve: jest.fn() },
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
    order: { findUnique: jest.fn(), updateMany: jest.fn() },
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
