import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';
import { notificationService } from '../../utils/notificationService';
import { lockOrder } from '../../services/order-inventory.service';
import prisma from '../../config/prisma';

type WebhookClaim = { eventId: string; generation: bigint };
class WebhookOwnershipLost extends Error {}
const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;
// Policy #73: a durable late-paid exception never authorizes an automatic refund.
const LATE_PAYMENT_MANUAL_RECONCILIATION =
  'Manual reconciliation required: late payment; automatic refund prohibited.';
const REFUND_RECOVERY_BACKOFF_MS = 60_000;
const WEBHOOK_RECOVERY_BACKOFF_MS = 60_000;
const LEASE_MS = 5 * 60_000;
const IDEMPOTENCY_SAFE_MS = 23 * 60 * 60_000;
const cents = (value: { toString(): string }) => {
  const amount = Math.round(Number(value.toString()) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0) throw ApiError.conflict('Invalid order amount');
  return amount;
};

export class PaymentService {
  private stripe: Stripe | null = config.stripeSecretKey
    ? new Stripe(config.stripeSecretKey)
    : null;
  private provider(): Stripe {
    if (!this.stripe) throw new ApiError(503, 'Payment service is not configured.');
    return this.stripe;
  }

  async createPaymentIntent(
    orderId: string,
    userId: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const stripe = this.provider();
    // Commit the request identity before any external call. A lost response or
    // concurrent client request repeats precisely the same provider operation.
    const attempt = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { event: true } });
      if (!order || order.userId !== userId) throw ApiError.notFound('Order not found');
      if (
        order.status !== 'PENDING' ||
        order.paymentStatus === 'SUCCEEDED' ||
        (order.expiresAt && order.expiresAt <= new Date()) ||
        order.event.deletedAt ||
        !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(order.event.status)
      ) {
        throw ApiError.conflict('Order is no longer pending payment');
      }
      const amount = cents(order.totalAmount);
      if (amount === 0) throw ApiError.badRequest('Free orders do not need payment');
      const attempt = await tx.paymentAttempt.upsert({
        where: { orderId },
        create: {
          orderId,
          amount,
          currency: order.currency,
          paymentIntentId: order.paymentIntentId,
        },
        update: {},
      });
      if (attempt.amount !== amount || attempt.currency !== order.currency)
        throw ApiError.conflict('Payment preparation requires reconciliation');
      return { ...attempt, observedPaymentStatus: order.paymentStatus };
    });
    if (
      !attempt.paymentIntentId &&
      Date.now() - attempt.createdAt.getTime() >= IDEMPOTENCY_SAFE_MS
    ) {
      throw ApiError.conflict('Payment session needs reconciliation before it can be retried');
    }
    const intent = attempt.paymentIntentId
      ? await stripe.paymentIntents.retrieve(attempt.paymentIntentId)
      : await stripe.paymentIntents.create(
          {
            amount: attempt.amount,
            currency: attempt.currency,
            metadata: { orderId, userId, attemptId: attempt.id },
            automatic_payment_methods: { enabled: true },
          },
          { idempotencyKey: `payment-${attempt.id}` }
        );
    if (
      intent.amount !== attempt.amount ||
      intent.currency !== attempt.currency ||
      intent.metadata.orderId !== orderId ||
      intent.metadata.userId !== userId
    )
      throw ApiError.conflict('Payment session does not match the order');
    const pending = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (
        cents(order.totalAmount) !== attempt.amount ||
        order.currency !== attempt.currency ||
        order.paymentStatus === 'SUCCEEDED' ||
        (order.status === 'PENDING' &&
          ![attempt.observedPaymentStatus, 'PROCESSING'].includes(order.paymentStatus))
      )
        throw ApiError.conflict('Order changed during payment preparation');
      if (order.paymentIntentId && order.paymentIntentId !== intent.id)
        throw ApiError.conflict('Payment session changed');
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { paymentIntentId: intent.id },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentIntentId: intent.id,
          ...(order.status === 'PENDING' ? { paymentStatus: 'PROCESSING' } : {}),
        },
      });
      return order.status === 'PENDING' && (!order.expiresAt || order.expiresAt > new Date());
    });
    if (!pending || intent.status === 'canceled') {
      await this.reconcileIntent(intent);
      throw ApiError.conflict('Order is no longer pending payment');
    }
    if (
      !['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
        intent.status
      )
    ) {
      await this.reconcileIntent(intent);
      throw ApiError.conflict('Payment intent is not available for preparation');
    }
    if (!intent.client_secret) throw ApiError.internal('Payment session has no client secret');
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const stripe = this.provider();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
    } catch {
      throw ApiError.badRequest('Invalid webhook signature');
    }
    await this.processEvent(event);
  }

  private async processEvent(event: Stripe.Event): Promise<void> {
    const claim = await this.beginWebhookEvent(event);
    if (!claim) return;
    try {
      const intent = event.data.object as Stripe.PaymentIntent;
      if (event.type === 'payment_intent.succeeded') await this.handlePaymentSuccess(intent, claim);
      else if (event.type === 'payment_intent.payment_failed')
        await this.handlePaymentFailure(intent, claim);
      else if (event.type.startsWith('refund.') || event.type === 'charge.refunded') {
        // Existing refund records own their independent, idempotent reconciliation.
        await this.recoverRefunds();
      }
      await this.finishWebhookEvent(claim, 'PROCESSED');
    } catch (error) {
      if (error instanceof WebhookOwnershipLost) return;
      await this.finishWebhookEvent(claim, 'FAILED', error);
      throw error;
    }
  }

  private async beginWebhookEvent(event: Stripe.Event): Promise<WebhookClaim | null> {
    if (!event.id) throw ApiError.badRequest('Webhook event ID is required');
    const object = event.data.object as Stripe.PaymentIntent;
    const context = { paymentIntentId: object.id, orderId: object.metadata?.orderId };
    const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const cutoff = new Date(now.getTime() - 300_000);
    try {
      const existing = await prisma.paymentWebhookEvent.findUnique({ where: { id: event.id } });
      if (existing) {
        const expired =
          EXPIRED_WEBHOOK_RECOVERY_ENABLED &&
          existing.status === 'PROCESSING' &&
          existing.processingStartedAt !== null &&
          existing.processingStartedAt <= cutoff;
        if (!['RECEIVED', 'FAILED'].includes(existing.status) && !expired) return null;
        if (existing.attemptGeneration === 9223372036854775807n) return null;
        const admitted = await prisma.paymentWebhookEvent.updateMany({
          where: {
            id: event.id,
            attemptGeneration: existing.attemptGeneration,
            OR: [
              { status: { in: ['RECEIVED', 'FAILED'] } },
              ...(EXPIRED_WEBHOOK_RECOVERY_ENABLED
                ? [{ status: 'PROCESSING', processingStartedAt: { lte: cutoff } }]
                : []),
            ],
          },
          data: {
            status: 'PROCESSING',
            attemptGeneration: { increment: 1 },
            processingStartedAt: now,
            processedAt: null,
            errorMessage: null,
          },
        });
        return admitted.count === 1
          ? { eventId: event.id, generation: existing.attemptGeneration + 1n }
          : null;
      }
      await prisma.paymentWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          paymentIntentId: context.paymentIntentId || null,
          orderId: context.orderId || null,
          status: 'PROCESSING',
          attemptGeneration: 1n,
          processingStartedAt: now,
        },
      });
      return { eventId: event.id, generation: 1n };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return null;
      throw error;
    }
  }

  private async finishWebhookEvent(
    claim: WebhookClaim,
    status: 'PROCESSED' | 'FAILED',
    error?: unknown
  ): Promise<void> {
    const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    await prisma.paymentWebhookEvent.updateMany({
      where: { id: claim.eventId, status: 'PROCESSING', attemptGeneration: claim.generation },
      data: {
        status,
        processedAt: status === 'PROCESSED' ? now : null,
        updatedAt: now,
        leaseToken: null,
        errorMessage: error
          ? error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown webhook failure'
          : null,
      },
    });
  }

  /** Every webhook DB effect runs beneath the same event lock, then order lock.
   * No notification, retry backoff or test gate may wait in this transaction. */
  private async withWebhookFence<T>(
    claim: WebhookClaim,
    orderId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string; attempt_generation: bigint }>>`
        SELECT status, attempt_generation
        FROM payment_webhook_events WHERE id = ${claim.eventId} FOR UPDATE`;
      // Sample live eligibility only AFTER acquiring the row lock (not before a lock wait).
      const lease = await tx.$queryRaw<Array<{ live: boolean }>>`
        SELECT processing_started_at > clock_timestamp() - interval '300 seconds' AS live
        FROM payment_webhook_events WHERE id = ${claim.eventId}`;
      const row = rows[0];
      if (
        !row ||
        row.status !== 'PROCESSING' ||
        row.attempt_generation !== claim.generation ||
        !lease[0]?.live
      ) {
        throw new WebhookOwnershipLost('Webhook ownership lost');
      }
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      return work(tx);
    });
  }

  private orderTransaction<T>(
    claim: WebhookClaim | undefined,
    orderId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    if (claim) return this.withWebhookFence(claim, orderId, work);
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      return work(tx);
    });
  }

  private async handlePaymentSuccess(
    intent: Stripe.PaymentIntent,
    claim?: WebhookClaim
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId) throw ApiError.conflict('Payment has no order identity');
    if (intent.status !== 'succeeded' || intent.amount_received !== intent.amount)
      throw ApiError.conflict('Payment has not fully succeeded');
    let outcome: { receipt: boolean; refundId?: string } = { receipt: false };
    try {
      const { withRetry } = await import('../../utils/retry');
      outcome = await withRetry(
        () =>
          this.orderTransaction(claim, orderId, async (tx) => {
            const order = await tx.order.findUnique({
              where: { id: orderId },
              include: { paymentAttempt: true },
            });
            if (!order) throw ApiError.conflict('Payment order is missing');
            const queueRefund = async (reason: string) => {
              const record = await tx.paymentRefund.upsert({
                where: { paymentIntentId: intent.id },
                create: {
                  orderId,
                  paymentIntentId: intent.id,
                  amount: intent.amount_received,
                  currency: intent.currency,
                  reason,
                  ...(reason === 'LATE_PAYMENT'
                    ? { errorMessage: LATE_PAYMENT_MANUAL_RECONCILIATION }
                    : {}),
                },
                update:
                  reason === 'LATE_PAYMENT'
                    ? { errorMessage: LATE_PAYMENT_MANUAL_RECONCILIATION }
                    : {},
              });
              // Manual late-paid evidence is not executable refund work.
              return reason === 'LATE_PAYMENT'
                ? { receipt: false }
                : { receipt: false, refundId: record.id };
            };
            // Bind an early response only to the previously committed provider operation.
            if (
              !order.paymentIntentId &&
              order.paymentAttempt &&
              order.paymentAttempt.id === intent.metadata.attemptId
            ) {
              await tx.order.update({
                where: { id: orderId },
                data: { paymentIntentId: intent.id },
              });
              await tx.paymentAttempt.update({
                where: { orderId },
                data: { paymentIntentId: intent.id },
              });
            } else if (order.paymentIntentId !== intent.id)
              return queueRefund('UNEXPECTED_PAYMENT');
            if (intent.amount !== cents(order.totalAmount) || intent.currency !== order.currency) {
              if (order.status === 'PENDING')
                await orderService.cancelOrderInTransaction(tx, orderId);
              return queueRefund('INCORRECT_AMOUNT');
            }
            if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED')
              return { receipt: false };
            await tx.$queryRaw`SELECT id FROM events WHERE id = ${order.eventId} FOR UPDATE`;
            const event = await tx.event.findUniqueOrThrow({ where: { id: order.eventId } });
            if (
              order.status !== 'PENDING' ||
              (order.expiresAt && order.expiresAt <= new Date()) ||
              event.deletedAt ||
              !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(event.status)
            ) {
              if (order.status === 'PENDING')
                await orderService.cancelOrderInTransaction(tx, orderId);
              return queueRefund('LATE_PAYMENT');
            }
            await orderService.confirmOrderInTransaction(tx, orderId);
            return { receipt: true };
          }),
        {
          maxRetries: 5,
          initialDelay: config.nodeEnv === 'test' ? 10 : 2000,
          shouldRetry: (error) => !(error instanceof WebhookOwnershipLost),
        }
      );
    } catch (error) {
      if (error instanceof WebhookOwnershipLost) throw error;
      logger.error(`Critical: Failed to confirm order ${orderId}: ${error}`);
      await notificationService
        .sendAdminAlert(
          'Order Confirmation Failure',
          `Order ${orderId} failed to confirm after payment succeeded. Reconciliation will retry.`
        )
        .catch(() => false);
      throw error;
    }
    // The committed durable request owns the processor call even if this worker
    // subsequently loses its webhook lease. No provider I/O occurs under DB locks.
    if (outcome.refundId) await this.reconcileRefund(outcome.refundId);
    if (outcome.receipt)
      await orderService
        .sendOrderConfirmationEmail(orderId)
        .catch((error) => logger.error(`Receipt delivery failed for order ${orderId}: ${error}`));
  }

  private async handlePaymentFailure(
    intent: Stripe.PaymentIntent,
    claim?: WebhookClaim
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId) return;
    const recipient = await this.orderTransaction(claim, orderId, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true } } },
      });
      if (
        !order ||
        order.paymentIntentId !== intent.id ||
        order.status !== 'PENDING' ||
        order.paymentStatus === 'SUCCEEDED'
      )
        return null;
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
          paymentIntentId: intent.id,
          paymentStatus: { not: 'SUCCEEDED' },
        },
        data: { paymentStatus: 'FAILED' },
      });
      return updated.count ? { email: order.user.email, orderNumber: order.orderNumber } : null;
    });
    if (recipient)
      await notificationService
        .sendEmail({
          to: recipient.email,
          subject: 'Payment Failed',
          text: `Your payment for order ${recipient.orderNumber} could not be processed. You can retry during the reservation window.`,
          html: '<p>Your payment could not be processed. You can retry during the reservation window.</p>',
        })
        .catch((error) => logger.error(`Payment failure notification failed: ${error}`));
  }

  async refundOrder(orderId: string) {
    const order = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const current = await tx.order.findUnique({
        where: { id: orderId },
        include: { tickets: true, event: true },
      });
      if (!current) throw ApiError.notFound('Order not found');
      if (current.status === 'REFUNDED') return current;
      if (current.status !== 'PAID') throw ApiError.badRequest('Only PAID orders can be refunded');
      // Beta policy: full order only. Freeze admission and transfer before the
      // external request. Cancellation of an event permits its cancelled tickets.
      if (
        current.tickets.some(
          (t) =>
            t.status === 'USED' ||
            t.transferredAt ||
            t.userId !== current.userId ||
            t.inventoryState !== 'SOLD' ||
            (t.status !== 'VALID' &&
              !(current.event.status === 'CANCELLED' && t.status === 'CANCELLED'))
        )
      ) {
        throw ApiError.badRequest('Full refunds require unused, untransferred tickets');
      }
      if (
        current.event.startDatetime &&
        current.event.startDatetime <= new Date() &&
        current.event.status !== 'CANCELLED'
      )
        throw ApiError.badRequest('Refund window has ended');
      if (!current.totalAmount.eq(0) && !current.paymentIntentId)
        throw ApiError.conflict('Order has no processor payment to refund');
      if (!current.totalAmount.eq(0)) {
        this.provider();
        await tx.paymentRefund.upsert({
          where: { paymentIntentId: current.paymentIntentId! },
          create: {
            orderId,
            paymentIntentId: current.paymentIntentId!,
            amount: cents(current.totalAmount),
            currency: current.currency,
            reason: 'ORDER_REFUND',
          },
          update: {},
        });
      }
      return tx.order.update({ where: { id: orderId }, data: { refundStatus: 'PROCESSING' } });
    });
    if (order.status === 'REFUNDED') return order;
    if (order.totalAmount.eq(0)) return orderService.finalizeRefund(orderId);
    const intent = await this.provider().paymentIntents.retrieve(order.paymentIntentId!);
    if (
      intent.status !== 'succeeded' ||
      intent.amount_received !== cents(order.totalAmount) ||
      intent.currency !== order.currency
    )
      throw ApiError.conflict('Processor payment needs reconciliation');
    await this.ensureRefund(orderId, intent, 'ORDER_REFUND');
    return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  private async ensureRefund(
    orderId: string,
    intent: Stripe.PaymentIntent,
    reason: string
  ): Promise<void> {
    const refund = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      return tx.paymentRefund.upsert({
        where: { paymentIntentId: intent.id },
        create: {
          orderId,
          paymentIntentId: intent.id,
          amount: intent.amount_received,
          currency: intent.currency,
          reason,
        },
        update: {},
      });
    });
    await this.reconcileRefund(refund.id);
  }

  private async reconcileRefund(id: string): Promise<void> {
    const record = await prisma.paymentRefund.findUniqueOrThrow({ where: { id } });
    // Also block legacy rows and stale background selections before provider access.
    if (record.reason === 'LATE_PAYMENT') return;
    const stripe = this.provider();
    if (record.status === 'SUCCEEDED') {
      if (record.reason === 'ORDER_REFUND') await orderService.finalizeRefund(record.orderId);
      else
        await prisma.order.updateMany({
          where: {
            id: record.orderId,
            status: 'CANCELLED',
            paymentIntentId: record.paymentIntentId,
          },
          data: { paymentClosedAt: new Date(), paymentStatus: 'SUCCEEDED' },
        });
      return;
    }
    const intent = await stripe.paymentIntents.retrieve(record.paymentIntentId);
    if (
      intent.status !== 'succeeded' ||
      intent.amount_received !== record.amount ||
      intent.currency !== record.currency
    ) {
      throw ApiError.conflict('Processor payment needs reconciliation before refunding');
    }
    let refund: Stripe.Refund;
    if (record.stripeRefundId) refund = await stripe.refunds.retrieve(record.stripeRefundId);
    else {
      // A response may have been lost. Check the processor before repeating an
      // idempotent request, and never create anew beyond its retention window.
      const previous = await stripe.refunds.list({
        payment_intent: record.paymentIntentId,
        limit: 100,
      });
      const existing = previous.data.find((r) => r.metadata?.refundId === record.id);
      if (existing) refund = existing;
      else {
        if (Date.now() - record.createdAt.getTime() >= IDEMPOTENCY_SAFE_MS) {
          throw ApiError.conflict('Refund requires processor reconciliation');
        }
        refund = await stripe.refunds.create(
          {
            payment_intent: record.paymentIntentId,
            amount: record.amount,
            metadata: { refundId: record.id, orderId: record.orderId },
          },
          { idempotencyKey: `refund-${record.id}` }
        );
      }
    }
    if (
      refund.amount !== record.amount ||
      refund.currency !== record.currency ||
      (typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : refund.payment_intent?.id) !== record.paymentIntentId
    ) {
      throw ApiError.conflict('Processor refund does not match the request');
    }
    const status =
      refund.status === 'succeeded'
        ? 'SUCCEEDED'
        : ['failed', 'canceled'].includes(refund.status || '')
          ? 'FAILED'
          : 'PROCESSING';
    await prisma.paymentRefund.update({
      where: { id },
      data: {
        stripeRefundId: refund.id,
        status,
        errorMessage: refund.failure_reason || null,
      },
    });
    if (status === 'SUCCEEDED' && record.reason !== 'ORDER_REFUND') {
      await prisma.order.updateMany({
        where: { id: record.orderId, status: 'CANCELLED', paymentIntentId: record.paymentIntentId },
        data: { paymentClosedAt: new Date(), paymentStatus: 'SUCCEEDED' },
      });
    }
    if (record.reason === 'ORDER_REFUND') {
      if (status === 'SUCCEEDED') await orderService.finalizeRefund(record.orderId);
      else
        await prisma.order.updateMany({
          where: { id: record.orderId, status: 'PAID' },
          data: { refundStatus: status },
        });
    }
  }

  private async reconcileIntent(intent: Stripe.PaymentIntent): Promise<void> {
    if (intent.status === 'succeeded') {
      await this.handlePaymentSuccess(intent);
      await prisma.order.updateMany({
        where: { paymentIntentId: intent.id, status: 'CANCELLED' },
        data: { paymentStatus: 'SUCCEEDED' },
      });
    } else if (intent.status === 'canceled') {
      const order = await prisma.order.findUnique({
        where: { id: intent.metadata?.orderId || '' },
      });
      if (order?.status === 'PENDING' && order.paymentIntentId === intent.id)
        await orderService.cancelOrder(order.id);
      await prisma.order.updateMany({
        where: { paymentIntentId: intent.id, status: 'CANCELLED' },
        data: { paymentStatus: 'FAILED', paymentClosedAt: new Date() },
      });
    } else if (!['canceled', 'processing'].includes(intent.status)) {
      const order = await prisma.order.findUnique({
        where: { id: intent.metadata?.orderId || '' },
      });
      if (order?.status === 'CANCELLED') {
        const current = await this.provider().paymentIntents.retrieve(intent.id);
        if (current.status === 'succeeded') await this.handlePaymentSuccess(current);
        else if (current.status !== 'processing' && current.status !== 'canceled') {
          await this.provider().paymentIntents.cancel(intent.id);
          await prisma.order.updateMany({
            where: { paymentIntentId: intent.id, status: 'CANCELLED' },
            data: { paymentStatus: 'FAILED', paymentClosedAt: new Date() },
          });
        }
      }
    }
  }

  async recoverRefunds(): Promise<void> {
    const records = await prisma.paymentRefund.findMany({
      where: {
        // Existing late-paid rows remain visible as owned manual exceptions,
        // not automatic work (and must not starve the bounded recovery queue).
        reason: { not: 'LATE_PAYMENT' },
        updatedAt: { lte: new Date(Date.now() - REFUND_RECOVERY_BACKOFF_MS) },
        OR: [
          { status: { in: ['REQUESTED', 'PROCESSING', 'FAILED'] } },
          { status: 'SUCCEEDED', reason: 'ORDER_REFUND', order: { status: 'PAID' } },
          {
            status: 'SUCCEEDED',
            reason: { not: 'ORDER_REFUND' },
            order: { status: 'CANCELLED', paymentClosedAt: null },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const record of records) {
      try {
        await this.reconcileRefund(record.id);
      } catch (error) {
        logger.error(`Refund reconciliation failed for ${record.id}: ${error}`);
        // Rotate poison work and expose an owned exception without copying provider
        // errors or changing money/status. CAS cannot overwrite a newer result.
        await prisma.paymentRefund.updateMany({
          where: { id: record.id, updatedAt: record.updatedAt },
          data: {
            updatedAt: new Date(),
            errorMessage:
              'Recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.',
          },
        });
      }
    }
  }

  private async recoverReceipts(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        receiptSentAt: null,
        OR: [
          { receiptStatus: 'PENDING' },
          {
            receiptStatus: 'PROCESSING',
            receiptStartedAt: { lt: new Date(Date.now() - LEASE_MS) },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const order of orders) {
      try {
        await orderService.sendOrderConfirmationEmail(order.id);
      } catch (error) {
        logger.error(`Receipt recovery failed for ${order.id}: ${error}`);
        await prisma.order.update({ where: { id: order.id }, data: { updatedAt: new Date() } });
      }
    }
  }

  async recoverPayments(): Promise<void> {
    await this.recoverReceipts();
    if (!this.stripe) return;
    const events = await prisma.paymentWebhookEvent.findMany({
      where: {
        updatedAt: { lte: new Date(Date.now() - WEBHOOK_RECOVERY_BACKOFF_MS) },
        OR: [
          { status: { in: ['RECEIVED', 'FAILED'] } },
          { status: 'PROCESSING', processingStartedAt: { lt: new Date(Date.now() - LEASE_MS) } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const event of events) {
      try {
        await this.processEvent(await this.stripe.events.retrieve(event.id));
      } catch (error) {
        logger.error(`Webhook reconciliation failed for ${event.id}: ${error}`);
        // Provider retrieval can fail before processEvent claims the event. Rotate
        // that poison work without claiming effects or modifying lease/status.
        // A newer claim/result must never be overwritten by this stale selection.
        await prisma.paymentWebhookEvent.updateMany({
          where: {
            id: event.id,
            updatedAt: event.updatedAt,
            status: event.status,
            attemptGeneration: event.attemptGeneration,
          },
          data: {
            updatedAt: new Date(),
            errorMessage:
              'Webhook recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.',
          },
        });
      }
    }
    const lost = await prisma.paymentAttempt.findMany({
      where: { paymentIntentId: null, createdAt: { lt: new Date(Date.now() - 60_000) } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const attempt of lost) {
      try {
        const found = await this.stripe.paymentIntents.search({
          query: `metadata['attemptId']:'${attempt.id}'`,
          limit: 100,
        });
        for (const intent of found.data) {
          if (
            intent.metadata.orderId !== attempt.orderId ||
            intent.amount !== attempt.amount ||
            intent.currency !== attempt.currency
          )
            continue;
          await prisma.$transaction(async (tx) => {
            await lockOrder(tx, attempt.orderId);
            const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
            if (order.paymentIntentId && order.paymentIntentId !== intent.id)
              throw ApiError.conflict('Payment session changed');
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: { paymentIntentId: intent.id },
            });
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentIntentId: intent.id,
                ...(order.status === 'PENDING' ? { paymentStatus: 'PROCESSING' } : {}),
              },
            });
          });
          await this.reconcileIntent(intent);
        }
      } catch (error) {
        logger.error(`Lost payment reconciliation failed for ${attempt.id}: ${error}`);
      }
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { updatedAt: new Date() },
      });
    }
    // Covers a lost webhook and a cancelled reservation whose processor was
    // still processing. No client secrets or full webhook payloads are stored.
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ status: 'PENDING' }, { status: 'CANCELLED', paymentClosedAt: null }],
        paymentIntentId: { not: null },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const order of orders) {
      try {
        await this.reconcileIntent(
          await this.stripe.paymentIntents.retrieve(order.paymentIntentId!)
        );
      } catch (error) {
        logger.error(`Payment reconciliation failed for ${order.id}: ${error}`);
      }
      await prisma.order.update({ where: { id: order.id }, data: { updatedAt: new Date() } });
    }
    await this.recoverRefunds();
  }
}

export const paymentService = new PaymentService();
