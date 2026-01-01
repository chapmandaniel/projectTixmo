import { PrismaClient, Order, OrderStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from '../../utils/notificationService';

const prisma = new PrismaClient();

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
    // Get the first ticket type to determine the event
    const firstTicketType = await prisma.ticketType.findUnique({
      where: { id: data.items[0].ticketTypeId },
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

    if (!firstTicketType) {
      throw ApiError.notFound('Ticket type not found');
    }

    const eventId = firstTicketType.event.id;

    // Validate all ticket types belong to the same event
    const ticketTypes = await Promise.all(
      data.items.map((item) =>
        prisma.ticketType.findUnique({
          where: { id: item.ticketTypeId },
          include: {
            event: true,
          },
        })
      )
    );

    for (let i = 0; i < ticketTypes.length; i++) {
      const ticketType = ticketTypes[i];
      if (!ticketType) {
        throw ApiError.notFound(`Ticket type ${data.items[i].ticketTypeId} not found`);
      }

      if (ticketType.event.id !== eventId) {
        throw ApiError.badRequest('All tickets must be for the same event');
      }

      // Check if event is published
      if (ticketType.event.status !== 'PUBLISHED') {
        throw ApiError.badRequest(`Event is not available for purchase`);
      }

      // Check if event hasn't started
      if (ticketType.event.startDatetime && new Date() >= ticketType.event.startDatetime) {
        throw ApiError.badRequest(`Event has already started`);
      }

      // Check availability
      const item = data.items[i];
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

    // Calculate total
    let totalAmount = new Decimal(0);
    for (let i = 0; i < data.items.length; i++) {
      const ticketType = ticketTypes[i]!;
      const item = data.items[i];
      totalAmount = totalAmount.add(ticketType.price.mul(item.quantity));
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order and hold inventory
    const order = await prisma.$transaction(async (tx) => {
      // Hold inventory
      for (let i = 0; i < data.items.length; i++) {
        await tx.ticketType.update({
          where: { id: data.items[i].ticketTypeId },
          data: {
            quantityHeld: { increment: data.items[i].quantity },
            quantityAvailable: { decrement: data.items[i].quantity },
          },
        });
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          eventId,
          status: 'PENDING',
          totalAmount,
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

      // Create tickets
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const ticketType = ticketTypes[i]!;

        for (let j = 0; j < item.quantity; j++) {
          await tx.ticket.create({
            data: {
              orderId: newOrder.id,
              userId,
              eventId,
              ticketTypeId: item.ticketTypeId,
              pricePaid: ticketType.price,
              barcode: `TIX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              status: 'VALID',
            },
          });
        }
      }

      return newOrder;
    });

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
          updatedAt: new Date(),
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
          updatedAt: new Date(),
        },
      });
    });
  }

  /**
   * List orders with pagination
   */
  async listOrders(params: ListOrdersParams): Promise<PaginatedOrders> {
    const { page = 1, limit = 20, status, userId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [orders, total]: [Order[], number] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
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
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const orderService = new OrderService();
