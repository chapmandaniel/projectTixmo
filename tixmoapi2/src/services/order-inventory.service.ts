import { Prisma, TicketInventoryState } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

// Every operation affecting a purchased ticket takes its order lock first.
// Fresh state under this lock owns both the ticket transition and its counters.
export async function lockOrder(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`;
}

export async function transitionInventory(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: TicketInventoryState,
  to: 'SOLD' | 'RELEASED'
): Promise<void> {
  const tickets = await tx.ticket.findMany({ where: { orderId, inventoryState: from } });
  if (await tx.ticket.count({ where: { orderId, inventoryState: 'UNKNOWN' } })) {
    throw ApiError.conflict('Historical inventory must be reconciled before this order can change');
  }
  const types = new Map<string, number>();
  const tiers = new Map<string, number>();
  for (const ticket of tickets) {
    types.set(ticket.ticketTypeId, (types.get(ticket.ticketTypeId) || 0) + 1);
    if (ticket.tierId) tiers.set(ticket.tierId, (tiers.get(ticket.tierId) || 0) + 1);
  }
  const source = from === 'HELD' ? 'quantityHeld' : 'quantitySold';
  for (const [id, quantity] of [...types].sort(([a], [b]) => a.localeCompare(b))) {
    const result = await tx.ticketType.updateMany({
      where: { id, [source]: { gte: quantity } },
      data: {
        [source]: { decrement: quantity },
        ...(to === 'SOLD'
          ? { quantitySold: { increment: quantity } }
          : { quantityAvailable: { increment: quantity } }),
      },
    });
    if (result.count !== 1) throw ApiError.conflict('Order inventory is inconsistent');
  }
  for (const [id, quantity] of [...tiers].sort(([a], [b]) => a.localeCompare(b))) {
    const result = await tx.ticketTier.updateMany({
      where: { id, [source]: { gte: quantity } },
      data: {
        [source]: { decrement: quantity },
        ...(to === 'SOLD' ? { quantitySold: { increment: quantity } } : {}),
      },
    });
    if (result.count !== 1) throw ApiError.conflict('Order tier allocation is inconsistent');
  }
  await tx.ticket.updateMany({
    where: { orderId, inventoryState: from },
    data: { inventoryState: to, ...(to === 'RELEASED' ? { status: 'CANCELLED' } : {}) },
  });
}

export async function transitionPromo(
  tx: Prisma.TransactionClient,
  orderId: string,
  to: 'USED' | 'RELEASED'
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.promoCodeId || order.promoReservation !== 'HELD') return;
  const result = await tx.promoCode.updateMany({
    where: { id: order.promoCodeId, usesHeld: { gt: 0 } },
    data: { usesHeld: { decrement: 1 }, ...(to === 'USED' ? { usesCount: { increment: 1 } } : {}) },
  });
  if (result.count !== 1) throw ApiError.conflict('Promo reservation is inconsistent');
  await tx.order.update({ where: { id: orderId }, data: { promoReservation: to } });
}
