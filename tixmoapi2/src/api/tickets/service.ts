import { Ticket, TicketStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { generateQRCode, generateTicketQRData } from '../../utils/qrcode';
import { notificationService } from '../../utils/notificationService';
import { formatNewfoundlandDateTime } from '../../utils/eventTime';
import { formatVenueAddress } from '../../utils/receipt';

import prisma from '../../config/prisma';
import { assertEventCapability, assertTicketingAllows } from '../../services/ticketing-mode';
import crypto from 'crypto';
import {
  lockedTicket,
  ticketFailure,
  consumeTicket,
} from '../../services/ticket-admission.service';
import { recordStaffAction, StaffAudit } from '../../services/staff-action-audit';

const assertQrAdmission = (ticket: NonNullable<Awaited<ReturnType<typeof lockedTicket>>>): void => {
  if (ticket.order.status === 'REFUNDED') {
    throw ApiError.badRequest('Ticket has been refunded');
  }
  if (ticket.status === 'CANCELLED' || ticket.order.status === 'CANCELLED') {
    throw ApiError.badRequest('Ticket has been cancelled');
  }
  if (ticket.order.status !== 'PAID') {
    throw ApiError.badRequest('Ticket is not valid until payment is completed');
  }
};

interface ListTicketsParams {
  page?: number;
  limit?: number;
  eventId?: string;
  organizationId?: string;
  status?: TicketStatus;
  userId?: string;
  sortBy?: 'createdAt' | 'pricePaid' | 'status';
  sortOrder?: 'asc' | 'desc';
  includeHolder?: boolean;
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
    const {
      page = 1,
      limit = 20,
      eventId,
      organizationId,
      status,
      userId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeHolder = false,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};
    if (userId) where.userId = userId;
    if (eventId) {
      await assertEventCapability(eventId, 'attendees');
      where.eventId = eventId;
    }
    const eventWhere: Prisma.EventWhereInput = {};
    if (organizationId) eventWhere.organizationId = organizationId;
    if (userId && !eventId) eventWhere.ticketingMode = 'TIXMO';
    if (Object.keys(eventWhere).length) where.event = eventWhere;
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
              deletedAt: true,
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
              refundStatus: true,
            },
          },
          ...(includeHolder
            ? { user: { select: { firstName: true, lastName: true, email: true } } }
            : {}),
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
    const scope = await prisma.ticket.findUnique({
      where: { id },
      select: { eventId: true, userId: true },
    });
    if (scope) await assertEventCapability(scope.eventId, 'tickets');
    if (userId) {
      if (scope && scope.userId !== userId) return null;
      return await prisma.ticket.findFirst({
        where: { id, userId },
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
      where: { id },
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
  async transferTicket(id: string, currentUserId: string, recipientEmail: string) {
    const recipient = await prisma.user.findUnique({ where: { email: recipientEmail } });
    if (!recipient || recipient.disabledAt) throw ApiError.notFound('Recipient user not found');
    if (recipient.id === currentUserId)
      throw ApiError.badRequest('Cannot transfer ticket to yourself');
    const transferred = await prisma.$transaction(async (tx) => {
      const ticket = await lockedTicket(tx, id);
      if (!ticket) throw ApiError.notFound('Ticket not found');
      if (ticket.userId !== currentUserId)
        throw ApiError.forbidden('You can only transfer your own tickets');
      const failure = ticketFailure(ticket, true, false);
      if (failure)
        throw ApiError.badRequest(
          failure.reason,
          failure.reasonCode ? { reasonCode: failure.reasonCode } : undefined
        );
      assertTicketingAllows(ticket.event, 'transfers');
      if (ticket.event.startDatetime && new Date() >= ticket.event.startDatetime)
        throw ApiError.badRequest('Cannot transfer tickets for events that have already started');
      return tx.ticket.update({
        where: { id },
        data: {
          userId: recipient.id,
          transferredFrom: currentUserId,
          transferredAt: new Date(),
          status: 'VALID',
          barcode: `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
          qrCodeUrl: null,
        },
        include: {
          event: {
            select: {
              name: true,
              startDatetime: true,
              venue: { select: { name: true, address: true } },
            },
          },
        },
      });
    });
    const sender = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (sender && transferred.event.startDatetime)
      void notificationService
        .sendTicketTransfer({
          to: recipient.email,
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          senderName: `${sender.firstName} ${sender.lastName}`,
          eventName: transferred.event.name,
          eventDate: formatNewfoundlandDateTime(transferred.event.startDatetime),
          venueName: transferred.event.venue?.name || null,
          venueAddress: formatVenueAddress(transferred.event.venue?.address),
          ticketCount: 1,
        })
        .catch(() => false);
    // Ownership has changed. The sender receives an acknowledgement, never
    // the recipient's admission credential or account fields.
    return {
      id: transferred.id,
      userId: transferred.userId,
      status: transferred.status,
      transferredAt: transferred.transferredAt,
      transferredFrom: transferred.transferredFrom,
    };
  }

  /**
   * Cancel ticket. This always refunds the full order, so only OWNER/ADMIN may call it.
   */
  async cancelTicket(id: string, userId: string, role?: string): Promise<Ticket> {
    if (!['OWNER', 'ADMIN'].includes(role || '')) {
      throw new ApiError(403, 'All sales are final. Refunds are issued by Tixmo staff.', {
        code: 'BUYER_REFUNDS_DISABLED',
      });
    }
    const ticket = await prisma.ticket.findUnique({ where: { id }, include: { order: true } });
    if (!ticket) throw ApiError.notFound('Ticket not found');
    if (ticket.userId !== userId || ticket.order.userId !== userId)
      throw ApiError.forbidden('You can only refund your own orders');
    if (ticket.status === 'CANCELLED') throw ApiError.badRequest('Ticket is already cancelled');
    if ((await prisma.ticket.count({ where: { orderId: ticket.orderId } })) !== 1) {
      throw ApiError.badRequest(
        'Refund the full order from your order details; individual ticket refunds are unavailable'
      );
    }
    const { paymentService } = await import('../payments/service');
    // Beta policy supports full-order refunds; paid cancellation cannot merely
    // release inventory while leaving the customer's money at the processor.
    await paymentService.refundOrder(ticket.orderId);
    return prisma.ticket.findUniqueOrThrow({ where: { id } });
  }

  /**
   * Validate ticket (for check-in)
   */
  async validateTicket(barcode: string): Promise<{
    valid: boolean;
    ticket?: Ticket;
    reason?: string;
    reasonCode?: string;
  }> {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.ticket.findUnique({ where: { barcode }, select: { id: true } });
      const ticket = reference ? await lockedTicket(tx, reference.id) : null;
      if (!ticket) return { valid: false, reason: 'Ticket not found' };
      if (ticket.barcode !== barcode)
        return { valid: false, reason: 'Ticket credential is no longer valid' };
      const failure = ticketFailure(ticket, true, true);
      return {
        valid: !failure,
        ticket,
        reason: failure?.reason,
        reasonCode: failure?.reasonCode,
      };
    });
  }

  /**
   * Check in ticket (mark as used)
   */
  async checkInTicket(barcode: string, checkedInBy?: string, audit?: StaffAudit): Promise<Ticket> {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.ticket.findUnique({ where: { barcode }, select: { id: true } });
      const ticket = reference ? await lockedTicket(tx, reference.id) : null;
      if (!ticket || ticket.barcode !== barcode)
        throw ApiError.badRequest('Ticket credential is no longer valid');
      assertTicketingAllows(ticket.event, 'scan');
      const failure = ticketFailure(ticket, true, true);
      if (failure)
        throw ApiError.badRequest(
          failure.reason,
          failure.reasonCode ? { reasonCode: failure.reasonCode } : undefined
        );
      const updated = await consumeTicket(tx, ticket.id, checkedInBy);
      if (audit) {
        await recordStaffAction(tx, {
          action: 'CHECK_IN',
          subjectType: 'TICKET',
          subjectId: updated.id,
          organizationId: ticket.event.organizationId,
          actorId: audit.actorId,
          reason: audit.reason ?? 'Attendee check-in',
          before: { status: ticket.status },
          after: { status: 'USED' },
        });
      }
      return updated;
    });
  }

  /**
   * Generate QR code for a ticket
   */
  async generateTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const ticket = await lockedTicket(tx, ticketId);
      if (!ticket) throw ApiError.notFound('Ticket not found');
      if (userId && ticket.userId !== userId)
        throw ApiError.forbidden('You can only access QR codes for your own tickets');
      assertQrAdmission(ticket);
      const failure = ticketFailure(ticket, false, false);
      if (failure)
        throw ApiError.badRequest(
          failure.reason,
          failure.reasonCode ? { reasonCode: failure.reasonCode } : undefined
        );
      if (ticket.qrCodeUrl) return ticket.qrCodeUrl;
      const qr = await generateQRCode(
        generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId)
      );
      await tx.ticket.update({ where: { id: ticketId }, data: { qrCodeUrl: qr } });
      return qr;
    });
  }

  /**
   * Regenerate QR code for a ticket (e.g., after transfer or if compromised)
   */
  async regenerateTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const ticket = await lockedTicket(tx, ticketId);
      if (!ticket) throw ApiError.notFound('Ticket not found');
      if (userId && ticket.userId !== userId)
        throw ApiError.forbidden('You can only regenerate QR codes for your own tickets');
      const failure = ticketFailure(ticket, true, false);
      if (failure)
        throw ApiError.badRequest(
          failure.reason,
          failure.reasonCode ? { reasonCode: failure.reasonCode } : undefined
        );
      const barcode = `TIX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
      const qr = await generateQRCode(generateTicketQRData(ticket.id, barcode, ticket.eventId));
      await tx.ticket.update({ where: { id: ticketId }, data: { barcode, qrCodeUrl: qr } });
      return qr;
    });
  }

  /**
   * Get ticket QR code (retrieve existing or generate if missing)
   */
  async getTicketQRCode(ticketId: string, userId?: string): Promise<string> {
    return this.generateTicketQRCode(ticketId, userId);
  }
}

export const ticketService = new TicketService();
