import Stripe from 'stripe';
import { config } from '../../config/environment';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripeSecretKey);
  }

  /**
   * Create a payment intent for an order
   */
  async createPaymentIntent(
    orderId: string,
    userId: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
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
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
    } catch (err: any) {
      throw new ApiError(400, `Webhook Error: ${err.message}`);
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
        console.log(`Unhandled event type ${event.type}`);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      console.error('Missing orderId in payment intent metadata');
      return;
    }

    try {
      await orderService.confirmOrder(orderId);
      await orderService.sendOrderConfirmationEmail(orderId);
    } catch (error) {
      console.error(`Failed to confirm order ${orderId}:`, error);
      // TODO: Implement retry logic or manual intervention alert
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    console.log(
      `Payment failed for order ${orderId}: ${paymentIntent.last_payment_error?.message}`
    );
    // Optional: Notify user of failure
  }
}

export const paymentService = new PaymentService();
