import { Prisma, Order, OrderStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from '../../utils/notificationService';
import { promoCodeService } from '../promo-codes/service';
import { ticketTierService } from '../ticket-tiers/service';
import crypto from 'crypto';
import { getActorScopeById, resolveOrganizationFilter } from '../../utils/tenantScope';

import prisma from '../../config/prisma';

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
}

interface PaginatedOrders {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Helper types to avoid long inline type casts
type OrderWithTickets = Order & {
  tickets: Array<{ ticketTypeId: string }>;
  status: Order['status'];
};
type OrderWithTicketsAndUser = Order & {
  tickets: Array<{ ticketTypeId: string }>;
  userId: string;
  status: Order['status'];
};

export class OrderService {
  // Only authenticated HTTP entrypoints pass actorId. Omission is reserved for
  // trusted payment/free-order/expiry jobs; never populate it from query input.
  private async actorOrderScope(actorId: string, action: 'read' | 'confirm' | 'refund' = 'read'): Promise<Prisma.OrderWhereInput> {
    const actor = await getActorScopeById(actorId);
    if (action === 'refund' && !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw ApiError.forbidden('Not authorized to refund orders');
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
    // 1. Batch-fetch ALL ticket types in one query (avoid N+1)
    const ticketTypeIds = data.items.map(item => item.ticketTypeId);
    const ticketTypes = await prisma.ticketType.findMany({
      where: { id: { in: ticketTypeIds } },
      include: {
        event: {
          select: {
            id: true,
            status: true,
            startDatetime: true,
          },
        },
      },
    });

    // Build a lookup map
    const ticketTypeMap = new Map(ticketTypes.map(tt => [tt.id, tt]));

    // Validate all ticket types exist
    for (const item of data.items) {
      if (!ticketTypeMap.has(item.ticketTypeId)) {
        throw ApiError.notFound(`Ticket type ${item.ticketTypeId} not found`);
      }
    }

    // Validate all belong to same event
    const eventIds = new Set(ticketTypes.map(tt => tt.event.id));
    if (eventIds.size !== 1) {
      throw ApiError.badRequest('All tickets must be for the same event');
    }
    const eventId = ticketTypes[0].event.id;
    const event = ticketTypes[0].event;

    // Validate event status — accept PUBLISHED and ON_SALE
    if (!['PUBLISHED', 'ON_SALE'].includes(event.status)) {
      throw ApiError.badRequest('Event is not available for purchase');
    }

    // Validate event hasn't started
    if (event.startDatetime && new Date() >= event.startDatetime) {
      throw ApiError.badRequest('Event has already started');
    }

    // Enforce per-order limits across duplicate lines before pricing or holds.
    const quantityByTicketType = new Map<string, number>();
    for (const item of data.items) {
      quantityByTicketType.set(
        item.ticketTypeId,
        (quantityByTicketType.get(item.ticketTypeId) ?? 0) + item.quantity
      );
    }

    // Validate availability and per-order limits
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      if (ticketType.quantityAvailable < item.quantity) {
        throw ApiError.badRequest(
          `Only ${ticketType.quantityAvailable} tickets available for ${ticketType.name}`
        );
      }
      if (quantityByTicketType.get(item.ticketTypeId)! > ticketType.maxPerOrder) {
        throw ApiError.badRequest(
          `Maximum ${ticketType.maxPerOrder} tickets per order for ${ticketType.name}`
        );
      }
    }

    // Calculate total amount (use active tier pricing when available)
    let totalAmount = new Decimal(0);
    const tierPriceMap = new Map<string, Decimal>();
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      let unitPrice = ticketType.price;

      // Check for active tier
      const activeTier = await ticketTierService.getActiveTier(item.ticketTypeId);
      if (activeTier) {
        unitPrice = activeTier.price;
        tierPriceMap.set(item.ticketTypeId, activeTier.price);
      }

      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
    }

    // Apply promo code discount if provided
    let discountAmount = new Decimal(0);
    let promoCodeId: string | undefined;

    if (data.promoCode) {
      const promoResult = await promoCodeService.validatePromoCode(
        data.promoCode,
        userId,
        eventId,
        totalAmount.toNumber()
      );

      if (!promoResult.valid) {
        throw ApiError.badRequest(promoResult.reason || 'Invalid promo code');
      }

      if (promoResult.discountAmount) {
        discountAmount = new Decimal(promoResult.discountAmount);
      }
      if (promoResult.promoCode) {
        promoCodeId = promoResult.promoCode.id;
      }
    }

    const finalAmount = Decimal.max(totalAmount.sub(discountAmount), new Decimal(0));

    // Generate cryptographically secure order number
    const orderNumber = `ORD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // Sort items by ticketTypeId to prevent deadlocks
    const sortedItems = [...data.items].sort((a, b) =>
      a.ticketTypeId.localeCompare(b.ticketTypeId)
    );

    // Create order and hold inventory in a transaction
    const order = await prisma.$transaction(async (tx) => {
      for (const item of sortedItems) {
        const holdResult = await tx.ticketType.updateMany({
          where: {
            id: item.ticketTypeId,
            quantityAvailable: { gte: item.quantity },
          },
          data: {
            quantityHeld: { increment: item.quantity },
            quantityAvailable: { decrement: item.quantity },
          },
        });

        if (holdResult.count !== 1) {
          throw ApiError.badRequest('Not enough tickets available');
        }
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          eventId,
          status: 'PENDING',
          totalAmount: finalAmount,
          discountAmount,
          promoCodeId: promoCodeId || null,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
        include: {
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      const ticketsToCreate: Prisma.TicketCreateManyInput[] = [];

      for (const item of sortedItems) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
        const pricePaid = tierPriceMap.get(item.ticketTypeId) ?? ticketType.price;

        for (let j = 0; j < item.quantity; j++) {
          const secureBarcode = `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

          ticketsToCreate.push({
            orderId: newOrder.id,
            userId,
            eventId,
            ticketTypeId: item.ticketTypeId,
            pricePaid,
            barcode: secureBarcode,
            status: 'VALID',
          });
        }
      }

      if (ticketsToCreate.length > 0) {
        await tx.ticket.createMany({
          data: ticketsToCreate,
        });
      }

      if (promoCodeId) {
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usesCount: { increment: 1 } },
        });
      }

      return newOrder;
    });

    // Auto-confirm free orders (no payment needed)
    if (finalAmount.eq(0)) {
      return this.confirmOrder(order.id);
    }

    return order;
  }

  /**
   * Get order by ID
   */
  // Consumer checkout-return reads never inherit operator/tenant privileges.
  async getConsumerOrderRecovery(id: string, ownerId: string): Promise<Pick<Order, 'id' | 'status' | 'paymentStatus'> | null> {
    if (!ownerId) throw ApiError.unauthorized();
    return prisma.order.findFirst({
      where: { id, userId: ownerId },
      select: { id: true, status: true, paymentStatus: true },
    });
  }

  async getOrderById(id: string, userId?: string, actorId?: string): Promise<Order | null> {
    if (userId || actorId) {
      const scope = actorId ? await this.actorOrderScope(actorId) : { userId };
      return await prisma.order.findFirst({
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
    const order = await prisma.order.findFirst({
      where: { id, ...scope },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderTyped = order as unknown as OrderWithTickets;
    if (orderTyped.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot confirm order with status ${orderTyped.status}`);
    }

    // Claim the transition before inventory effects. A stale PENDING snapshot
    // must not consume holds belonging to another order. Both changes roll back
    // together if inventory is inconsistent.
    return await prisma.$transaction(async (tx) => {
      const transition = await tx.order.updateMany({
        where: { id, ...scope, status: 'PENDING' },
        data: { status: 'PAID', paymentStatus: 'SUCCEEDED' },
      });
      if (transition.count !== 1) {
        throw ApiError.badRequest('Cannot confirm order that is no longer pending');
      }
      // Get unique ticket types from this order
      const ticketTypeCounts = new Map<string, number>();
      for (const ticket of orderTyped.tickets) {
        const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
        ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
      }

      // Update inventory
      for (const [ticketTypeId, quantity] of ticketTypeCounts.entries()) {
        const inventoryResult = await tx.ticketType.updateMany({
          where: {
            id: ticketTypeId,
            quantityHeld: { gte: quantity },
          },
          data: {
            quantityHeld: { decrement: quantity },
            quantitySold: { increment: quantity },
          },
        });

        if (inventoryResult.count !== 1) {
          throw ApiError.internal('Order inventory hold is inconsistent');
        }
      }

      // Preserve the confirmation response shape after the guarded transition.
      const confirmedOrder = await tx.order.findUniqueOrThrow({
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

      return confirmedOrder;
    });
  }

  /**
   * Send order confirmation email (called after confirmOrder)
   */
  async sendOrderConfirmationEmail(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
        event: {
          select: {
            name: true,
            startDatetime: true,
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

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    // Send confirmation email (async, don't wait)
    // Add check that event and startDatetime exist
    if (order.event && order.event.startDatetime) {
      notificationService
        .sendOrderConfirmation({
          to: order.user.email,
          customerName: `${order.user.firstName} ${order.user.lastName}`,
          orderNumber: order.orderNumber,
          eventName: order.event.name,
          eventDate: order.event.startDatetime.toLocaleDateString(),
          ticketCount: order.tickets.length,
          totalAmount: order.totalAmount.toString(),
        })
        .catch((error) => console.error('Failed to send order confirmation email:', error));
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, userId?: string, actorId?: string): Promise<Order> {
    const scope = actorId ? await this.actorOrderScope(actorId) : {};
    const order = await prisma.order.findFirst({
      where: { id, ...scope },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const orderTyped2 = order as unknown as OrderWithTicketsAndUser;
    if (userId && orderTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own orders');
    }

    if (orderTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Order is already cancelled');
    }

    if (orderTyped2.status === 'PAID') {
      throw ApiError.badRequest('Cannot cancel paid orders. Request a refund instead.');
    }

    // Claim the observed cancellable state before releasing any holds. A stale
    // reader must not release inventory owned by another order. The claim and
    // all inventory/ticket changes roll back together on failure.
    return await prisma.$transaction(async (tx) => {
      const transition = await tx.order.updateMany({
        where: {
          id, ...scope,
          ...(userId ? { userId } : {}),
          status: orderTyped2.status,
          paymentStatus: orderTyped2.paymentStatus,
        },
        data: { status: 'CANCELLED' },
      });
      if (transition.count !== 1) {
        throw ApiError.badRequest('Cannot cancel order that has changed');
      }
      // Get unique ticket types from this order
      const ticketTypeCounts = new Map<string, number>();
      for (const ticket of orderTyped2.tickets) {
        const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
        ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
      }

      // Release held inventory
      for (const [ticketTypeId, quantity] of ticketTypeCounts.entries()) {
        const inventoryResult = await tx.ticketType.updateMany({
          where: {
            id: ticketTypeId,
            quantityHeld: { gte: quantity },
          },
          data: {
            quantityHeld: { decrement: quantity },
            quantityAvailable: { increment: quantity },
          },
        });

        if (inventoryResult.count !== 1) {
          throw ApiError.internal('Order inventory hold is inconsistent');
        }
      }

      // Cancel tickets
      await tx.ticket.updateMany({
        where: { orderId: id },
        data: { status: 'CANCELLED' },
      });

      return await tx.order.findUniqueOrThrow({ where: { id } });
    });
  }

  /**
   * List orders with pagination
   */
  async listOrders(params: ListOrdersParams, actorId?: string): Promise<PaginatedOrders> {
    const { page = 1, limit = 20, status, userId, eventId } = params;
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (eventId) where.eventId = eventId;

    // AND prevents buyer/event query filters from replacing the actor fence.
    const scopedWhere: Prisma.OrderWhereInput = actorId
      ? { AND: [where, await this.actorOrderScope(actorId)] } : where;

    const [orders, total]: [Order[], number] = await Promise.all([
      prisma.order.findMany({
        where: scopedWhere,
        skip,
        take: cappedLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: {
            select: {
              name: true,
              startDatetime: true,
            },
          },
          tickets: {
            select: {
              id: true,
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
      orders,
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
  async refundOrder(id: string, actorId?: string): Promise<Order> {
    const scope = actorId ? await this.actorOrderScope(actorId, 'refund') : {};
    const order = await prisma.order.findFirst({
      where: { id, ...scope },
      include: { tickets: true },
    });

    if (!order) throw ApiError.notFound('Order not found');
    if (order.status !== 'PAID') {
      throw ApiError.badRequest('Only PAID orders can be refunded');
    }

    return await prisma.$transaction(async (tx) => {
      // Cancel all valid tickets in one batch
      const ticketsToCancel = order.tickets.filter(
        (t) => t.status === 'VALID' || t.status === 'TRANSFERRED'
      );

      if (ticketsToCancel.length > 0) {
        const ticketIds = ticketsToCancel.map((t) => t.id);

        await tx.ticket.updateMany({
          where: { id: { in: ticketIds } },
          data: { status: 'CANCELLED' },
        });

        // Aggregate inventory updates by ticket type to avoid N+1 queries
        const ticketTypeCounts = new Map<string, number>();
        for (const ticket of ticketsToCancel) {
          const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
          ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
        }

        for (const [ticketTypeId, count] of ticketTypeCounts.entries()) {
          await tx.ticketType.update({
            where: { id: ticketTypeId },
            data: {
              quantitySold: { decrement: count },
              quantityAvailable: { increment: count },
            },
          });
        }
      }

      // Update order status
      return await tx.order.update({
        where: { id },
        data: { status: 'REFUNDED' },
      });
    });
  }
}

export const orderService = new OrderService();
