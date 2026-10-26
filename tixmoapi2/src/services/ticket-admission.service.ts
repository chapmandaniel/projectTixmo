import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { lockOrder } from './order-inventory.service';
import { DISPUTE_SCAN_REASON, orderDisputed } from './ticket-void.service';

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

export function ticketFailure(
  ticket: NonNullable<Awaited<ReturnType<typeof lockedTicket>>>,
  entry: boolean,
  enforceTime: boolean
): string | undefined {
  if (orderDisputed(ticket.order.refundStatus)) return DISPUTE_SCAN_REASON;
  if (ticket.status === 'CANCELLED') return 'Ticket has been cancelled';
  if (entry && ticket.status === 'USED') return 'Ticket has already been used';
  if (!['VALID', 'USED'].includes(ticket.status)) return 'Ticket credential must be reissued';
  if (ticket.order.status !== 'PAID') return 'Ticket is not valid until payment is completed';
  if (ticket.order.refundStatus === 'PROCESSING') return 'Ticket has a refund in progress';
  if (ticket.event.deletedAt || !['PUBLISHED', 'ON_SALE', 'SOLD_OUT'].includes(ticket.event.status))
    return 'Event is not active for scanning';
  if (enforceTime && ticket.event.startDatetime && new Date() < ticket.event.startDatetime)
    return 'Event has not started yet';
  if (enforceTime && ticket.event.endDatetime && new Date() > ticket.event.endDatetime)
    return 'Event has already ended';
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
