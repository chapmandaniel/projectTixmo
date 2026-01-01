import { ApiError } from '@utils/ApiError';
import { PrismaClient, TicketType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

interface CreateTicketTypeInput {
  eventId: string;
  name: string;
  price: number;
  quantity: number;
}

interface UpdateTicketTypeInput {
  name?: string;
  description?: string | null;
  price?: number | string;
  maxPerOrder?: number;
  metadata?: Prisma.InputJsonValue | null;
  salesStart?: string | null;
  salesEnd?: string | null;
  quantity?: number;
}

export class TicketTypeService {
  /**
   * Create a new ticket type
   */
  async createTicketType(data: CreateTicketTypeInput): Promise<TicketType> {
    // Validate event exists
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) throw ApiError.notFound('Event not found');

    return await prisma.ticketType.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        // Prisma model uses Decimal for price and uses quantityTotal/quantityAvailable
        price: new Decimal(data.price),
        quantityTotal: data.quantity,
        quantityAvailable: data.quantity,
        salesStart: null,
        salesEnd: null,
      },
    });
  }

  /**
   * Get ticket type by ID
   */
  async getTicketTypeById(id: string): Promise<TicketType | null> {
    return await prisma.ticketType.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDatetime: true,
            endDatetime: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Update ticket type
   */
  async updateTicketType(id: string, data: UpdateTicketTypeInput): Promise<TicketType> {
    // Check if ticket type exists
    const existingTicketType = await prisma.ticketType.findUnique({
      where: { id },
    });

    if (!existingTicketType) {
      throw ApiError.notFound('Ticket type not found');
    }

    // Validate sales dates if both are provided
    if (data.salesStart && data.salesEnd) {
      const salesStart = new Date(data.salesStart);
      const salesEnd = new Date(data.salesEnd);

      if (salesEnd <= salesStart) {
        throw ApiError.badRequest('Sales end date must be after sales start date');
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = new Decimal(data.price);
    if (data.maxPerOrder !== undefined) updateData.maxPerOrder = data.maxPerOrder;
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata as unknown as Prisma.InputJsonValue;

    if (data.salesStart !== undefined) {
      updateData.salesStart = data.salesStart ? new Date(data.salesStart) : null;
    }
    if (data.salesEnd !== undefined) {
      updateData.salesEnd = data.salesEnd ? new Date(data.salesEnd) : null;
    }

    // Handle quantity update - adjust quantityAvailable accordingly
    if (data.quantity !== undefined) {
      const soldQuantity = existingTicketType.quantitySold;

      if (data.quantity < soldQuantity) {
        throw ApiError.badRequest(`Cannot reduce quantity below ${soldQuantity} (already sold)`);
      }

      updateData.quantityTotal = data.quantity;
      // existingTicketType.quantityHeld and quantitySold are numbers (from Prisma schema)
      updateData.quantityAvailable = data.quantity - soldQuantity - existingTicketType.quantityHeld;
    }

    // Update ticket type
    return await prisma.ticketType.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete ticket type
   */
  async deleteTicketType(id: string): Promise<void> {
    // Check if ticket type exists
    const existingTicketType = await prisma.ticketType.findUnique({
      where: { id },
    });

    if (!existingTicketType) {
      throw ApiError.notFound('Ticket type not found');
    }

    // Check if any tickets have been sold
    if (existingTicketType.quantitySold > 0) {
      throw ApiError.badRequest('Cannot delete ticket type with sold tickets');
    }

    // Delete ticket type
    await prisma.ticketType.delete({
      where: { id },
    });
  }

  /**
   * List ticket types for an event
   */
  async listTicketTypesByEvent(eventId: string): Promise<TicketType[]> {
    return await prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { price: 'asc' },
    });
  }

  /**
   * Check ticket availability
   */
  async checkAvailability(ticketTypeId: string, quantity: number): Promise<boolean> {
    const ticketType = await prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: {
        event: {
          select: {
            status: true,
            startDatetime: true,
          },
        },
      },
    });

    if (!ticketType) {
      throw ApiError.notFound('Ticket type not found');
    }

    // Check if event is published
    if (ticketType.event.status !== 'PUBLISHED') {
      return false;
    }

    // Check if event hasn't started yet
    if (ticketType.event && new Date() >= ticketType.event.startDatetime) {
      return false;
    }

    // Check sales window
    const now = new Date();
    if (ticketType.salesStart && now < ticketType.salesStart) {
      return false;
    }
    if (ticketType.salesEnd && now > ticketType.salesEnd) {
      return false;
    }

    // Check quantity available
    if (ticketType.quantityAvailable < quantity) {
      return false;
    }

    // Check max per order
    if (quantity > ticketType.maxPerOrder) {
      return false;
    }

    return true;
  }
}

export const ticketTypeService = new TicketTypeService();
