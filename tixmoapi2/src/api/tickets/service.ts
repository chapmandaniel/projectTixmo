import { Ticket, TicketStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { generateQRCode, generateTicketQRData } from '../../utils/qrcode';
import { notificationService } from '../../utils/notificationService';

import prisma from '../../config/prisma';

interface ListTicketsParams {
  page?: number;
  limit?: number;
  eventId?: string;
  status?: TicketStatus;
  userId?: string;
  sortBy?: 'createdAt' | 'pricePaid' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedTickets {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class TicketService {
  /**
   * List tickets for a user
   */
  async listTickets(params: ListTicketsParams): Promise<PaginatedTickets> {
    const { page = 1, limit = 20, eventId, status, userId, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};
    if (userId) where.userId = userId;
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          event: {
            select: {
              name: true,
              startDatetime: true,
              endDatetime: true,
              status: true,
              venue: {
                select: {
                  name: true,
                  address: true,
                },
              },
            },
          },
          ticketType: {
            select: {
              name: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              status: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(id: string, userId?: string): Promise<Ticket | null> {
    if (userId) {
      return await prisma.ticket.findFirst({
        where: { id, userId } as Prisma.TicketWhereInput,
        include: {
          event: {
            select: {
              name: true,
              slug: true,
              startDatetime: true,
              endDatetime: true,
              timezone: true,
              status: true,
              venue: { select: { name: true, address: true } },
            },
          },
          ticketType: { select: { name: true, description: true } },
          order: { select: { orderNumber: true, status: true, totalAmount: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });
    }

    return await prisma.ticket.findUnique({
      where: { id } as Prisma.TicketWhereUniqueInput,
      include: {
        event: {
          select: {
            name: true,
            slug: true,
            startDatetime: true,
            endDatetime: true,
            timezone: true,
            status: true,
            venue: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        },
        ticketType: {
          select: {
            name: true,
            description: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
            status: true,
            totalAmount: true,
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
   * Transfer ticket to another user
   */
  async transferTicket(id: string, currentUserId: string, recipientEmail: string): Promise<Ticket> {
    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
      },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    // Narrow types for safe property access
    const ticketTyped = ticket as unknown as Ticket & {
      event: { startDatetime: Date };
      userId: string;
      status: string;
    };

    // Check ownership
    if (ticketTyped.userId !== currentUserId) {
      throw ApiError.forbidden('You can only transfer your own tickets');
    }

    // Check if ticket is valid
    if (ticketTyped.status !== 'VALID') {
      throw ApiError.badRequest(`Cannot transfer ticket with status ${ticketTyped.status}`);
    }

    // Check if event hasn't started
    if (new Date() >= ticketTyped.event.startDatetime) {
      throw ApiError.badRequest('Cannot transfer tickets for events that have already started');
    }

    // Find recipient user
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
    });

    if (!recipient) {
      throw ApiError.notFound('Recipient user not found');
    }

    if (recipient.id === currentUserId) {
      throw ApiError.badRequest('Cannot transfer ticket to yourself');
    }

    // Transfer the ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        userId: recipient.id,
        transferredFrom: currentUserId,
        transferredAt: new Date(),
        status: 'VALID', // Reset to VALID so the recipient can actually use the ticket
      },
      include: {
        event: {
          select: {
            name: true,
            startDatetime: true,
          },
        },
      },
    });

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { firstName: true, lastName: true },
    });

    // Send transfer notification email (async, don't wait)
    if (sender && updatedTicket.event && updatedTicket.event.startDatetime) {
      notificationService
        .sendTicketTransfer({
          to: recipient.email,
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          senderName: `${sender.firstName} ${sender.lastName}`,
          eventName: updatedTicket.event.name,
          eventDate: updatedTicket.event.startDatetime.toLocaleDateString(),
          ticketCount: 1,
        })
        .catch((error) => console.error('Failed to send ticket transfer email:', error));
    }

    return updatedTicket;
  }

  /**
   * Cancel ticket
   */
  async cancelTicket(id: string, userId: string): Promise<Ticket> {
    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        event: true,
        order: true,
      },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    const ticketTyped2 = ticket as unknown as Ticket & {
      event: { startDatetime: Date };
      order: { status: string };
      userId: string;
      status: string;
    };

    // Check ownership
    if (ticketTyped2.userId !== userId) {
      throw ApiError.forbidden('You can only cancel your own tickets');
    }

    // Check if ticket is valid
    if (ticketTyped2.status === 'CANCELLED') {
      throw ApiError.badRequest('Ticket is already cancelled');
    }

    if (ticketTyped2.status === 'USED') {
      throw ApiError.badRequest('Cannot cancel a used ticket');
    }

    // Check if order is paid
    if (ticketTyped2.order.status !== 'PAID') {
      throw ApiError.badRequest('Can only cancel tickets from paid orders');
    }

    // Check if event hasn't started
    if (new Date() >= ticketTyped2.event.startDatetime) {
      throw ApiError.badRequest('Cannot cancel tickets for events that have already started');
    }

    // Cancel the ticket and restore inventory in a transaction
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // Cancel the ticket
      const cancelled = await tx.ticket.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      // Restore inventory on the ticket type
      await tx.ticketType.update({
        where: { id: cancelled.ticketTypeId },
        data: {
          quantitySold: { decrement: 1 },
          quantityAvailable: { increment: 1 },
        },
      });

      return cancelled;
    });

    return updatedTicket;
  }

  /**
   * Validate ticket (for check-in)
   */
  async validateTicket(barcode: string): Promise<{
    valid: boolean;
    ticket?: Ticket;
    reason?: string;
  }> {
    const ticket = await prisma.ticket.findUnique({
      where: { barcode },
      include: {
        event: {
          select: {
            name: true,
            startDatetime: true,
            endDatetime: true,
            status: true,
          },
        },
        ticketType: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return { valid: false, reason: 'Ticket not found' };
    }

    const ticketTyped3 = ticket as unknown as Ticket & {
      event: { startDatetime: Date; endDatetime: Date; status: string };
      status: string;
    };

    // Check if already used
    if (ticketTyped3.status === 'USED') {
      return { valid: false, ticket, reason: 'Ticket has already been used' };
    }

    // Check if cancelled
    if (ticketTyped3.status === 'CANCELLED') {
      return { valid: false, ticket, reason: 'Ticket has been cancelled' };
    }

    // Check if event is published or on sale
    if (!['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(ticketTyped3.event.status)) {
      return { valid: false, ticket, reason: 'Event is not currently active' };
    }

    // Check if within event timeframe
    const now = new Date();
    if (now < ticketTyped3.event.startDatetime) {
      return { valid: false, ticket, reason: 'Event has not started yet' };
    }

    if (now > ticketTyped3.event.endDatetime) {
      return { valid: false, ticket, reason: 'Event has already ended' };
    }

    return {
      valid: true,
      ticket,
    };
  }

  /**
   * Check in ticket (mark as used)
   */
  async checkInTicket(barcode: string, checkedInBy?: string): Promise<Ticket> {
    // Validate first
    const validation = await this.validateTicket(barcode);

    if (!validation.valid) {
      throw ApiError.badRequest(validation.reason || 'Ticket is not valid');
    }

    // Mark as used
    const updatedTicket = await prisma.ticket.update({
      where: { barcode },
      data: {
        status: 'USED',
        checkedInAt: new Date(),
        checkedInBy: checkedInBy || 'system',
      },
    });

    return updatedTicket;
  }

  /**
   * Generate QR code for a ticket
   */
  async generateTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    // Check ownership if userId provided
    if (userId && ticket.userId !== userId) {
      throw ApiError.forbidden('You can only generate QR codes for your own tickets');
    }

    // Generate QR code data
    const qrData = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);

    // Generate QR code as data URL
    const qrCodeDataUrl = await generateQRCode(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Update ticket with QR code URL (storing as data URL for now)
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      },
    });

    return qrCodeDataUrl;
  }

  /**
   * Regenerate QR code for a ticket (e.g., after transfer or if compromised)
   */
  async regenerateTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    // Check ownership if userId provided
    if (userId && ticket.userId !== userId) {
      throw ApiError.forbidden('You can only regenerate QR codes for your own tickets');
    }

    // Check if ticket is valid
    if (ticket.status === 'USED') {
      throw ApiError.badRequest('Cannot regenerate QR code for used tickets');
    }

    if (ticket.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot regenerate QR code for cancelled tickets');
    }

    // Generate new QR code
    const qrData = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const qrCodeDataUrl = await generateQRCode(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
    });

    // Update ticket
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      },
    });

    return qrCodeDataUrl;
  }

  /**
   * Get ticket QR code (retrieve existing or generate if missing)
   */
  async getTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw ApiError.notFound('Ticket not found');
    }

    // Check ownership if userId provided
    if (userId && ticket.userId !== userId) {
      throw ApiError.forbidden('You can only access QR codes for your own tickets');
    }

    // If QR code exists, return it
    if (ticket.qrCodeUrl) {
      return ticket.qrCodeUrl;
    }

    // Otherwise generate new one
    return await this.generateTicketQRCode(ticketId, userId);
  }
}

export const ticketService = new TicketService();
