import { Response } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { writeStaffAction } from '../../services/staff-action-audit';
import { assertEventAccess, getActorScope, isGlobalAdmin } from '../../utils/tenantScope';
import { ticketService } from './service';

const canManageTickets = (role?: string) => ['OWNER', 'ADMIN', 'MANAGER'].includes(role || '');

const recordTicketPiiView = async (
  actorId: string,
  reason: string,
  subjectType: 'EVENT' | 'TICKET',
  subjectId: string,
  eventId?: string | null
) => {
  if (!eventId) return;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event) return;
  await writeStaffAction({
    action: 'STAFF_PII_VIEW',
    subjectType,
    subjectId,
    organizationId: event.organizationId,
    actorId,
    reason,
  });
};

export const listMyTickets = catchAsync(async (req: AuthRequest, res: Response) => {
  res.json(
    successResponse(
      await ticketService.listTickets({
        ...req.query,
        userId: req.user!.userId,
        includeHolder: false,
      })
    )
  );
});

export const listTickets = catchAsync(async (req: AuthRequest, res: Response) => {
  const staff = canManageTickets(req.user!.role);
  const requestedEventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
  let organizationId: string | undefined;
  if (staff) {
    const actor = await getActorScope(req);
    if (requestedEventId) {
      await assertEventAccess(actor, requestedEventId);
    }
    if (!isGlobalAdmin(actor)) {
      if (!actor.organizationId) {
        throw ApiError.forbidden("You do not have access to this organization's resources");
      }
      organizationId = actor.organizationId;
    }
  }
  const result = await ticketService.listTickets({
    ...req.query,
    userId: staff ? undefined : req.user!.userId,
    includeHolder: staff,
    organizationId,
  });
  if (staff) {
    const eventId = requestedEventId || result.tickets[0]?.eventId;
    if (eventId) {
      await recordTicketPiiView(req.user!.userId, 'Staff ticket list', 'EVENT', eventId, eventId);
    }
  }

  res.json(successResponse(result));
});

export const getTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = canManageTickets(req.user!.role) ? undefined : req.user!.userId;

  const ticket = await ticketService.getTicketById(id, userId);

  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  if (canManageTickets(req.user!.role)) {
    await recordTicketPiiView(
      req.user!.userId,
      'Staff ticket detail',
      'TICKET',
      ticket.id,
      ticket.eventId
    );
  }

  res.json(successResponse(ticket));
});

export const transferTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { recipientEmail } = req.body as { recipientEmail: string };
  const userId = req.user!.userId;

  const ticket = await ticketService.transferTicket(id, userId, recipientEmail);
  res.json(successResponse(ticket, 'Ticket transferred successfully'));
});

export const cancelTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  // Cancelling a ticket refunds the order. Buyers keep unpaid reservation
  // cancellation on POST /orders/:id/cancel, where no money moves.
  if (!['OWNER', 'ADMIN'].includes(req.user!.role)) {
    throw new ApiError(403, 'All sales are final. Refunds are issued by Tixmo staff.', {
      code: 'BUYER_REFUNDS_DISABLED',
    });
  }
  const { id } = req.params;
  const userId = req.user!.userId;

  const ticket = await ticketService.cancelTicket(id, userId, req.user!.role);
  res.json(
    successResponse(
      ticket,
      ticket.status === 'CANCELLED'
        ? 'Ticket cancelled and order refunded successfully'
        : 'Refund submitted; awaiting processor confirmation'
    )
  );
});

export const validateTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { barcode } = req.body as { barcode: string };

  const result = await ticketService.validateTicket(barcode);
  res.json(successResponse(result));
});

export const checkInTicket = catchAsync(async (req: AuthRequest, res: Response) => {
  const { barcode } = req.body as { barcode: string };
  const checkedInBy = req.user!.email;

  const ticket = await ticketService.checkInTicket(barcode, checkedInBy, {
    actorId: req.user!.userId,
    reason: 'Attendee check-in',
  });
  res.json(successResponse(ticket, 'Ticket checked in successfully'));
});

export const getTicketQRCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = canManageTickets(req.user!.role) ? undefined : req.user!.userId;

  const qrCodeDataUrl = await ticketService.getTicketQRCode(id, userId);

  res.json(successResponse({ qrCode: qrCodeDataUrl }, 'QR code retrieved successfully'));
});

export const regenerateTicketQRCode = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = canManageTickets(req.user!.role) ? undefined : req.user!.userId;

  const qrCodeDataUrl = await ticketService.regenerateTicketQRCode(id, userId);

  res.json(successResponse({ qrCode: qrCodeDataUrl }, 'QR code regenerated successfully'));
});
