// Mock-only merge contracts: no integration setup, database or provider I/O.
jest.mock('../../src/config/environment', () => ({
  config: { stripeSecretKey: 'sk_test_mock', nodeEnv: 'test' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: { $transaction: jest.fn() },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    confirmOrderInTransaction: jest.fn(),
    confirmOrder: jest.fn(),
    finalizeRefund: jest.fn(),
    cancelOrderInTransaction: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn(), sendEmail: jest.fn() },
}));
jest.mock('stripe', () => jest.fn());
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';
const db = prisma as any;
let service: any, tx: any, order: any;
const claim = { eventId: 'evt-owned', generation: 3n };
const intent = {
  id: 'pi-owned',
  status: 'succeeded',
  amount: 1000,
  amount_received: 1000,
  currency: 'cad',
  metadata: { orderId: 'order-owned', userId: 'buyer', attemptId: 'attempt-owned' },
};
beforeEach(() => {
  jest.resetAllMocks();
  service = new PaymentService();
  order = {
    id: 'order-owned',
    paymentIntentId: intent.id,
    status: 'PENDING',
    paymentStatus: 'PROCESSING',
    currency: 'cad',
    totalAmount: { toString: () => '10' },
    event: { status: 'ON_SALE' },
  };
  tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: order.id }]),
    order: {
      findUnique: jest.fn().mockImplementation(async () => order),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    paymentAttempt: { update: jest.fn() },
    paymentRefund: { upsert: jest.fn().mockResolvedValue({ id: 'refund-owned' }) },
  };
  db.$transaction.mockImplementation(async (work: any) => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ status: 'PROCESSING', attempt_generation: 3n }])
      .mockResolvedValueOnce([{ live: true }])
      .mockResolvedValueOnce([{ id: order.id }]);
    return work(tx);
  });
  (orderService.sendOrderConfirmationEmail as jest.Mock).mockResolvedValue(undefined);
});
test('success confirms in exact owned transaction, never nested public confirmation', async () => {
  await service.handlePaymentSuccess(intent, claim);
  expect(orderService.confirmOrderInTransaction).toHaveBeenCalledWith(tx, order.id);
  expect(orderService.confirmOrder).not.toHaveBeenCalled();
  expect(tx.$queryRaw.mock.calls.map((call: any[]) => call.slice(1))).toEqual([
    [claim.eventId],
    [claim.eventId],
    [order.id],
  ]);
  expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledWith(order.id);
});
test('stale generation cannot confirm, cancel, bind, create refund or deliver receipt', async () => {
  db.$transaction.mockImplementation(async (work: any) => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ status: 'PROCESSING', attempt_generation: 4n }])
      .mockResolvedValueOnce([{ live: true }]);
    return work(tx);
  });
  await expect(service.handlePaymentSuccess(intent, claim)).rejects.toThrow('ownership lost');
  expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  expect(orderService.cancelOrderInTransaction).not.toHaveBeenCalled();
  expect(tx.order.update).not.toHaveBeenCalled();
  expect(tx.paymentRefund.upsert).not.toHaveBeenCalled();
  expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});
test('late success durably records refund and releases inventory in owned tx before provider delivery', async () => {
  order.expiresAt = new Date(0);
  const reconcile = jest.spyOn(service, 'reconcileRefund').mockResolvedValue(undefined);
  await service.handlePaymentSuccess(intent, claim);
  expect(orderService.cancelOrderInTransaction).toHaveBeenCalledWith(tx, order.id);
  expect(tx.paymentRefund.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({ reason: 'LATE_PAYMENT', amount: 1000 }),
    })
  );
  expect(reconcile).toHaveBeenCalledWith('refund-owned');
  expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
});
test('unbound success requires committed matching attempt identity', async () => {
  order.paymentIntentId = null;
  order.paymentAttempt = { id: 'different-attempt' };
  jest.spyOn(service, 'reconcileRefund').mockResolvedValue(undefined);
  await service.handlePaymentSuccess(intent, claim);
  expect(tx.paymentAttempt.update).not.toHaveBeenCalled();
  expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  expect(tx.paymentRefund.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ create: expect.objectContaining({ reason: 'UNEXPECTED_PAYMENT' }) })
  );
});
test('matching early intent binds inside owned transaction then confirms', async () => {
  order.paymentIntentId = null;
  order.paymentAttempt = { id: intent.metadata.attemptId };
  await service.handlePaymentSuccess(intent, claim);
  expect(tx.paymentAttempt.update).toHaveBeenCalledWith({
    where: { orderId: order.id },
    data: { paymentIntentId: intent.id },
  });
  expect(orderService.confirmOrderInTransaction).toHaveBeenCalledWith(tx, order.id);
});
test('background success enters same event ledger and fence', async () => {
  const processEvent = jest.spyOn(service, 'processEvent').mockResolvedValue(undefined);
  await service.reconcileSuccess(intent);
  expect(processEvent).toHaveBeenCalledWith({
    id: `reconcile-success:${intent.id}`,
    type: 'payment_intent.succeeded',
    data: { object: intent },
  });
});
test('failed event cannot overwrite committed success or send false failure notice', async () => {
  tx.order.updateMany.mockResolvedValue({ count: 0 });
  await service.handlePaymentFailure(intent, claim);
  expect(tx.order.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: 'PENDING', paymentStatus: { not: 'SUCCEEDED' } }),
    })
  );
  const { notificationService } = await import('../../src/utils/notificationService');
  expect(notificationService.sendEmail).not.toHaveBeenCalled();
});

test('cancellation reconciliation records an owned synthetic event', async () => {
  const processEvent = jest.spyOn(service, 'processEvent').mockResolvedValue(undefined);
  await service.reconcileCancellation({ ...intent, status: 'canceled' });
  expect(processEvent).toHaveBeenCalledWith({
    id: `reconcile-canceled:${intent.id}`,
    type: 'payment_intent.canceled',
    data: { object: { ...intent, status: 'canceled' } },
  });
});
test('confirmed processor cancellation releases pending inventory in same owned tx', async () => {
  await service.handlePaymentCancellation({ ...intent, status: 'canceled' }, claim);
  expect(orderService.cancelOrderInTransaction).toHaveBeenCalledWith(tx, order.id);
  expect(tx.order.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: 'CANCELLED', paymentStatus: { not: 'SUCCEEDED' } }),
    })
  );
});
test('expired owner cannot perform cancellation or payment effects', async () => {
  db.$transaction.mockImplementation(async (work: any) => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ status: 'PROCESSING', attempt_generation: claim.generation }])
      .mockResolvedValueOnce([{ live: false }]);
    return work(tx);
  });
  await expect(
    service.handlePaymentCancellation({ ...intent, status: 'canceled' }, claim)
  ).rejects.toThrow('ownership lost');
  expect(orderService.cancelOrderInTransaction).not.toHaveBeenCalled();
  expect(tx.order.updateMany).not.toHaveBeenCalled();
});

test('slow refund response cannot regress a concurrently confirmed processor refund', async () => {
  const record = {
    id: 'refund',
    orderId: order.id,
    paymentIntentId: intent.id,
    stripeRefundId: 're-refund',
    amount: 1000,
    currency: 'cad',
    reason: 'ORDER_REFUND',
    status: 'PROCESSING',
  };
  db.paymentRefund = {
    findUniqueOrThrow: jest
      .fn()
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({ ...record, status: 'SUCCEEDED' }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  db.order = { updateMany: jest.fn() };
  service.stripe = {
    paymentIntents: { retrieve: jest.fn().mockResolvedValue(intent) },
    refunds: {
      retrieve: jest.fn().mockResolvedValue({
        id: record.stripeRefundId,
        amount: 1000,
        currency: 'cad',
        payment_intent: intent.id,
        status: 'pending',
      }),
    },
  };
  await service.reconcileRefund(record.id);
  expect(db.paymentRefund.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: record.id, status: { not: 'SUCCEEDED' } } })
  );
  expect(orderService.finalizeRefund).toHaveBeenCalledWith(order.id);
  expect(db.order.updateMany).not.toHaveBeenCalled();
});

test('early failed event binds only a committed matching attempt under event ownership', async () => {
  order.paymentIntentId = null;
  order.paymentAttempt = { id: intent.metadata.attemptId };
  order.user = { email: 'buyer@example.test' };
  const { notificationService } = await import('../../src/utils/notificationService');
  (notificationService.sendEmail as jest.Mock).mockResolvedValue(true);
  await service.handlePaymentFailure({ ...intent, status: 'requires_payment_method' }, claim);
  expect(tx.paymentAttempt.update).toHaveBeenCalledWith({
    where: { orderId: order.id },
    data: { paymentIntentId: intent.id },
  });
  expect(tx.order.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ paymentIntentId: null, status: 'PENDING' }),
      data: { paymentIntentId: intent.id, paymentStatus: 'FAILED' },
    })
  );
});
