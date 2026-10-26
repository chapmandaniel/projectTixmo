import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { lockOrder } from './order-inventory.service';
import { DISPUTE_SCAN_REASON, orderDisputed, VOID_DISPUTED_CODE } from './ticket-void.service';

export type AdmissionDenial = {
  reason: string;
  reasonCode?: string;
};

export async function lockedTicket(tx: Prisma.TransactionClient, id: string) {
  const reference = await tx.ticket.findUnique({
    where: { id },
    select: { orderId: true, eventId: true },
  });
  if (!reference) return null;
  await lockOrder(tx, reference.orderId);
  await tx.$queryRaw`SELECT id FROM events WHERE id = ${reference.eventId} FOR UPDATE`;
  return tx.ticket.findUnique({
    where: { id },
    include: {
      event: true,
      ticketType: true,
      order: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

// Attendees check-in opens at doors, two hours before the event start.
export const DOORS_BEFORE_START_MS = 2 * 60 * 60 * 1000;

export function ticketFailure(
  ticket: NonNullable<Awaited<ReturnType<typeof lockedTicket>>>,
  entry: boolean,
  enforceTime: boolean
): AdmissionDenial | undefined {
  // Disputed admission is void. This sits ahead of the VALID/USED/CANCELLED
  // cases so a still-VALID ticket (closed dispute arrived first) and a future
  // VOID status both deny here, instead of scanning or falling through to
  // "Ticket credential must be reissued".
  const status = ticket.status as string;
  if (orderDisputed(ticket.order.refundStatus) || status === 'VOID') {
    return { reason: DISPUTE_SCAN_REASON, reasonCode: VOID_DISPUTED_CODE };
  }
  if (ticket.status === 'CANCELLED') return { reason: 'Ticket has been cancelled' };
  if (entry && ticket.status === 'USED') return { reason: 'Ticket has already been used' };
  if (!['VALID', 'USED'].includes(ticket.status))
    return { reason: 'Ticket credential must be reissued' };
  if (ticket.order.status !== 'PAID')
    return { reason: 'Ticket is not valid until payment is completed' };
  if (ticket.order.refundStatus === 'PROCESSING')
    return { reason: 'Ticket has a refund in progress' };
  if (ticket.event.deletedAt || !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(ticket.event.status))
    return { reason: 'Event is not active for scanning' };
  if (
    enforceTime &&
    ticket.event.startDatetime &&
    new Date() < new Date(ticket.event.startDatetime.getTime() - DOORS_BEFORE_START_MS)
  )
    return { reason: 'Event has not started yet' };
  if (enforceTime && ticket.event.endDatetime && new Date() > ticket.event.endDatetime)
    return { reason: 'Event has already ended' };
  return undefined;
}

export async function consumeTicket(
  tx: Prisma.TransactionClient,
  id: string,
  checkedInBy?: string
) {
  const result = await tx.ticket.updateMany({
    where: { id, status: 'VALID' },
    data: {
      status: 'USED',
      checkedInAt: new Date(),
      checkedInBy: checkedInBy || 'system',
    },
  });
  if (result.count !== 1) throw ApiError.conflict('Ticket has already been used');
  return tx.ticket.findUniqueOrThrow({ where: { id } });
}
