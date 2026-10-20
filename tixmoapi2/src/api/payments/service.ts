import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';
import { notificationService } from '../../utils/notificationService';
import prisma from '../../config/prisma';

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

    const shouldProcess = await this.beginWebhookEvent(event);
    if (!shouldProcess) {
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          await this.handlePaymentSuccess(paymentIntent);
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentFailed = event.data.object;
          await this.handlePaymentFailure(paymentFailed);
          break;
        }
        default:
          logger.info(`Unhandled event type ${event.type}`);
      }

      await this.finishWebhookEvent(event, 'PROCESSED');
    } catch (error) {
      await this.finishWebhookEvent(event, 'FAILED', error);
      throw error;
    }
  }

  private async beginWebhookEvent(event: Stripe.Event): Promise<boolean> {
    if (!event.id) {
      return true;
    }

    const context = getPaymentIntentContext(event);

    try {
      const existingEvent = await prisma.paymentWebhookEvent.findUnique({
        where: { id: event.id },
        select: { status: true },
      });

      if (existingEvent) {
        if (existingEvent.status === 'FAILED') {
          const admitted = await prisma.paymentWebhookEvent.updateMany({
            where: { id: event.id, status: 'FAILED' },
            data: {
              status: 'PROCESSING',
              errorMessage: null,
              processingStartedAt: new Date(),
            },
          });
          return admitted.count === 1;
        }

        logger.info(`Skipping already processed Stripe webhook event ${event.id}`);
        return false;
      }

      await prisma.paymentWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          paymentIntentId: context.paymentIntentId || null,
          orderId: context.orderId || null,
          status: 'PROCESSING',
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.info(`Skipping already processed Stripe webhook event ${event.id}`);
        return false;
      }

      throw error;
    }
  }

  private async finishWebhookEvent(
    event: Stripe.Event,
    status: 'PROCESSED' | 'FAILED',
    error?: unknown
  ): Promise<void> {
    if (!event.id) {
      return;
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        status,
        processedAt: new Date(),
        errorMessage: error ? String(error instanceof Error ? error.message : error) : null,
      },
    });
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      logger.error('Missing orderId in payment intent metadata');
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentIntentId: true,
      },
    });

    if (!order) {
      logger.error(`Missing order ${orderId} for payment intent ${paymentIntent.id}`);
      return;
    }

    if (order.paymentIntentId && order.paymentIntentId !== paymentIntent.id) {
      const message = `Payment intent ${paymentIntent.id} does not match order ${orderId}`;
      logger.error(message);
      await notificationService.sendAdminAlert('Payment Intent Mismatch', message);
      throw ApiError.badRequest('Payment intent does not match order');
    }

    if (!order.paymentIntentId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentIntentId: paymentIntent.id, paymentStatus: 'PROCESSING' },
      });
    }

    if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED') {
      logger.info(`Skipping already confirmed order ${orderId}`);
      return;
    }

    try {
      const { withRetry } = await import('../../utils/retry');

      // Retry up to 5 times with exponential backoff
      await withRetry(async () => {
        await orderService.confirmOrder(orderId);
      }, {
        maxRetries: 5,
        initialDelay: process.env.NODE_ENV === 'test' ? 10 : 2000,
      });

    } catch (error) {
      logger.error(`Critical: Failed to confirm order ${orderId} after multiple retries: ${error}`);
      try {
        await notificationService.sendAdminAlert(
          'Order Confirmation Failure',
          `Order ${orderId} failed to confirm after payment succeeded. Manual intervention required. Error: ${error}`
        );
      } catch (alertError) {
        logger.error(`Failed to alert admin for order ${orderId}: ${alertError}`);
      }
      // Alert delivery is not fulfillment. Preserve FAILED and Stripe retry semantics.
      throw error;
    }

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
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    const userId = paymentIntent.metadata.userId;
    logger.info(
      `Payment failed for order ${orderId}: ${paymentIntent.last_payment_error?.message}`
    );

    const order = orderId
      ? await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true } } },
      })
      : null;

    if (order && order.status !== 'PAID') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          paymentIntentId: order.paymentIntentId || paymentIntent.id,
        },
      });
    }

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
