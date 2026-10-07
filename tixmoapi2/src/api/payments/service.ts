import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/ApiError';
import { orderService } from '../orders/service';
import { notificationService } from '../../utils/notificationService';
import { lockOrder } from '../../services/order-inventory.service';
import prisma from '../../config/prisma';

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
        (order.expiresAt && order.expiresAt <= new Date()) ||
        order.event.deletedAt ||
        !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(order.event.status)
      ) {
        throw ApiError.conflict('Order is no longer pending payment');
      }
      const amount = cents(order.totalAmount);
      if (amount === 0) throw ApiError.badRequest('Free orders do not need payment');
      return tx.paymentAttempt.upsert({
        where: { orderId },
        create: {
          orderId,
          amount,
          currency: order.currency,
          paymentIntentId: order.paymentIntentId,
        },
        update: {},
      });
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
      intent.metadata.orderId !== orderId
    )
      throw ApiError.conflict('Payment session does not match the order');
    const pending = await prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
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
    if (!event.id) throw ApiError.badRequest('Missing webhook event identity');
    const object = event.data.object as Stripe.PaymentIntent;
    await prisma.paymentWebhookEvent.createMany({
      data: {
        id: event.id,
        type: event.type,
        paymentIntentId: object.id || null,
        orderId: object.metadata?.orderId || null,
        status: 'RECEIVED',
      },
      skipDuplicates: true,
    });
    const token = randomUUID();
    const claim = await prisma.paymentWebhookEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: { in: ['RECEIVED', 'FAILED'] } },
          { status: 'PROCESSING', processingStartedAt: { lt: new Date(Date.now() - LEASE_MS) } },
        ],
      },
      data: {
        status: 'PROCESSING',
        leaseToken: token,
        attempts: { increment: 1 },
        processingStartedAt: new Date(),
        errorMessage: null,
        processedAt: null,
      },
    });
    if (!claim.count) return;
    try {
      if (event.type === 'payment_intent.succeeded') await this.handlePaymentSuccess(object);
      else if (event.type === 'payment_intent.payment_failed')
        await this.handlePaymentFailure(object);
      else if (event.type.startsWith('refund.') || event.type === 'charge.refunded')
        await this.recoverRefunds();
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: event.id, leaseToken: token },
        data: { status: 'PROCESSED', processedAt: new Date(), leaseToken: null },
      });
    } catch (error) {
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: event.id, leaseToken: token },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          leaseToken: null,
          processedAt: null,
        },
      });
      throw error;
    }
  }

  private async handlePaymentSuccess(intent: Stripe.PaymentIntent): Promise<void> {
    const orderId = intent.metadata?.orderId;
    if (!orderId) throw ApiError.conflict('Payment has no order identity');
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentAttempt: true },
    });
    if (!order) throw ApiError.conflict('Payment order is missing');
    if (intent.status !== 'succeeded' || intent.amount_received !== intent.amount) {
      throw ApiError.conflict('Payment has not fully succeeded');
    }
    // An early webhook may precede persisting the create response. Only the
    // previously committed attempt identity may bind that first response.
    if (!order.paymentIntentId && order.paymentAttempt?.id === intent.metadata.attemptId) {
      await prisma.$transaction(async (tx) => {
        await lockOrder(tx, orderId);
        const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
        if (current.paymentIntentId && current.paymentIntentId !== intent.id)
          throw ApiError.conflict('Payment session changed');
        await tx.order.update({ where: { id: orderId }, data: { paymentIntentId: intent.id } });
        await tx.paymentAttempt.update({
          where: { orderId },
          data: { paymentIntentId: intent.id },
        });
      });
    } else if (order.paymentIntentId !== intent.id) {
      await this.ensureRefund(orderId, intent, 'UNEXPECTED_PAYMENT');
      return;
    }
    if (intent.amount !== cents(order.totalAmount) || intent.currency !== order.currency) {
      await this.ensureRefund(orderId, intent, 'INCORRECT_AMOUNT');
      if (order.status === 'PENDING') await orderService.cancelOrder(orderId);
      return;
    }
    if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED') return;
    if (order.status !== 'PENDING' || (order.expiresAt && order.expiresAt <= new Date())) {
      if (order.status === 'PENDING') await orderService.cancelOrder(orderId);
      await this.ensureRefund(orderId, intent, 'LATE_PAYMENT');
      return;
    }
    try {
      const { withRetry } = await import('../../utils/retry');
      await withRetry(() => orderService.confirmOrder(orderId), {
        maxRetries: 5,
        initialDelay: config.nodeEnv === 'test' ? 10 : 2000,
      });
    } catch (error) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { event: true },
      });
      if (
        current &&
        (current.status === 'CANCELLED' ||
          current.event.status === 'CANCELLED' ||
          (current.status === 'PENDING' && current.expiresAt && current.expiresAt <= new Date()))
      ) {
        if (current.status === 'PENDING') await orderService.cancelOrder(orderId);
        await this.ensureRefund(orderId, intent, 'LATE_PAYMENT');
        return;
      }
      logger.error(`Critical: Failed to confirm order ${orderId}: ${error}`);
      await notificationService
        .sendAdminAlert(
          'Order Confirmation Failure',
          `Order ${orderId} failed to confirm after payment succeeded. Reconciliation will retry.`
        )
        .catch(() => false);
      throw error;
    }
    // Receipt delivery has its own recovery path and cannot undo fulfillment.
    await orderService
      .sendOrderConfirmationEmail(orderId)
      .catch((error) => logger.error(`Receipt delivery failed for order ${orderId}: ${error}`));
  }

  private async handlePaymentFailure(intent: Stripe.PaymentIntent): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: intent.metadata?.orderId || '' },
      include: { user: { select: { email: true } } },
    });
    if (!order || order.paymentIntentId !== intent.id) return;
    const result = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
        paymentIntentId: intent.id,
        paymentStatus: { not: 'SUCCEEDED' },
      },
      data: { paymentStatus: 'FAILED' },
    });
    if (result.count)
      await notificationService
        .sendEmail({
          to: order.user.email,
          subject: 'Payment Failed',
          text: `Your payment for order ${order.orderNumber} could not be processed. You can retry during the reservation window.`,
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
    const stripe = this.provider();
    const record = await prisma.paymentRefund.findUniqueOrThrow({ where: { id } });
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
        await this.processEvent(await this.stripe.events.retrieve(event.id));
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
