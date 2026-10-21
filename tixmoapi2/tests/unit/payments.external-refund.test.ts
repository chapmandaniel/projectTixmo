// Setup-free simulator: real PaymentService, no environment/DB/provider transport.
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { retrieve: jest.fn() },
  refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
})));
jest.mock('../../src/config/environment', () => ({ config: { stripeSecretKey: 'synthetic-only' } }));
jest.mock('../../src/config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock('../../src/config/prisma', () => ({ __esModule: true, default: {
  paymentRefund: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
  order: { updateMany: jest.fn() },
} }));
jest.mock('../../src/api/orders/service', () => ({ orderService: { finalizeRefund: jest.fn() } }));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import Stripe from 'stripe';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { PaymentService } from '../../src/api/payments/service';
let service: PaymentService, provider: any, record: any;
beforeEach(() => {
  jest.clearAllMocks();
  service = new PaymentService();
  provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  record = { id: 'rf-local', orderId: 'order-local', paymentIntentId: 'pi-local',
    amount: 1200, currency: 'cad', reason: 'ORDER_REFUND', status: 'PROCESSING', createdAt: new Date() };
  (prisma.paymentRefund.findUniqueOrThrow as jest.Mock).mockResolvedValue(record);
  (prisma.paymentRefund.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  provider.paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded', amount_received: 1200, currency: 'cad' });
});
const reconcile = () => (service as any).reconcileRefund(record.id);
test.each([1200, 400])('external %i-cent refund without local metadata is not adopted before a full create attempt', async amount => {
  provider.refunds.list.mockResolvedValue({ data: [{ id: 'rf-external', amount, currency: 'cad',
    payment_intent: 'pi-local', status: 'succeeded', metadata: {} }] });
  provider.refunds.create.mockRejectedValue(new Error('synthetic provider: balance already refunded'));
  await expect(reconcile()).rejects.toThrow('balance already refunded');
  expect(provider.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi-local', amount: 1200,
    metadata: { refundId: 'rf-local', orderId: 'order-local' } }, { idempotencyKey: 'refund-rf-local' });
  expect(prisma.paymentRefund.updateMany).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).not.toHaveBeenCalled();
});
test('linked partial result fails closed without finalization', async () => {
  record.stripeRefundId = 'rf-external';
  provider.refunds.retrieve.mockResolvedValue({ amount: 400, currency: 'cad', payment_intent: 'pi-local', status: 'succeeded' });
  await expect(reconcile()).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(prisma.paymentRefund.updateMany).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).not.toHaveBeenCalled();
});
test.each(['pending', 'failed', 'succeeded'])('matching linked %s result only finalizes success', async status => {
  record.stripeRefundId = 'rf-linked';
  provider.refunds.retrieve.mockResolvedValue({ id: 'rf-linked', amount: 1200, currency: 'cad', payment_intent: 'pi-local', status });
  await reconcile();
  expect(provider.refunds.create).not.toHaveBeenCalled();
  expect(orderService.finalizeRefund).toHaveBeenCalledTimes(status === 'succeeded' ? 1 : 0);
  expect(prisma.paymentRefund.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: status === 'pending' ? 'PROCESSING' : status === 'failed' ? 'FAILED' : 'SUCCEEDED' }),
  }));
});
