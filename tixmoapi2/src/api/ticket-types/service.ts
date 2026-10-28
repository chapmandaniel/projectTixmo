import { ApiError } from '../../utils/ApiError';
import { TicketType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import prisma from '../../config/prisma';

export const ticketTypeDisplayOrder: Prisma.TicketTypeOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

const ticketTypeListOrder = (
  sortBy: 'price' | 'status' | 'sold' | 'name' | 'createdAt' | undefined,
  direction: 'asc' | 'desc'
): Prisma.TicketTypeOrderByWithRelationInput[] => {
  if (!sortBy) return ticketTypeDisplayOrder;
  const primary: Prisma.TicketTypeOrderByWithRelationInput =
    sortBy === 'sold'
      ? { quantitySold: direction }
      : sortBy === 'status'
        ? { status: direction }
        : sortBy === 'name'
          ? { name: direction }
          : sortBy === 'createdAt'
            ? { createdAt: direction }
            : { price: direction };
  const field = sortBy === 'sold' ? 'quantitySold' : sortBy;
  return [primary, ...ticketTypeDisplayOrder.filter((rule) => !(field in rule))];
};

interface CreateTicketTypeInput {
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
  maxPerOrder?: number;
  salesStart?: string;
  salesEnd?: string;
  metadata?: Record<string, unknown>;
  status?: 'ACTIVE' | 'HIDDEN' | 'SOLD_OUT';
  sortOrder?: number;
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
  sortOrder?: number;
  status?: 'ACTIVE' | 'HIDDEN' | 'SOLD_OUT';
}

export class TicketTypeService {
  /**
   * Create a new ticket type
   */
  async createTicketType(
    data: CreateTicketTypeInput,
    db: Prisma.TransactionClient = prisma
  ): Promise<TicketType> {
    // Validate event exists
    const event = await db.event.findUnique({ where: { id: data.eventId } });
    if (!event) throw ApiError.notFound('Event not found');

    return await db.ticketType.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        description: data.description ?? null,
        price: new Decimal(data.price),
        quantityTotal: data.quantity,
        quantityAvailable: data.quantity,
        maxPerOrder: data.maxPerOrder ?? 10,
        salesStart: data.salesStart ? new Date(data.salesStart) : null,
        salesEnd: data.salesEnd ? new Date(data.salesEnd) : null,
        metadata: (data.metadata as any) ?? null,
        status: data.status ?? 'ACTIVE',
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
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
    return prisma.$transaction((tx) => this.updateTicketTypeInTransaction(tx, id, data));
  }

  async updateTicketTypeInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    data: UpdateTicketTypeInput & { status?: 'ACTIVE' | 'HIDDEN' | 'SOLD_OUT' }
  ): Promise<TicketType> {
    await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${id} FOR UPDATE`;
    // Read counters while reservations and transitions are excluded.
    const existingTicketType = await tx.ticketType.findUnique({
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

    if (data.status !== undefined) updateData.status = data.status;
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = new Decimal(data.price);
    if (data.maxPerOrder !== undefined) updateData.maxPerOrder = data.maxPerOrder;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    if (data.salesStart !== undefined) {
      updateData.salesStart = data.salesStart ? new Date(data.salesStart) : null;
    }
    if (data.salesEnd !== undefined) {
      updateData.salesEnd = data.salesEnd ? new Date(data.salesEnd) : null;
    }

    // Handle quantity update - adjust quantityAvailable accordingly
    if (data.quantity !== undefined) {
      const soldQuantity = existingTicketType.quantitySold;
      const heldQuantity = existingTicketType.quantityHeld;

      if (data.quantity < soldQuantity + heldQuantity) {
        throw ApiError.badRequest(
          `Cannot reduce quantity below ${soldQuantity + heldQuantity} (${soldQuantity} sold + ${heldQuantity} held)`
        );
      }

      updateData.quantityTotal = data.quantity;
      updateData.quantityAvailable = data.quantity - soldQuantity - heldQuantity;
    }

    // Update ticket type
    return await tx.ticketType.update({
      where: { id },
      data: {
        ...updateData,
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
  async listTicketTypesByEvent(
    eventId: string,
    sortBy?: 'price' | 'status' | 'sold' | 'name' | 'createdAt',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<TicketType[]> {
    return await prisma.ticketType.findMany({
      where: { eventId },
      orderBy: ticketTypeListOrder(sortBy, sortOrder),
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

    // Check if event is published or on sale
    if (!['PUBLISHED', 'ON_SALE'].includes(ticketType.event.status)) {
      return false;
    }

    // Check ticket type status (reject HIDDEN and SOLD_OUT)
    if (ticketType.status === 'HIDDEN' || ticketType.status === 'SOLD_OUT') {
      return false;
    }

    // Check if event hasn't started yet
    // Ensure both event and startDatetime are present and not null
    if (ticketType.event && ticketType.event.startDatetime) {
      if (new Date() >= ticketType.event.startDatetime) {
        return false;
      }
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
