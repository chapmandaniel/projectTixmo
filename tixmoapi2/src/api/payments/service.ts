import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';
import { notificationService } from '../../utils/notificationService';
import prisma from '../../config/prisma';

type WebhookClaim = { eventId: string; generation: bigint };
class WebhookOwnershipLost extends Error {}
class PaymentIntentMismatch extends Error {}
// Deliberately disabled until task143 deterministic recovery acceptance is complete.
const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;

const getPaymentIntentContext = (event: Stripe.Event) => {
  const value = event.data.object as Partial<Stripe.PaymentIntent>;
  return {
    paymentIntentId: value.id,
    orderId: value.metadata?.orderId,
  };
};

export class PaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    if (config.stripeSecretKey) {
      this.stripe = new Stripe(config.stripeSecretKey);
    } else {
      logger.warn('⚠️ STRIPE_SECRET_KEY not provided. Payment features will be disabled.');
    }
  }

  /**
   * Create a payment intent for an order
   */
  async createPaymentIntent(
    orderId: string,
    userId: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!this.stripe) {
      throw new ApiError(503, 'Payment service is not configured (Missing Stripe Key).');
    }

    const order = await orderService.getOrderById(orderId, userId);

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status !== 'PENDING' || order.paymentStatus === 'SUCCEEDED') {
      throw ApiError.badRequest('Order is not pending payment');
    }

    // Calculate amount in cents (Stripe uses smallest currency unit)
    // Assuming order.totalAmount is Decimal
    const amount = Math.round(Number(order.totalAmount) * 100);

    const currency = config.paymentCurrency.toLowerCase();
    // Stripe retains keys for at least 24h. Refuse an unlinked old order:
    // its earlier create may have succeeded even if neither response nor DB write did.
    if (!order.paymentIntentId && Date.now() - order.createdAt.getTime() >= 23 * 60 * 60 * 1000) {
      throw new ApiError(409, 'Payment preparation requires reconciliation');
    }

    const paymentIntent = order.paymentIntentId
      ? await this.stripe.paymentIntents.retrieve(order.paymentIntentId)
      : await this.stripe.paymentIntents.create({
          amount,
          currency,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: order.userId,
          },
          automatic_payment_methods: { enabled: true },
        }, {
          // Deliberately order-only: changing amount/currency must conflict with
          // the original request, not mint a second intent after a lost response.
          idempotencyKey: `order-payment-v1:${order.id}`,
        });

    if (paymentIntent.amount !== amount || paymentIntent.currency !== currency ||
        paymentIntent.metadata.orderId !== order.id || paymentIntent.metadata.userId !== order.userId) {
      throw new ApiError(409, 'Payment intent does not match order');
    }
    if (!['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
      // Processing/succeeded/canceled intents must be reconciled, never replaced.
      throw new ApiError(409, 'Payment intent is not available for preparation');
    }
    if (!paymentIntent.client_secret) {
      throw new ApiError(500, 'Failed to create payment intent');
    }

    const saved = await prisma.order.updateMany({
      where: {
        id: order.id,
        userId,
        status: 'PENDING',
        totalAmount: order.totalAmount,
        paymentStatus: { in: [order.paymentStatus, 'PROCESSING'] },
        OR: [{ paymentIntentId: null }, { paymentIntentId: paymentIntent.id }],
      },
      data: { paymentIntentId: paymentIntent.id, paymentStatus: 'PROCESSING' },
    });
    if (saved.count !== 1) {
      throw new ApiError(409, 'Order changed during payment preparation');
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    if (!this.stripe) {
      throw new ApiError(503, 'Payment service is not configured.');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError(400, `Webhook Error: ${message}`);
    }

    const claim = await this.beginWebhookEvent(event);
    if (!claim) {
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          await this.handlePaymentSuccess(paymentIntent, claim);
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentFailed = event.data.object;
          await this.handlePaymentFailure(paymentFailed, claim);
          break;
        }
        default:
          logger.info(`Unhandled event type ${event.type}`);
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
    const context = getPaymentIntentContext(event);
    const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const cutoff = new Date(now.getTime() - 300_000);
    try {
      const existing = await prisma.paymentWebhookEvent.findUnique({ where: { id: event.id } });
      if (existing) {
        const expired = EXPIRED_WEBHOOK_RECOVERY_ENABLED && existing.status === 'PROCESSING' &&
          existing.processingStartedAt <= cutoff;
        if (existing.status !== 'FAILED' && !expired) return null;
        if (existing.attemptGeneration === 9223372036854775807n) return null;
        const admitted = await prisma.paymentWebhookEvent.updateMany({
          where: {
            id: event.id, attemptGeneration: existing.attemptGeneration,
            OR: [{ status: 'FAILED' }, ...(EXPIRED_WEBHOOK_RECOVERY_ENABLED
              ? [{ status: 'PROCESSING', processingStartedAt: { lte: cutoff } }] : [])],
          },
          data: { status: 'PROCESSING', attemptGeneration: { increment: 1 },
            processingStartedAt: now, processedAt: null, errorMessage: null },
        });
        return admitted.count === 1 ? { eventId: event.id, generation: existing.attemptGeneration + 1n } : null;
      }
      await prisma.paymentWebhookEvent.create({ data: {
        id: event.id, type: event.type, paymentIntentId: context.paymentIntentId || null,
        orderId: context.orderId || null, status: 'PROCESSING', attemptGeneration: 1n,
        processingStartedAt: now,
      } });
      return { eventId: event.id, generation: 1n };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  private async finishWebhookEvent(claim: WebhookClaim, status: 'PROCESSED' | 'FAILED', error?: unknown): Promise<void> {
    await prisma.paymentWebhookEvent.updateMany({
      where: { id: claim.eventId, status: 'PROCESSING', attemptGeneration: claim.generation },
      data: { status, processedAt: new Date(),
        errorMessage: error ? String(error instanceof Error ? error.message : error) : null },
    });
  }

  /** Every webhook DB effect runs beneath the same event lock, then order lock.
   * No notification, retry backoff or test gate may wait in this transaction. */
  private async withWebhookFence<T>(claim: WebhookClaim, orderId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ status: string; attempt_generation: bigint }>>`
        SELECT status, attempt_generation
        FROM payment_webhook_events WHERE id = ${claim.eventId} FOR UPDATE`;
      // Sample live eligibility only AFTER acquiring the row lock (not before a lock wait).
      const lease = await tx.$queryRaw<Array<{ live: boolean }>>`
        SELECT processing_started_at > clock_timestamp() - interval '300 seconds' AS live
        FROM payment_webhook_events WHERE id = ${claim.eventId}`;
      const row = rows[0];
      if (!row || row.status !== 'PROCESSING' || row.attempt_generation !== claim.generation || !lease[0]?.live) {
        throw new WebhookOwnershipLost('Webhook ownership lost');
      }
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      return work(tx);
    });
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent, claim: WebhookClaim): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) { logger.error('Missing orderId in payment intent metadata'); return; }
    let confirmed = false;
    let immediateFailure: WebhookOwnershipLost | PaymentIntentMismatch | undefined;
    try {
      const { withRetry } = await import('../../utils/retry');
      await withRetry(async () => {
        confirmed = await this.withWebhookFence(claim, orderId, async tx => {
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (!order) { logger.error(`Missing order ${orderId}`); return false; }
          if (order.paymentIntentId && order.paymentIntentId !== paymentIntent.id) {
            throw new PaymentIntentMismatch(`Payment intent ${paymentIntent.id} does not match order ${orderId}`);
          }
          if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED') return false;
          if (!order.paymentIntentId) {
            await tx.order.updateMany({ where: { id: orderId, paymentIntentId: null, status: 'PENDING' },
              data: { paymentIntentId: paymentIntent.id, paymentStatus: 'PROCESSING' } });
          }
          await orderService.confirmOrderInTransaction(tx, orderId);
          return true;
        }).catch(error => {
          if (error instanceof WebhookOwnershipLost || error instanceof PaymentIntentMismatch) { immediateFailure = error; return false; }
          throw error;
        });
      }, { maxRetries: 5, initialDelay: process.env.NODE_ENV === 'test' ? 10 : 2000 });
      if (immediateFailure) throw immediateFailure;
    } catch (error) {
      if (error instanceof WebhookOwnershipLost) throw error;
      if (error instanceof PaymentIntentMismatch) {
        await notificationService.sendAdminAlert('Payment Intent Mismatch', error.message);
        throw ApiError.badRequest('Payment intent does not match order');
      }
      try { await notificationService.sendAdminAlert('Order Confirmation Failure',
        `Order ${orderId} failed after payment succeeded. Manual intervention required. Error: ${error}`); }
      catch (alertError) { logger.error(`Failed to alert admin: ${alertError}`); }
      throw error;
    }
    if (!confirmed) return;

    // Inventory is committed. An email failure must not re-run confirmation.
    try {
      await orderService.sendOrderConfirmationEmail(orderId);
    } catch (error) {
      logger.error(`Order ${orderId} confirmed, but confirmation email failed: ${error}`);
      try {
        await notificationService.sendAdminAlert(
          'Order Confirmation Email Failure',
          `Order ${orderId} is confirmed; confirmation email failed. Do not reconfirm inventory. Error: ${error}`
        );
      } catch (alertError) {
        logger.error(`Failed to alert admin for confirmed order ${orderId}: ${alertError}`);
      }
    }
    logger.info(`Successfully confirmed order ${orderId} after payment success`);
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent, claim: WebhookClaim): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    const userId = paymentIntent.metadata.userId;
    const order = orderId ? await this.withWebhookFence(claim, orderId, async tx => {
      const current = await tx.order.findUnique({ where: { id: orderId }, include: { user: { select: { email: true } } } });
      if (current && (!current.paymentIntentId || current.paymentIntentId === paymentIntent.id)) {
        await tx.order.updateMany({ where: { id: orderId, status: { not: 'PAID' }, paymentStatus: { not: 'SUCCEEDED' },
          OR: [{ paymentIntentId: null }, { paymentIntentId: paymentIntent.id }] },
          data: { paymentStatus: 'FAILED', paymentIntentId: paymentIntent.id } });
      }
      return current;
    }) : null;

    // Notify user of payment failure
    const recipientEmail = order?.user.email || (userId
      ? (await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }))?.email
      : undefined);

    if (recipientEmail) {
      try {
        await notificationService.sendEmail({
          to: recipientEmail,
          subject: 'Payment Failed',
          html: `<p>Your payment for order ${orderId} could not be processed. Please try again or use a different payment method.</p>`,
          text: `Your payment for order ${orderId} could not be processed. Please try again or use a different payment method.`,
        });
      } catch (error) {
        logger.error(`Failed to send payment failure notification: ${error}`);
      }
    }
  }
}

export const paymentService = new PaymentService();
