import { Prisma, Order, OrderStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from '../../utils/notificationService';
import crypto from 'crypto';
import { getActorScopeById, resolveOrganizationFilter } from '../../utils/tenantScope';

import prisma from '../../config/prisma';
import { config } from '../../config/environment';
import { formatNewfoundlandDateTime } from '../../utils/eventTime';
import {
  configuredHstRate,
  formatHstAmountLine,
  formatMoney,
  formatVenueAddress,
  includedHstAmount,
  receiptDisclosure,
  receiptHstAmount,
  summarizeTickets,
  type ReceiptDisclosure,
} from '../../utils/receipt';
import {
  lockOrder,
  markAttendedTickets,
  transitionInventory,
  transitionPromo,
} from '../../services/order-inventory.service';
import { voidOrderTickets } from '../../services/ticket-void.service';

interface OrderItemInput {
  ticketTypeId: string;
  quantity: number;
}

interface CreateOrderInput {
  items: OrderItemInput[];
  promoCode?: string;
}

interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  userId?: string;
  eventId?: string;
  search?: string;
}

interface PaginatedOrders {
  orders: Array<Order & { receiptDisclosure: ReceiptDisclosure }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class OrderService {
  // Only authenticated HTTP entrypoints pass actorId. Omission is reserved for
  // trusted payment/free-order/expiry jobs; never populate it from query input.
  private async actorOrderScope(
    actorId: string,
    action: 'read' | 'confirm' | 'refund' | 'void' = 'read'
  ): Promise<Prisma.OrderWhereInput> {
    const actor = await getActorScopeById(actorId);
    if (action === 'refund' && !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw ApiError.forbidden('Not authorized to refund orders');
    }
    if (action === 'void' && !['OWNER', 'ADMIN', 'MANAGER'].includes(actor.role)) {
      throw ApiError.forbidden('Not authorized to void tickets');
    }
    if (action === 'confirm' && !['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(actor.role)) {
      throw ApiError.forbidden('Not authorized to confirm orders');
    }
    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(actor.role)) {
      return { userId: actor.userId };
    }
    const organizationId = resolveOrganizationFilter(actor);
    return organizationId ? { event: { organizationId } } : {};
  }

  /**
   * Create a new order
   */
  async createOrder(userId: string, data: CreateOrderInput): Promise<Order> {
    const quantities = new Map<string, number>();
    for (const item of data.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
        throw ApiError.badRequest('Invalid quantity');
      quantities.set(item.ticketTypeId, (quantities.get(item.ticketTypeId) || 0) + item.quantity);
    }
    if (!quantities.size) throw ApiError.badRequest('Order must contain tickets');
    const items = [...quantities].sort(([a], [b]) => a.localeCompare(b));
    const order = await prisma.$transaction(
      async (tx) => {
        const first = await tx.ticketType.findUnique({
          where: { id: items[0][0] },
          select: { eventId: true },
        });
        if (!first) throw ApiError.notFound('Ticket type not found');
        // Event cancellation and checkout share this lock. Orders created before
        // cancellation remain visible to its subsequent cancellation pass.
        await tx.$queryRaw`SELECT id FROM events WHERE id = ${first.eventId} FOR UPDATE`;
        const event = await tx.event.findUniqueOrThrow({ where: { id: first.eventId } });
        const now = new Date();
        if (
          event.deletedAt ||
          !['PUBLISHED', 'ON_SALE'].includes(event.status) ||
          (event.salesStart && now < event.salesStart) ||
          (event.salesEnd && now >= event.salesEnd) ||
          (event.startDatetime && now >= event.startDatetime)
        ) {
          throw ApiError.badRequest('Event is not available for purchase');
        }
        if (event.salesPaused)
          throw ApiError.conflict(
            'Ticket sales are paused for a moment. Orders and tickets you already have are safe. Please check back soon.',
            { code: 'SALES_PAUSED' }
          );
        let subtotal = new Decimal(0);
        const allocations: Array<{
          ticketTypeId: string;
          quantity: number;
          price: Decimal;
          tierId: string | null;
        }> = [];
        for (const [ticketTypeId, quantity] of items) {
          await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${ticketTypeId} FOR UPDATE`;
          const type = await tx.ticketType.findUnique({
            where: { id: ticketTypeId },
            include: { tiers: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
          });
          if (!type) throw ApiError.notFound('Ticket type not found');
          if (type.eventId !== event.id)
            throw ApiError.badRequest('All tickets must be for the same event');
          if (
            type.status !== 'ACTIVE' ||
            (type.salesStart && now < type.salesStart) ||
            (type.salesEnd && now >= type.salesEnd)
          )
            throw ApiError.badRequest('Ticket type is not on sale');
          if (quantity > type.quantityAvailable)
            throw ApiError.badRequest('Not enough tickets available');
          if (quantity > type.maxPerOrder)
            throw ApiError.badRequest(
              `Maximum ${type.maxPerOrder} tickets per order for ${type.name}`
            );
          if (type.tierInventoryStatus !== 'READY')
            throw ApiError.conflict('Ticket pricing schedule requires inventory reconciliation');
          const tier = type.tiers.find(
            (t) =>
              t.isActive &&
              (!t.startsAt || now >= t.startsAt) &&
              (!t.endsAt || now < t.endsAt) &&
              (t.quantityLimit === null || t.quantitySold + t.quantityHeld < t.quantityLimit)
          );
          // A configured tier schedule must not silently fall back to the base price.
          if (type.tiers.length && !tier)
            throw ApiError.badRequest('No ticket pricing tier is currently available');
          if (
            tier &&
            tier.quantityLimit !== null &&
            tier.quantitySold + tier.quantityHeld + quantity > tier.quantityLimit
          ) {
            throw ApiError.badRequest(
              'Requested quantity exceeds the remaining pricing tier; select fewer tickets'
            );
          }
          const price = tier?.price ?? type.price;
          subtotal = subtotal.add(price.mul(quantity));
          allocations.push({ ticketTypeId, quantity, price, tierId: tier?.id ?? null });
          await tx.ticketType.update({
            where: { id: ticketTypeId },
            data: {
              quantityAvailable: { decrement: quantity },
              quantityHeld: { increment: quantity },
            },
          });
          if (tier)
            await tx.ticketTier.update({
              where: { id: tier.id },
              data: { quantityHeld: { increment: quantity } },
            });
        }
        let discount = new Decimal(0);
        let promoId: string | null = null;
        if (data.promoCode) {
          const code = data.promoCode.toUpperCase();
          await tx.$queryRaw`SELECT id FROM promo_codes WHERE code = ${code} FOR UPDATE`;
          const promo = await tx.promoCode.findUnique({ where: { code } });
          if (
            !promo ||
            promo.organizationId !== event.organizationId ||
            promo.status !== 'ACTIVE' ||
            now < promo.validFrom ||
            now >= promo.validUntil ||
            (promo.applicableEvents.length && !promo.applicableEvents.includes(event.id)) ||
            (promo.minOrderValue && subtotal.lessThan(promo.minOrderValue)) ||
            (promo.maxUses !== null && promo.usesCount + promo.usesHeld >= promo.maxUses)
          ) {
            throw ApiError.badRequest('Promo code is unavailable for this order');
          }
          discount = Decimal.min(
            subtotal,
            promo.discountType === 'PERCENTAGE'
              ? subtotal.mul(promo.discountValue).div(100).toDecimalPlaces(2)
              : promo.discountValue
          );
          promoId = promo.id;
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { usesHeld: { increment: 1 } },
          });
        }
        const totalAmount = Decimal.max(subtotal.sub(discount), new Decimal(0));
        const taxAmount = new Decimal(
          includedHstAmount(totalAmount, configuredHstRate()).toFixed(2)
        );
        const created = await tx.order.create({
          data: {
            orderNumber: `ORD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
            userId,
            eventId: event.id,
            totalAmount,
            taxAmount,
            discountAmount: discount,
            currency: config.paymentCurrency,
            promoCodeId: promoId,
            promoReservation: promoId ? 'HELD' : 'NONE',
            expiresAt: new Date(Date.now() + config.cartExpiryMinutes * 60 * 1000),
          },
        });
        const tickets: Prisma.TicketCreateManyInput[] = allocations.flatMap((a) =>
          Array.from({ length: a.quantity }, () => ({
            orderId: created.id,
            userId,
            eventId: event.id,
            ticketTypeId: a.ticketTypeId,
            tierId: a.tierId,
            pricePaid: a.price,
            inventoryState: 'HELD' as const,
            barcode: `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
            status: 'VALID' as const,
          }))
        );
        await tx.ticket.createMany({ data: tickets });
        return created;
      },
      { timeout: 15000 }
    );
    return order.totalAmount.eq(0) ? this.confirmOrder(order.id) : order;
  }

  /**
   * Get order by ID
   */
  // Consumer checkout-return reads never inherit operator/tenant privileges.
  async getConsumerOrderRecovery(
    id: string,
    ownerId: string
  ): Promise<Pick<Order, 'id' | 'status' | 'paymentStatus'> | null> {
    if (!ownerId) throw ApiError.unauthorized();
    return prisma.order.findFirst({
      where: { id, userId: ownerId },
      select: { id: true, status: true, paymentStatus: true },
    });
  }

  async getOrderById(id: string, userId?: string, actorId?: string): Promise<Order | null> {
    if (userId || actorId) {
      const scope = actorId ? await this.actorOrderScope(actorId) : { userId };
      // when userId provided, findFirst with both id and userId
      const order = await prisma.order.findFirst({
        where: { id, ...scope },
        include: {
          tickets: {
            include: {
              ticketType: {
                select: { name: true },
              },
            },
          },
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });
      if (!order) return null;
      const result = {
        ...order,
        tickets: order.tickets.map((ticket) =>
          ticket.userId === (userId || actorId)
            ? ticket
            : {
                ...ticket,
                barcode: '',
                qrCodeUrl: null,
              }
        ),
      };
      return result;
    }

    return await prisma.order.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
        event: {
          select: {
            name: true,
            startDatetime: true,
            venue: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Confirm order (after payment)
   */
  async confirmOrder(id: string, actorId?: string): Promise<Order> {
    const scope = actorId ? await this.actorOrderScope(actorId, 'confirm') : {};
    if (actorId && !(await prisma.order.findFirst({ where: { id, ...scope } })))
      throw ApiError.notFound('Order not found');
    return prisma.$transaction((tx) => this.confirmOrderInTransaction(tx, id, scope));
  }

  // Reused by the webhook while its event-generation fence owns the transaction.
  // Inventory, tiers, promos, event eligibility and order state commit together.
  async confirmOrderInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    scope: Prisma.OrderWhereInput = {}
  ): Promise<Order> {
    await lockOrder(tx, id);
    const order = await tx.order.findFirst({ where: { id, ...scope }, include: { event: true } });
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'PAID' && order.paymentStatus === 'SUCCEEDED') return order;
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${order.eventId} FOR UPDATE`;
    const currentEvent = await tx.event.findUniqueOrThrow({ where: { id: order.eventId } });
    if (
      order.status !== 'PENDING' ||
      (order.expiresAt && order.expiresAt <= new Date()) ||
      currentEvent.deletedAt ||
      !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(currentEvent.status)
    )
      throw ApiError.conflict('Order can no longer be fulfilled');
    await transitionInventory(tx, id, 'HELD', 'SOLD');
    await transitionPromo(tx, id, 'USED');
    return tx.order.update({ where: { id }, data: { status: 'PAID', paymentStatus: 'SUCCEEDED' } });
  }

  /**
   * Send order confirmation email (called after confirmOrder)
   */
  async sendOrderConfirmationEmail(orderId: string, resend = false): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: { include: { ticketType: { select: { name: true } } } },
        event: { include: { venue: true } },
        user: true,
      },
    });
    if (!order) throw ApiError.notFound('Order not found');
    if (
      order.status !== 'PAID' ||
      (!resend &&
        (order.receiptSentAt ||
          order.receiptStatus === 'LEGACY_UNKNOWN' ||
          order.receiptStatus === 'SENT'))
    )
      return;
    const leaseToken = crypto.randomUUID();
    const stale = new Date(Date.now() - 5 * 60_000);
    const claimed = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PAID',
        OR: [
          resend ? { receiptStatus: { not: 'PROCESSING' } } : { receiptStatus: 'PENDING' },
          { receiptStatus: 'PROCESSING', receiptStartedAt: { lt: stale } },
        ],
      },
      data: {
        receiptStatus: 'PROCESSING',
        receiptLeaseToken: leaseToken,
        receiptStartedAt: new Date(),
      },
    });
    if (!claimed.count) {
      if (resend) throw ApiError.conflict('Receipt delivery is already in progress');
      return;
    }
    try {
      const date = order.event.startDatetime
        ? formatNewfoundlandDateTime(order.event.startDatetime)
        : 'Date to be announced';
      const hstRate = configuredHstRate();
      const delivered = await notificationService.sendOrderConfirmation({
        to: order.user.email,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        orderNumber: order.orderNumber,
        eventName: order.event.name,
        eventDate: date,
        ticketSummary: summarizeTickets(order.tickets),
        subtotalAmount: formatMoney(
          new Decimal(order.totalAmount).plus(order.discountAmount),
          order.currency
        ),
        totalAmount: formatMoney(order.totalAmount, order.currency),
        venueName: order.event.venue?.name || null,
        venueAddress: formatVenueAddress(order.event.venue?.address),
        hstNumber: config.hstNumber || null,
        hstAmountLine: formatHstAmountLine(
          receiptHstAmount(order.totalAmount, hstRate, order.taxAmount),
          hstRate
        ),
      });
      if (!delivered) throw ApiError.internal('Receipt could not be delivered');
      await prisma.order.updateMany({
        where: { id: orderId, receiptLeaseToken: leaseToken },
        data: { receiptSentAt: new Date(), receiptStatus: 'SENT', receiptLeaseToken: null },
      });
    } catch (error) {
      await prisma.order.updateMany({
        where: { id: orderId, receiptLeaseToken: leaseToken },
        data: { receiptStatus: order.receiptSentAt ? 'SENT' : 'PENDING', receiptLeaseToken: null },
      });
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, userId?: string, actorId?: string): Promise<Order> {
    const scope = actorId ? await this.actorOrderScope(actorId) : userId ? { userId } : {};
    const observed = await prisma.order.findFirst({ where: { id, ...scope } });
    if (!observed) throw ApiError.notFound('Order not found');
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const current = await tx.order.findFirst({ where: { id, ...scope } });
      if (!current) throw ApiError.notFound('Order not found');
      // Revalidate public observation under lock; trusted transactional callers retain their fence.
      if (
        current.status !== 'CANCELLED' &&
        (current.status !== observed.status || current.paymentStatus !== observed.paymentStatus)
      )
        throw ApiError.badRequest('Cannot cancel order that has changed');
      return this.cancelOrderInTransaction(tx, id, scope);
    });
  }

  async cancelOrderInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    scope: Prisma.OrderWhereInput = {}
  ): Promise<Order> {
    await lockOrder(tx, id);
    const order = await tx.order.findFirst({ where: { id, ...scope } });
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'CANCELLED') return order;
    // A pending cancellation only releases the reservation. It does not refund,
    // including when a payment was already captured and is waiting on reconciliation.
    if (order.status !== 'PENDING')
      throw ApiError.badRequest(
        'Cannot cancel paid orders. All sales are final. Refunds are issued by Tixmo staff.'
      );
    await transitionInventory(tx, id, 'HELD', 'RELEASED');
    await transitionPromo(tx, id, 'RELEASED');
    return tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /**
   * List orders with pagination
   */
  async listOrders(params: ListOrdersParams, actorId?: string): Promise<PaginatedOrders> {
    const { page = 1, limit = 20, status, userId, eventId, search } = params;
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (eventId) where.eventId = eventId;
    if (search)
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];

    const scopedWhere: Prisma.OrderWhereInput = actorId
      ? { AND: [where, await this.actorOrderScope(actorId)] }
      : where;
    const [orders, total]: [Order[], number] = await Promise.all([
      prisma.order.findMany({
        where: scopedWhere,
        skip,
        take: cappedLimit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
          tickets: {
            select: {
              id: true,
              status: true,
              ticketType: {
                select: {
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.order.count({ where: scopedWhere }),
    ]);

    return {
      orders: orders.map((order) => ({
        ...order,
        receiptDisclosure: receiptDisclosure(order.totalAmount),
      })),
      pagination: {
        page: safePage,
        limit: cappedLimit,
        total,
        pages: Math.ceil(total / cappedLimit),
      },
    };
  }

  /**
   * Refund an order (ADMIN only)
   */
  /**
   * Void admission without a refund or inventory release. OWNER, ADMIN, and MANAGER.
   */
  async voidPaidTickets(
    id: string,
    actorId: string,
    input: { reason: string; ticketId?: string }
  ): Promise<Order> {
    const scope = await this.actorOrderScope(actorId, 'void');
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.order.findFirst({ where: { id, ...scope } });
      if (!order) throw ApiError.notFound('Order not found');
      if (order.status !== 'PAID' && order.status !== 'PARTIALLY_REFUNDED') {
        throw ApiError.badRequest('Only paid orders can be voided without a refund');
      }
      await voidOrderTickets(tx, {
        orderId: id,
        ticketId: input.ticketId,
        actorId,
        reason: input.reason,
        action: 'STAFF_VOID',
        sourceId: crypto.randomUUID(),
        voidTickets: true,
      });
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          tickets: { include: { ticketType: { select: { name: true } } } },
          event: { select: { name: true, startDatetime: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async refundOrder(id: string, actorId?: string): Promise<Order> {
    const scope = actorId ? await this.actorOrderScope(actorId, 'refund') : {};
    const observed = await prisma.order.findFirst({ where: { id, ...scope } });
    if (!observed) throw ApiError.notFound('Order not found');
    const { paymentService } = await import('../payments/service');
    return paymentService.refundOrder(id, observed);
  }

  // Only the processor reconciliation path may finalize a monetary refund.
  async finalizeRefund(id: string): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw ApiError.notFound('Order not found');
      if (order.status === 'REFUNDED') return order;
      if (order.status !== 'PAID') throw ApiError.conflict('Order is not paid');
      if (!order.totalAmount.eq(0)) {
        const lines = await tx.paymentRefundLine.findMany({
          where: { orderId: id, reason: 'ORDER_REFUND', status: 'SUCCEEDED' },
        });
        const recorded = lines.length
          ? lines
          : await tx.paymentRefund.findMany({
              where: { orderId: id, reason: 'ORDER_REFUND', status: 'SUCCEEDED' },
            });
        const sum = recorded.reduce((total, refund) => total + refund.amount, 0);
        const orderCents = Math.round(order.totalAmount.toNumber() * 100);
        if (
          recorded.length === 0 ||
          recorded.some((refund) => refund.currency !== order.currency) ||
          sum !== orderCents
        ) {
          // A partial sum is already recorded on its own lines. Recovery must not
          // fail the webhook or release inventory until the refunds cover the order.
          if (sum > orderCents || recorded.some((refund) => refund.currency !== order.currency)) {
            throw ApiError.conflict('Processor refund has not been confirmed');
          }
          return order;
        }
      }
      await markAttendedTickets(tx, id);
      await transitionInventory(tx, id, 'SOLD', 'RELEASED');
      return tx.order.update({
        where: { id },
        data: { status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
      });
    });
  }
}

export const orderService = new OrderService();
