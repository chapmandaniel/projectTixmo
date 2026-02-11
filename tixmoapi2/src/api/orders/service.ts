import { Prisma, Order, OrderStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from '../../utils/notificationService';
import { promoCodeService } from '../promo-codes/service';
import { ticketTierService } from '../ticket-tiers/service';
import crypto from 'crypto';

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

    // Validate availability and per-order limits
    for (const item of data.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      if (ticketType.quantityAvailable < item.quantity) {
        throw ApiError.badRequest(
          `Only ${ticketType.quantityAvailable} tickets available for ${ticketType.name}`
        );
      }
      if (item.quantity > ticketType.maxPerOrder) {
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
      // Hold inventory (with optimistic concurrency check)
      for (const item of sortedItems) {
        try {
          await tx.ticketType.update({
            where: {
              id: item.ticketTypeId,
              quantityAvailable: { gte: item.quantity },
            },
              data: {
                quantityHeld: { increment: item.quantity },
                quantityAvailable: { decrement: item.quantity },
              },
            });
          } catch (error) {
            throw ApiError.badRequest('Not enough tickets available');
          }
        }

        // Create order
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

        // Create tickets with secure barcodes
        const ticketsToCreate: Prisma.TicketCreateManyInput[] = [];

        for (const item of sortedItems) {
          const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
          // Calculate price once per item (ticket type)
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

        // Increment promo code usage if used
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
  async getOrderById(id: string, userId?: string): Promise<Order | null> {
    if (userId) {
      // when userId provided, findFirst with both id and userId
      return await prisma.order.findFirst({
        where: { id, userId },
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
  async confirmOrder(id: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id },
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

    // Confirm order and move inventory from held to sold
    return await prisma.$transaction(async (tx) => {
      // Get unique ticket types from this order
      const ticketTypeCounts = new Map<string, number>();
      for (const ticket of orderTyped.tickets) {
        const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
        ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
      }

      // Update inventory
      for (const [ticketTypeId, quantity] of ticketTypeCounts.entries()) {
        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: {
            quantityHeld: { decrement: quantity },
            quantitySold: { increment: quantity },
          },
        });
      }

      // Update order status
      const confirmedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
        },
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
  async cancelOrder(id: string, userId?: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id },
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

    // Cancel order and release inventory
    return await prisma.$transaction(async (tx) => {
      // Get unique ticket types from this order
      const ticketTypeCounts = new Map<string, number>();
      for (const ticket of orderTyped2.tickets) {
        const count = ticketTypeCounts.get(ticket.ticketTypeId) || 0;
        ticketTypeCounts.set(ticket.ticketTypeId, count + 1);
      }

      // Release held inventory
      for (const [ticketTypeId, quantity] of ticketTypeCounts.entries()) {
        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: {
            quantityHeld: { decrement: quantity },
            quantityAvailable: { increment: quantity },
          },
        });
      }

      // Cancel tickets
      await tx.ticket.updateMany({
        where: { orderId: id },
        data: { status: 'CANCELLED' },
      });

      // Update order status
      return await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });
    });
  }

  /**
   * List orders with pagination
   */
  async listOrders(params: ListOrdersParams): Promise<PaginatedOrders> {
    const { page = 1, limit = 20, status, userId, eventId } = params;
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * cappedLimit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (eventId) where.eventId = eventId;

    const [orders, total]: [Order[], number] = await Promise.all([
      prisma.order.findMany({
        where,
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
      prisma.order.count({ where }),
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
  async refundOrder(id: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id },
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

