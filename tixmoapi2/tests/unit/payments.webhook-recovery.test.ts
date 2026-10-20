import { PaymentService } from '../../src/api/payments/service';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import Stripe from 'stripe';

jest.mock('stripe', () => jest.fn(() => ({ webhooks: { constructEvent: jest.fn() } })));
jest.mock('@prisma/client', () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));
jest.mock('../../src/config/environment', () => ({
  config: { stripeSecretKey: 'mock-only', stripeWebhookSecret: 'mock-webhook-secret' },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    paymentWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: { getOrderById: jest.fn(), confirmOrder: jest.fn(), sendOrderConfirmationEmail: jest.fn() },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn(), sendEmail: jest.fn() },
}));


describe('public webhook fulfillment recovery (fully mocked)', () => {
  let service: PaymentService;
  let stored: any;
  let order: any;
  const event = { id: 'evt_recovery', type: 'payment_intent.succeeded', data: {
    object: { id: 'pi_recovery', metadata: { orderId: 'order_recovery' } },
  } };
  const deliver = () => service.handleWebhook('mock-signature', Buffer.from('mock-payload'));

  beforeEach(() => {
    jest.resetAllMocks();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({ webhooks: { constructEvent: jest.fn() } }));
    service = new PaymentService();
    (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value.webhooks.constructEvent.mockReturnValue(event);
    stored = null;
    order = { id: 'order_recovery', paymentIntentId: 'pi_recovery', status: 'PENDING', paymentStatus: 'PROCESSING' };
    (prisma.paymentWebhookEvent.findUnique as jest.Mock).mockImplementation(async () => stored);
    (prisma.paymentWebhookEvent.create as jest.Mock).mockImplementation(async ({ data }) => { stored = { ...data }; return stored; });
    (prisma.paymentWebhookEvent.update as jest.Mock).mockImplementation(async ({ data }) => { Object.assign(stored, data); return stored; });
    (prisma.order.findUnique as jest.Mock).mockImplementation(async () => ({ ...order }));
    (orderService.confirmOrder as jest.Mock).mockImplementation(async () => {
      order.status = 'PAID'; order.paymentStatus = 'SUCCEEDED'; return order;
    });
    // Exercise real retry machinery with no wall-clock delays.
    jest.useFakeTimers();
    (notificationService.sendAdminAlert as jest.Mock).mockResolvedValue(true);
  });
  afterEach(() => jest.useRealTimers());

  it.each([false, true])('persists FAILED and preserves fulfillment error when alert fails=%s; same event recovers once', async (alertFails) => {
    const failure = new Error('inventory unavailable');
    (orderService.confirmOrder as jest.Mock).mockRejectedValue(failure);
    if (alertFails) (notificationService.sendAdminAlert as jest.Mock).mockRejectedValue(new Error('alert unavailable'));
    const rejection = deliver().catch((error: unknown) => error);
    await jest.runAllTimersAsync();
    expect(await rejection).toBe(failure);
    expect(orderService.confirmOrder).toHaveBeenCalledTimes(6);
    expect(notificationService.sendAdminAlert).toHaveBeenCalledWith('Order Confirmation Failure', expect.any(String));
    expect(stored).toMatchObject({ status: 'FAILED', errorMessage: failure.message });
    expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();

    (orderService.confirmOrder as jest.Mock).mockImplementation(async () => {
      order.status = 'PAID'; order.paymentStatus = 'SUCCEEDED'; return order;
    });
    await deliver();
    expect(stored).toMatchObject({ status: 'PROCESSED', errorMessage: null });
    expect(orderService.confirmOrder).toHaveBeenCalledTimes(7);
    expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    await deliver();
    expect(orderService.confirmOrder).toHaveBeenCalledTimes(7);
    expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('does not retry confirmed inventory on email failure (alert fails=%s)', async (alertFails) => {
    (orderService.sendOrderConfirmationEmail as jest.Mock).mockRejectedValue(new Error('email unavailable'));
    if (alertFails) (notificationService.sendAdminAlert as jest.Mock).mockRejectedValue(new Error('alert unavailable'));
    await deliver();
    expect(stored.status).toBe('PROCESSED');
    expect(order.status).toBe('PAID');
    expect(notificationService.sendAdminAlert).toHaveBeenCalledWith('Order Confirmation Email Failure', expect.any(String));
    await deliver();
    expect(orderService.confirmOrder).toHaveBeenCalledTimes(1);
    expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it('skips fulfillment when order is already paid even for a failed event', async () => {
    stored = { id: event.id, status: 'FAILED' };
    order.status = 'PAID'; order.paymentStatus = 'SUCCEEDED';
    await deliver();
    expect(stored.status).toBe('PROCESSED');
    expect(orderService.confirmOrder).not.toHaveBeenCalled();
  });
});
