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

    if (order.status !== 'PENDING') {
      throw ApiError.badRequest('Order is not pending payment');
    }

    // Calculate amount in cents (Stripe uses smallest currency unit)
    // Assuming order.totalAmount is Decimal
    const amount = Math.round(Number(order.totalAmount) * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: config.paymentCurrency,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: userId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new ApiError(500, 'Failed to create payment intent');
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'PROCESSING',
      },
    });

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
    } catch (err: any) {
      throw new ApiError(400, `Webhook Error: ${err.message}`);
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
          await prisma.paymentWebhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSING',
              errorMessage: null,
              processingStartedAt: new Date(),
            },
          });
          return true;
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

      await orderService.sendOrderConfirmationEmail(orderId);

      logger.info(`Successfully confirmed order ${orderId} after payment success`);
    } catch (error) {
      logger.error(`Critical: Failed to confirm order ${orderId} after multiple retries: ${error}`);

      // Send alert to admin for manual intervention
      await notificationService.sendAdminAlert(
        'Order Confirmation Failure',
        `Order ${orderId} failed to confirm after payment succeeded. Manual intervention required. Error: ${error}`
      );
    }
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
