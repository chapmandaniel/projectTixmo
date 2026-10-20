import { PaymentService } from '../../src/api/payments/service';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import Stripe from 'stripe';

jest.mock('stripe', () => jest.fn(() => ({ webhooks: { constructEvent: jest.fn() } })));
jest.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
jest.mock('../../src/config/environment', () => ({
  config: {
    nodeEnv: 'test',
    stripeSecretKey: 'mock-only',
    stripeWebhookSecret: 'mock-webhook-secret',
  },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    paymentWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    order: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    getOrderById: jest.fn(),
    confirmOrderInTransaction: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn(), sendEmail: jest.fn() },
}));

describe('public webhook fulfillment recovery (fully mocked)', () => {
  let service: PaymentService;
  let stored: any;
  let order: any;
  const event = {
    id: 'evt_recovery',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_recovery',
        status: 'succeeded',
        amount: 1000,
        amount_received: 1000,
        currency: 'cad',
        metadata: { orderId: 'order_recovery' },
      },
    },
  };
  const deliver = () => service.handleWebhook('mock-signature', Buffer.from('mock-payload'));

  beforeEach(() => {
    jest.resetAllMocks();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      webhooks: { constructEvent: jest.fn() },
    }));
    service = new PaymentService();
    (Stripe as unknown as jest.Mock).mock.results
      .slice(-1)[0]
      .value.webhooks.constructEvent.mockReturnValue(event);
    stored = null;
    order = {
      id: 'order_recovery',
      paymentIntentId: 'pi_recovery',
      status: 'PENDING',
      paymentStatus: 'PROCESSING',
      totalAmount: { toString: () => '10' },
      currency: 'cad',
      event: { status: 'ON_SALE' },
    };
    (prisma.paymentWebhookEvent.findUnique as jest.Mock).mockImplementation(async () =>
      stored ? { ...stored } : null
    );
    (prisma.paymentWebhookEvent.create as jest.Mock).mockImplementation(async ({ data }) => {
      stored = { attemptGeneration: 0n, ...data };
      return stored;
    });
    (prisma.paymentWebhookEvent.update as jest.Mock).mockImplementation(async ({ data }) => {
      Object.assign(stored, data);
      return stored;
    });
    (prisma.paymentWebhookEvent.updateMany as jest.Mock).mockImplementation(
      async ({ where, data }) => {
        const eligible =
          stored &&
          stored.id === where.id &&
          stored.attemptGeneration === where.attemptGeneration &&
          (where.OR
            ? where.OR.some(
                (clause: any) =>
                  clause.status === stored.status || clause.status?.in?.includes(stored.status)
              )
            : stored.status === where.status);
        if (!eligible) return { count: 0 };
        const generation = stored.attemptGeneration;
        Object.assign(stored, data);
        if (data.attemptGeneration?.increment)
          stored.attemptGeneration = generation + BigInt(data.attemptGeneration.increment);
        return { count: 1 };
      }
    );
    (prisma.$queryRaw as jest.Mock).mockImplementation(async (sql: TemplateStringsArray) => {
      const query = sql.join('?');
      if (query.includes('AS now')) return [{ now: new Date() }];
      if (query.includes('AS live'))
        return [{ live: stored?.processingStartedAt > new Date(Date.now() - 300000) }];
      if (query.includes('attempt_generation'))
        return stored
          ? [{ status: stored.status, attempt_generation: stored.attemptGeneration }]
          : [];
      return [{ id: order.id }];
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (work) => {
      const before = { ...order };
      try {
        return await work(prisma);
      } catch (error) {
        Object.assign(order, before);
        throw error;
      }
    });
    (prisma.order.findUnique as jest.Mock).mockImplementation(async () => ({ ...order }));
    (orderService.confirmOrderInTransaction as jest.Mock).mockImplementation(async () => {
      order.status = 'PAID';
      order.paymentStatus = 'SUCCEEDED';
      return order;
    });
    // Exercise real retry machinery with no wall-clock delays.
    jest.useFakeTimers();
    (notificationService.sendAdminAlert as jest.Mock).mockResolvedValue(true);
    (orderService.sendOrderConfirmationEmail as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it.each([false, true])(
    'persists FAILED and preserves fulfillment error when alert fails=%s; same event recovers once',
    async (alertFails) => {
      const failure = new Error('inventory unavailable');
      (orderService.confirmOrderInTransaction as jest.Mock).mockRejectedValue(failure);
      if (alertFails)
        (notificationService.sendAdminAlert as jest.Mock).mockRejectedValue(
          new Error('alert unavailable')
        );
      const rejection = deliver().catch((error: unknown) => error);
      await jest.runAllTimersAsync();
      expect(await rejection).toBe(failure);
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(6);
      expect(notificationService.sendAdminAlert).toHaveBeenCalledWith(
        'Order Confirmation Failure',
        expect.any(String)
      );
      expect(stored).toMatchObject({ status: 'FAILED', errorMessage: failure.message });
      expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();

      (orderService.confirmOrderInTransaction as jest.Mock).mockImplementation(async () => {
        order.status = 'PAID';
        order.paymentStatus = 'SUCCEEDED';
        return order;
      });
      await deliver();
      expect(stored).toMatchObject({ status: 'PROCESSED', errorMessage: null });
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(7);
      expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
      await deliver();
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(7);
      expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    }
  );

  it.each([false, true])(
    'does not retry confirmed inventory on email failure (alert fails=%s)',
    async (alertFails) => {
      (orderService.sendOrderConfirmationEmail as jest.Mock).mockRejectedValue(
        new Error('email unavailable')
      );
      if (alertFails)
        (notificationService.sendAdminAlert as jest.Mock).mockRejectedValue(
          new Error('alert unavailable')
        );
      await deliver();
      expect(stored.status).toBe('PROCESSED');
      expect(order.status).toBe('PAID');
      expect(notificationService.sendAdminAlert).toHaveBeenCalledWith(
        'Order Confirmation Email Failure',
        expect.any(String)
      );
      await deliver();
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(1);
      expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    }
  );

  it('skips fulfillment when order is already paid even for a failed event', async () => {
    stored = { id: event.id, status: 'FAILED', attemptGeneration: 1n };
    order.status = 'PAID';
    order.paymentStatus = 'SUCCEEDED';
    await deliver();
    expect(stored.status).toBe('PROCESSED');
    expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  });
});
