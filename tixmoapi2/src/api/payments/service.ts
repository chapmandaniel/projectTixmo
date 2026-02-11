import Stripe from 'stripe';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';
import { notificationService } from '../../utils/notificationService';

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
      currency: 'usd', // Default to USD for now
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
      if (err instanceof Error) {
        throw new ApiError(400, `Webhook Error: ${err.message}`);
      }
      throw new ApiError(400, 'Webhook Error: Unknown error');
    }

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
        // Unhandled event type
        logger.info(`Unhandled event type ${event.type}`);
    }
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

    try {
      await orderService.confirmOrder(orderId);
      await orderService.sendOrderConfirmationEmail(orderId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to confirm order ${orderId}: ${errorMessage}`);
      // TODO: Implement retry logic or manual intervention alert
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

    // Notify user of payment failure
    if (userId) {
      try {
        await notificationService.sendEmail({
          to: userId, // In production, look up user email from userId
          subject: 'Payment Failed',
          html: `<p>Your payment for order ${orderId} could not be processed. Please try again or use a different payment method.</p>`,
          text: `Your payment for order ${orderId} could not be processed. Please try again or use a different payment method.`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to send payment failure notification: ${errorMessage}`);
      }
    }
  }
}

export const paymentService = new PaymentService();
