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
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    paymentRefundLine: { upsert: jest.fn().mockResolvedValue({}) },
    event: { findUniqueOrThrow: jest.fn() },
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
let service: PaymentService, provider: any, record: any, order: any;
const intent = {
  id: 'pi-local',
  metadata: { orderId: 'order-local' },
  status: 'succeeded',
  amount: 1200,
  amount_received: 1200,
  currency: 'cad',
};
beforeEach(() => {
  jest.clearAllMocks();
  service = new PaymentService();
  provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  record = {
    id: 'rf-local',
    orderId: 'order-local',
    paymentIntentId: 'pi-local',
    amount: 1200,
    currency: 'cad',
    reason: 'LATE_PAYMENT',
    status: 'REQUESTED',
    createdAt: new Date(),
  };
  order = {
    id: 'order-local',
    paymentIntentId: 'pi-local',
    status: 'PENDING',
    paymentStatus: 'PROCESSING',
    totalAmount: { toString: () => '12' },
    currency: 'cad',
    expiresAt: new Date(0),
    event: { status: 'ON_SALE' },
  };
  (prisma.$transaction as jest.Mock).mockImplementation((work) => work(prisma));
  (prisma.$queryRaw as jest.Mock).mockImplementation(async (sql: TemplateStringsArray) =>
    sql.join('').includes('AS live')
      ? [{ live: true }]
      : [{ status: 'PROCESSING', attempt_generation: 1n }]
  );
  (prisma.event.findUniqueOrThrow as jest.Mock).mockImplementation(async () => order.event);
  (prisma.order.findUnique as jest.Mock).mockImplementation(async () => ({ ...order }));
  (prisma.paymentRefund.findUniqueOrThrow as jest.Mock).mockImplementation(async () => record);
  (prisma.paymentRefund.findFirst as jest.Mock).mockImplementation(async () => record);
  (prisma.paymentRefund.update as jest.Mock).mockImplementation(async ({ data }) => {
    Object.assign(record, data);
    return record;
  });
  (prisma.paymentRefund.upsert as jest.Mock).mockImplementation(async ({ create, update }) => {
    Object.assign(record, create, update);
    return record;
  });
  (prisma.paymentRefund.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (orderService.cancelOrderInTransaction as jest.Mock).mockImplementation(async () => {
    order.status = 'CANCELLED';
  });
  provider.paymentIntents.retrieve.mockResolvedValue(intent);
  provider.refunds.list.mockResolvedValue({ data: [] });
  provider.refunds.retrieve.mockResolvedValue({
    amount: 1200,
    currency: 'cad',
    payment_intent: 'pi-local',
    status: 'succeeded',
  });
  provider.refunds.create.mockResolvedValue({
    id: 're-synthetic',
    amount: 1200,
    currency: 'cad',
    payment_intent: 'pi-local',
    status: 'succeeded',
  });
});
function noFinancialEffects() {
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(provider.refunds.list).not.toHaveBeenCalled();
  expect(provider.refunds.retrieve).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).not.toHaveBeenCalled();
  expect(prisma.order.updateMany).not.toHaveBeenCalled();
}
test('expired success and replay preserve durable manual exception without fulfillment or refund', async () => {
  for (const eventId of ['evt-first', 'evt-first', 'evt-replay']) {
    await (service as any).handlePaymentSuccess(intent, { eventId, generation: 1n });
  }
  noFinancialEffects();
  expect(record).toMatchObject({
    reason: 'LATE_PAYMENT',
    errorMessage: expect.stringContaining('Manual reconciliation'),
  });
  expect(order.status).toBe('CANCELLED');
  expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  noFinancialEffects();
});
test.each(['REQUESTED', 'PROCESSING', 'FAILED', 'SUCCEEDED'])(
  'defensive ingress blocks existing late-paid %s row, including linked provider result',
  async (status) => {
    record.status = status;
    record.stripeRefundId = 're-existing';
    await (service as any).reconcileRefund(record.id);
    noFinancialEffects();
  }
);
test.each(['REQUESTED', 'PROCESSING', 'FAILED'])(
  'background recovery excludes late-paid %s rows and remains safe with a stale selection',
  async (status) => {
    record.status = status;
    // Simulate a stale/legacy selection too: defense must not rely only on the query.
    (prisma.paymentRefund.findMany as jest.Mock).mockResolvedValue([record]);
    await service.recoverRefunds();
    expect(prisma.paymentRefund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reason: { not: 'LATE_PAYMENT' } }),
      })
    );
    noFinancialEffects();
  }
);
test.each(['ORDER_REFUND', 'UNEXPECTED_PAYMENT', 'INCORRECT_AMOUNT'])(
  'ordinary %s delivery policy is unchanged',
  async (reason) => {
    record.reason = reason;
    await (service as any).reconcileRefund(record.id);
    expect(provider.refunds.create).toHaveBeenCalledTimes(1);
    expect(orderService.finalizeRefund).toHaveBeenCalledTimes(reason === 'ORDER_REFUND' ? 1 : 0);
  }
);

test.each([false, true])(
  'refund rejects stale payment observation before financial effects explicit=%s',
  async (explicit) => {
    const observed = { status: 'PAID', paymentStatus: 'SUCCEEDED' };
    order.status = 'PAID';
    order.paymentStatus = 'FAILED';
    if (!explicit) (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce(observed);
    await expect(
      service.refundOrder('order-local', explicit ? observed : undefined)
    ).rejects.toMatchObject({ statusCode: 400 });
    noFinancialEffects();
    expect(prisma.paymentRefund.upsert).not.toHaveBeenCalled();
  }
);
