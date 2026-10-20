// Fully mocked transactional/provider boundaries; never load tests/setup.ts.
jest.mock('stripe', () => jest.fn(() => ({ webhooks: { constructEvent: jest.fn() } })));
jest.mock('../../src/config/environment', () => ({
  config: {
    stripeSecretKey: 'mock-only',
    stripeWebhookSecret: 'mock-webhook-secret',
    nodeEnv: 'test',
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
    paymentWebhookEvent: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    event: { findUniqueOrThrow: jest.fn() },
    paymentAttempt: { update: jest.fn() },
    paymentRefund: { upsert: jest.fn() },
  },
}));
jest.mock('../../src/api/orders/service', () => ({
  orderService: {
    confirmOrderInTransaction: jest.fn(),
    cancelOrderInTransaction: jest.fn(),
    sendOrderConfirmationEmail: jest.fn(),
  },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn(), sendEmail: jest.fn() },
}));
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentService } from '../../src/api/payments/service';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import Stripe from 'stripe';

describe('public webhook fulfillment recovery (mocked boundaries)', () => {
  let service: PaymentService, stored: any, order: any, event: any, refund: any;
  let held: number, sold: number;
  const db = prisma as any;
  const deliver = () => service.handleWebhook('mock-signature', Buffer.from('mock-payload'));

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.useFakeTimers();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      webhooks: { constructEvent: jest.fn() },
    }));
    service = new PaymentService();
    event = {
      id: 'evt_recovery',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_recovery',
          status: 'succeeded',
          amount: 1200,
          amount_received: 1200,
          currency: 'cad',
          metadata: { orderId: 'order_recovery', userId: 'buyer', attemptId: 'attempt' },
        },
      },
    };
    (Stripe as unknown as jest.Mock).mock.results
      .slice(-1)[0]
      .value.webhooks.constructEvent.mockImplementation(() => event);
    stored = null;
    refund = null;
    held = 2;
    sold = 0;
    order = {
      id: 'order_recovery',
      userId: 'buyer',
      orderNumber: 'RECOVERY',
      eventId: 'event',
      totalAmount: new Decimal(12),
      currency: 'cad',
      paymentIntentId: 'pi_recovery',
      paymentAttempt: { id: 'attempt', paymentIntentId: 'pi_recovery' },
      status: 'PENDING',
      paymentStatus: 'PROCESSING',
      receiptStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 600_000),
      user: { email: 'buyer@example.test' },
    };
    db.paymentWebhookEvent.findUnique.mockImplementation(async () =>
      stored ? { ...stored } : null
    );
    db.paymentWebhookEvent.create.mockImplementation(async ({ data }: any) => {
      stored = {
        attemptGeneration: 0n,
        processedAt: null,
        leaseToken: null,
        errorMessage: null,
        ...data,
      };
      return { ...stored };
    });
    db.paymentWebhookEvent.updateMany.mockImplementation(async ({ where, data }: any) => {
      const statusMatches = (clause: any) =>
        (typeof clause.status === 'string'
          ? clause.status === stored.status
          : clause.status.in.includes(stored.status)) &&
        (!clause.processingStartedAt ||
          stored.processingStartedAt <= clause.processingStartedAt.lte);
      const eligible =
        stored &&
        stored.id === where.id &&
        stored.attemptGeneration === where.attemptGeneration &&
        (where.OR ? where.OR.some(statusMatches) : stored.status === where.status);
      if (!eligible) return { count: 0 };
      const generation = stored.attemptGeneration;
      Object.assign(stored, data);
      if (data.attemptGeneration?.increment)
        stored.attemptGeneration = generation + BigInt(data.attemptGeneration.increment);
      return { count: 1 };
    });
    db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
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
    db.$transaction.mockImplementation(async (work: any) => {
      const before = {
          ...order,
          paymentAttempt: order.paymentAttempt ? { ...order.paymentAttempt } : null,
        },
        beforeRefund = refund;
      const beforeHeld = held,
        beforeSold = sold;
      try {
        return await work(prisma);
      } catch (error) {
        order = before;
        refund = beforeRefund;
        held = beforeHeld;
        sold = beforeSold;
        throw error;
      }
    });
    db.order.findUnique.mockImplementation(async () => ({
      ...order,
      paymentAttempt: order.paymentAttempt ? { ...order.paymentAttempt } : null,
    }));
    db.order.update.mockImplementation(async ({ data }: any) => {
      Object.assign(order, data);
      return { ...order };
    });
    db.order.updateMany.mockImplementation(async () => {
      if (order.status !== 'PENDING' || order.paymentStatus === 'SUCCEEDED') return { count: 0 };
      order.paymentStatus = 'FAILED';
      return { count: 1 };
    });
    db.order.findMany.mockImplementation(async () =>
      order.status === 'PAID' && order.receiptStatus === 'PENDING' ? [{ ...order }] : []
    );
    db.event.findUniqueOrThrow.mockResolvedValue({ status: 'ON_SALE', deletedAt: null });
    db.paymentAttempt.update.mockImplementation(async ({ data }: any) =>
      Object.assign(order.paymentAttempt, data)
    );
    db.paymentRefund.upsert.mockImplementation(async ({ create }: any) => {
      refund ||= { id: 'refund', status: 'REQUESTED', ...create };
      return { ...refund };
    });
    (orderService.confirmOrderInTransaction as jest.Mock).mockImplementation(async () => {
      held -= 2;
      sold += 2;
      order.status = 'PAID';
      order.paymentStatus = 'SUCCEEDED';
      return { ...order };
    });
    (orderService.sendOrderConfirmationEmail as jest.Mock).mockResolvedValue(undefined);
    (notificationService.sendAdminAlert as jest.Mock).mockResolvedValue(true);
    (notificationService.sendEmail as jest.Mock).mockResolvedValue(true);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'rolls back failures and preserves original error when admin alert fails=%s; same event recovers once',
    async (alertFails) => {
      const failure = new Error('inventory unavailable');
      (orderService.confirmOrderInTransaction as jest.Mock).mockImplementation(async () => {
        held -= 2;
        sold += 2;
        order.status = 'PAID';
        throw failure;
      });
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
      expect(stored).toMatchObject({
        status: 'FAILED',
        attemptGeneration: 1n,
        errorMessage: failure.message,
      });
      expect(order.status).toBe('PENDING');
      expect([held, sold]).toEqual([2, 0]);
      expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();

      (orderService.confirmOrderInTransaction as jest.Mock).mockImplementation(async () => {
        held -= 2;
        sold += 2;
        order.status = 'PAID';
        order.paymentStatus = 'SUCCEEDED';
        return { ...order };
      });
      await deliver();
      expect(stored).toMatchObject({
        status: 'PROCESSED',
        attemptGeneration: 2n,
        errorMessage: null,
      });
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(7);
      expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
      expect([held, sold]).toEqual([0, 2]);
      const completed = { ...stored },
        fulfilled = { ...order };
      await deliver();
      expect(stored).toEqual(completed);
      expect(order).toEqual(fulfilled);
      expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(7);
      expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    }
  );

  it('receipt failure preserves paid inventory and remains independently recoverable', async () => {
    (orderService.sendOrderConfirmationEmail as jest.Mock).mockRejectedValueOnce(
      new Error('email unavailable')
    );
    await deliver();
    expect(stored.status).toBe('PROCESSED');
    expect(order.status).toBe('PAID');
    expect(order.receiptStatus).toBe('PENDING');
    expect([held, sold]).toEqual([0, 2]);
    await deliver();
    expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(1);
    expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
    await (service as any).recoverReceipts();
    expect(orderService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(2);
    expect(orderService.confirmOrderInTransaction).toHaveBeenCalledTimes(1);
    expect([held, sold]).toEqual([0, 2]);
  });

  it('already-paid retry completes event bookkeeping without repeating fulfillment or receipt', async () => {
    stored = { id: event.id, status: 'FAILED', attemptGeneration: 1n };
    order.status = 'PAID';
    order.paymentStatus = 'SUCCEEDED';
    held = 0;
    sold = 2;
    await deliver();
    expect(stored).toMatchObject({ status: 'PROCESSED', attemptGeneration: 2n });
    expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
    expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect([held, sold]).toEqual([0, 2]);
  });

  it('lost webhook ownership stops before order writes, notifications or terminal bookkeeping', async () => {
    const originalRaw = db.$queryRaw.getMockImplementation();
    db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      if (sql.join('?').includes('attempt_generation'))
        return [{ status: 'PROCESSING', attempt_generation: 2n }];
      return originalRaw(sql);
    });
    await deliver();
    expect(stored).toMatchObject({ status: 'PROCESSING', attemptGeneration: 1n });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.paymentWebhookEvent.updateMany).not.toHaveBeenCalled();
    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
    expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('an unexpected succeeded payment queues a durable refund without fulfilling the order', async () => {
    event.data.object.id = 'pi_unexpected';
    const reconcile = jest.spyOn(service as any, 'reconcileRefund').mockResolvedValue(undefined);
    const before = { ...order };
    await deliver();
    expect(refund).toMatchObject({
      orderId: order.id,
      paymentIntentId: 'pi_unexpected',
      reason: 'UNEXPECTED_PAYMENT',
      amount: 1200,
      currency: 'cad',
    });
    expect(reconcile).toHaveBeenCalledWith('refund');
    expect(order).toEqual(before);
    expect([held, sold]).toEqual([2, 0]);
    expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
    expect(orderService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(stored.status).toBe('PROCESSED');
  });

  it.each([undefined, 'attempt'])(
    'an unbound legacy order without a committed attempt refunds safely (metadata=%s)',
    async (attemptId) => {
      order.paymentIntentId = null;
      order.paymentAttempt = null;
      if (attemptId === undefined) delete event.data.object.metadata.attemptId;
      else event.data.object.metadata.attemptId = attemptId;
      const reconcile = jest.spyOn(service as any, 'reconcileRefund').mockResolvedValue(undefined);
      await deliver();
      expect(order.paymentIntentId).toBeNull();
      expect(order.paymentAttempt).toBeNull();
      expect(db.paymentAttempt.update).not.toHaveBeenCalled();
      expect(order.status).toBe('PENDING');
      expect([held, sold]).toEqual([2, 0]);
      expect(refund).toMatchObject({
        reason: 'UNEXPECTED_PAYMENT',
        paymentIntentId: 'pi_recovery',
      });
      expect(reconcile).toHaveBeenCalledWith('refund');
      expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
      expect(stored.status).toBe('PROCESSED');
    }
  );

  it('only a matching committed attempt may bind an early webhook response', async () => {
    order.paymentIntentId = null;
    order.paymentAttempt.paymentIntentId = null;
    await deliver();
    expect(order.paymentIntentId).toBe('pi_recovery');
    expect(order.paymentAttempt.paymentIntentId).toBe('pi_recovery');
    expect(order.status).toBe('PAID');
    expect([held, sold]).toEqual([0, 2]);
  });

  it('an unlinked response with another attempt identity cannot bind or fulfill', async () => {
    order.paymentIntentId = null;
    order.paymentAttempt.paymentIntentId = null;
    event.data.object.metadata.attemptId = 'different-attempt';
    const reconcile = jest.spyOn(service as any, 'reconcileRefund').mockResolvedValue(undefined);
    await deliver();
    expect(order.paymentIntentId).toBeNull();
    expect(order.paymentAttempt.paymentIntentId).toBeNull();
    expect(order.status).toBe('PENDING');
    expect([held, sold]).toEqual([2, 0]);
    expect(refund).toMatchObject({ reason: 'UNEXPECTED_PAYMENT', paymentIntentId: 'pi_recovery' });
    expect(reconcile).toHaveBeenCalledWith('refund');
    expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'failure event notifies only a genuine pending transition (alreadyPaid=%s)',
    async (alreadyPaid) => {
      event.type = 'payment_intent.payment_failed';
      if (alreadyPaid) {
        order.status = 'PAID';
        order.paymentStatus = 'SUCCEEDED';
      }
      await deliver();
      expect(order.paymentStatus).toBe(alreadyPaid ? 'SUCCEEDED' : 'FAILED');
      expect(notificationService.sendEmail).toHaveBeenCalledTimes(alreadyPaid ? 0 : 1);
      expect(orderService.confirmOrderInTransaction).not.toHaveBeenCalled();
      expect(stored.status).toBe('PROCESSED');
    }
  );
});
