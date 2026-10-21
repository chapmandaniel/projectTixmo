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
// Enabled only with generation CAS and transaction-scoped effect fencing.
const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;

const getPaymentIntentContext = (event: Stripe.Event) => {
  const value = event.data.object as Partial<Stripe.PaymentIntent>;
  return {
    paymentIntentId: value.id,
    orderId: value.metadata?.orderId,
  };
};

// Policy #73: this durable exception is not permission to issue a refund.
const LATE_PAYMENT_MANUAL_RECONCILIATION =
  'Manual reconciliation required: late payment; automatic refund prohibited.';

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
        throw ApiError.conflict('Order changed after payment preparation');
      if (!order.paymentIntentId && Date.now() - order.createdAt.getTime() >= IDEMPOTENCY_SAFE_MS)
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
          { idempotencyKey: `order-payment-v1:${orderId}` }
        );
    if (
      intent.amount !== attempt.amount ||
      intent.currency !== attempt.currency ||
      intent.metadata.orderId !== orderId ||
      intent.metadata.userId !== userId
    )
      throw ApiError.conflict('Payment session does not match the order');
    if (
      !['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
        intent.status
      )
    )
      throw ApiError.conflict('Payment intent is not available for preparation');
    const pending = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (
        order.userId !== userId ||
        cents(order.totalAmount) !== attempt.amount ||
        order.currency !== attempt.currency
      )
        throw ApiError.conflict('Order changed during payment preparation');
      if (
        order.status !== 'PENDING' ||
        order.paymentStatus === 'SUCCEEDED' ||
        (order.paymentStatus !== attempt.observedPaymentStatus &&
          order.paymentStatus !== 'PROCESSING')
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
          paymentStatus: 'PROCESSING',
        },
      });
      return !order.expiresAt || order.expiresAt > new Date();
    });
    if (!pending || intent.status === 'canceled') {
      await this.reconcileIntent(intent);
      throw ApiError.conflict('Order is no longer pending payment');
    }
    if (!intent.client_secret) throw ApiError.internal('Payment session has no client secret');
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const stripe = this.provider();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : error === null
              ? 'null'
              : error === undefined
                ? 'undefined'
                : 'Unknown signature failure';
      throw ApiError.badRequest(`Webhook Error: ${message}`);
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
      else if (event.type === 'payment_intent.canceled')
        await this.handlePaymentCancellation(intent, claim);
      // Refund webhooks only wake the separately durable, idempotent refund reconciler.
      else if (event.type.startsWith('refund.') || event.type === 'charge.refunded')
        await this.recoverRefunds();
      await this.finishWebhookEvent(claim, 'PROCESSED');
    } catch (error) {
      if (error instanceof WebhookOwnershipLost) return;
      await this.finishWebhookEvent(claim, 'FAILED', error);
      throw error;
    }
  }

  private async beginWebhookEvent(event: Stripe.Event): Promise<WebhookClaim | null> {
    if (!event.id) throw ApiError.badRequest('Webhook event ID is required');
    const context = getPaymentIntentContext(event);
    const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const cutoff = new Date(now.getTime() - 300_000);
    try {
      const existing = await prisma.paymentWebhookEvent.findUnique({ where: { id: event.id } });
      if (existing) {
        const expired =
          EXPIRED_WEBHOOK_RECOVERY_ENABLED &&
          existing.status === 'PROCESSING' &&
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
    await prisma.paymentWebhookEvent.updateMany({
      where: { id: claim.eventId, status: 'PROCESSING', attemptGeneration: claim.generation },
      data: {
        status,
        processedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : error
                ? 'Unknown processing error'
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

  private async handlePaymentSuccess(
    intent: Stripe.PaymentIntent,
    claim: WebhookClaim
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId) throw ApiError.conflict('Payment has no order identity');
    if (intent.status !== 'succeeded' || intent.amount_received !== intent.amount)
      throw ApiError.conflict('Payment has not fully succeeded');
    let outcome: { confirmed: boolean; refundId?: string } = { confirmed: false };
    let ownershipLost: WebhookOwnershipLost | undefined;
    try {
      const { withRetry } = await import('../../utils/retry');
      await withRetry(
        async () => {
          outcome = await this.withWebhookFence(claim, orderId, async (tx) => {
            // All authorization/binding/terminal checks occur AFTER event and order locks.
            const order = await tx.order.findUnique({
              where: { id: orderId },
              include: { paymentAttempt: true, event: true },
            });
            if (!order) throw ApiError.conflict('Payment order is missing');
            if (!order.paymentIntentId && order.paymentAttempt?.id === intent.metadata.attemptId) {
              await tx.order.update({
                where: { id: orderId },
                data: { paymentIntentId: intent.id },
              });
              await tx.paymentAttempt.update({
                where: { orderId },
                data: { paymentIntentId: intent.id },
              });
            } else if (order.paymentIntentId !== intent.id) {
              const refund = await this.recordRefund(tx, orderId, intent, 'UNEXPECTED_PAYMENT');
              return { confirmed: false, refundId: refund.id };
            }
            if (intent.amount !== cents(order.totalAmount) || intent.currency !== order.currency) {
              const refund = await this.recordRefund(tx, orderId, intent, 'INCORRECT_AMOUNT');
              if (order.status === 'PENDING')
                await orderService.cancelOrderInTransaction(tx, orderId);
              return { confirmed: false, refundId: refund.id };
            }
            if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED')
              return { confirmed: false };
            if (
              order.status !== 'PENDING' ||
              (order.expiresAt && order.expiresAt <= new Date()) ||
              order.event.deletedAt ||
              !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(order.event.status)
            ) {
              if (order.status === 'PENDING')
                await orderService.cancelOrderInTransaction(tx, orderId);
              await this.recordRefund(tx, orderId, intent, 'LATE_PAYMENT');
              return { confirmed: false };
            }
            await orderService.confirmOrderInTransaction(tx, orderId);
            return { confirmed: true };
          }).catch((error) => {
            // Ownership loss is terminal for THIS owner, never a reason to retry effects.
            if (error instanceof WebhookOwnershipLost) {
              ownershipLost = error;
              return { confirmed: false };
            }
            throw error;
          });
        },
        { maxRetries: 5, initialDelay: config.nodeEnv === 'test' ? 10 : 2000 }
      );
      if (ownershipLost) throw ownershipLost;
    } catch (error) {
      if (error instanceof WebhookOwnershipLost) throw error;
      try {
        await notificationService.sendAdminAlert(
          'Order Confirmation Failure',
          `Order ${orderId} failed after payment succeeded. Manual intervention required. Error: ${error}`
        );
      } catch (alertError) {
        logger.error(`Failed to alert admin: ${alertError}`);
      }
      throw error;
    }
    // Durable refund intent was recorded while ownership was live. External delivery
    // is outside the event transaction, and is safe to resume using its stable key.
    if (outcome.refundId) await this.reconcileRefund(outcome.refundId);
    if (outcome.confirmed)
      await orderService.sendOrderConfirmationEmail(orderId).catch(async (error: unknown) => {
        logger.error(`Receipt delivery failed for order ${orderId}: ${error}`);
        try {
          await notificationService.sendAdminAlert(
            'Order Confirmation Email Failure',
            `Order ${orderId} is confirmed; receipt delivery will retry. Do not reconfirm inventory.`
          );
        } catch (alertError) {
          logger.error(`Failed to alert admin: ${alertError}`);
        }
      });
  }

  private async handlePaymentFailure(
    intent: Stripe.PaymentIntent,
    claim: WebhookClaim
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId) return;
    const recipient = await this.withWebhookFence(claim, orderId, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true } }, paymentAttempt: true },
      });
      if (!order) return undefined;
      const early =
        !order.paymentIntentId &&
        order.status === 'PENDING' &&
        order.paymentAttempt?.id === intent.metadata.attemptId &&
        intent.amount === cents(order.totalAmount) &&
        intent.currency === order.currency;
      if (order.paymentIntentId !== intent.id && !early) return undefined;
      if (early) {
        await tx.paymentAttempt.update({
          where: { orderId },
          data: { paymentIntentId: intent.id },
        });
      }
      const result = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentIntentId: early ? null : intent.id,
          paymentStatus: { not: 'SUCCEEDED' },
        },
        data: { paymentStatus: 'FAILED', paymentIntentId: intent.id },
      });
      return result.count ? order.user.email : undefined;
    });
    if (recipient)
      await notificationService
        .sendEmail({
          to: recipient,
          subject: 'Payment Failed',
          html: `<p>Your payment for order ${orderId} could not be processed. Please try again.</p>`,
          text: `Your payment for order ${orderId} could not be processed. Please try again.`,
        })
        .catch((error) => logger.error(`Payment failure notification failed: ${error}`));
  }

  private recordRefund(
    tx: Prisma.TransactionClient,
    orderId: string,
    intent: Stripe.PaymentIntent,
    reason: string
  ) {
    return tx.paymentRefund.upsert({
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
      update: reason === 'LATE_PAYMENT'
        ? { errorMessage: LATE_PAYMENT_MANUAL_RECONCILIATION }
        : {},
    });
  }

  // Reconciliation is an internal ingress, not an exemption from ownership.
  // A stable synthetic event serializes all workers through the identical fence.
  private reconcileSuccess(intent: Stripe.PaymentIntent): Promise<void> {
    return this.processEvent({
      id: `reconcile-success:${intent.id}`,
      type: 'payment_intent.succeeded',
      data: { object: intent },
    } as Stripe.Event);
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
    // Defense for legacy rows, stale recovery selections and every internal caller.
    // Preserve provider identities/status as evidence; never finalize/close this exception.
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
    // A slower provider response must not regress another worker's terminal success.
    const saved = await prisma.paymentRefund.updateMany({
      where: { id, status: { not: 'SUCCEEDED' } },
      data: {
        stripeRefundId: refund.id,
        status,
        errorMessage: refund.failure_reason || null,
      },
    });
    const effectiveStatus = saved.count
      ? status
      : (await prisma.paymentRefund.findUniqueOrThrow({ where: { id } })).status;
    if (effectiveStatus === 'SUCCEEDED' && record.reason !== 'ORDER_REFUND') {
      await prisma.order.updateMany({
        where: { id: record.orderId, status: 'CANCELLED', paymentIntentId: record.paymentIntentId },
        data: { paymentClosedAt: new Date(), paymentStatus: 'SUCCEEDED' },
      });
    }
    if (record.reason === 'ORDER_REFUND') {
      if (effectiveStatus === 'SUCCEEDED') await orderService.finalizeRefund(record.orderId);
      else
        await prisma.order.updateMany({
          where: { id: record.orderId, status: 'PAID' },
          data: { refundStatus: effectiveStatus },
        });
    }
  }

  private async reconcileCancellation(intent: Stripe.PaymentIntent): Promise<void> {
    if (intent.status !== 'canceled')
      throw ApiError.conflict('Processor cancellation is not confirmed');
    await this.processEvent({
      id: `reconcile-canceled:${intent.id}`,
      type: 'payment_intent.canceled',
      data: { object: intent },
    } as Stripe.Event);
  }

  private async handlePaymentCancellation(
    intent: Stripe.PaymentIntent,
    claim: WebhookClaim
  ): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId || intent.status !== 'canceled') return;
    await this.withWebhookFence(claim, orderId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.paymentIntentId !== intent.id) return;
      if (order.status === 'PENDING') await orderService.cancelOrderInTransaction(tx, orderId);
      await tx.order.updateMany({
        where: {
          id: orderId,
          paymentIntentId: intent.id,
          status: 'CANCELLED',
          paymentStatus: { not: 'SUCCEEDED' },
        },
        data: { paymentStatus: 'FAILED', paymentClosedAt: new Date() },
      });
    });
  }

  private async reconcileIntent(intent: Stripe.PaymentIntent): Promise<void> {
    if (intent.status === 'succeeded') await this.reconcileSuccess(intent);
    else if (intent.status === 'canceled') await this.reconcileCancellation(intent);
    else if (intent.status !== 'processing') {
      const order = await prisma.order.findUnique({
        where: { id: intent.metadata?.orderId || '' },
      });
      if (order?.status === 'CANCELLED' && order.paymentIntentId === intent.id) {
        const current = await this.provider().paymentIntents.retrieve(intent.id);
        if (current.status === 'succeeded') await this.reconcileSuccess(current);
        else if (current.status === 'canceled') await this.reconcileCancellation(current);
        else if (current.status !== 'processing') {
          // Cancellation is provider-idempotent. Commit its result through a new
          // owned event, never mutate inventory from the pre-provider snapshot.
          await this.reconcileCancellation(await this.provider().paymentIntents.cancel(intent.id));
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
    for (const record of records)
      await this.reconcileRefund(record.id).catch((error) =>
        logger.error(`Refund reconciliation failed for ${record.id}: ${error}`)
      );
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
        if (event.id.startsWith('reconcile-') && event.paymentIntentId) {
          const intent = await this.stripe.paymentIntents.retrieve(event.paymentIntentId);
          if (event.type === 'payment_intent.succeeded' && intent.status === 'succeeded')
            await this.reconcileSuccess(intent);
          else if (event.type === 'payment_intent.canceled' && intent.status === 'canceled')
            await this.reconcileCancellation(intent);
        } else await this.processEvent(await this.stripe.events.retrieve(event.id));
      } catch (error) {
        logger.error(`Webhook reconciliation failed for ${event.id}: ${error}`);
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
                ...(order.status === 'PENDING' && order.paymentStatus !== 'SUCCEEDED'
                  ? { paymentStatus: 'PROCESSING' }
                  : {}),
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
