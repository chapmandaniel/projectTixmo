import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export const VOID_DISPUTED_CODE = 'VOID_DISPUTED';
export const DISPUTE_SCAN_REASON = 'VOID: disputed, see gate lead';
export const STRIPE_DISPUTE_ACTOR = 'stripe-dispute';
const VOID_AUDIT_PREFIX = 'ticket-void:';

export function orderDisputed(refundStatus?: string | null): boolean {
  return refundStatus === 'DISPUTED' || Boolean(refundStatus?.startsWith('DISPUTE_'));
}

export function disputeRefundStatus(outcome: string): string {
  const normalized = outcome
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `DISPUTE_${normalized || 'UNKNOWN'}`.slice(0, 64);
}

/**
 * A closed dispute outcome stays put. An in-flight or settled refund keeps its
 * own refundStatus so dispute bookkeeping cannot unfreeze or hide that money.
 */
export function nextDisputeRefundStatus(current: string, outcome?: string): string | null {
  if (current === 'PROCESSING' || current === 'SUCCEEDED') return null;
  if (!outcome) return current.startsWith('DISPUTE_') ? null : 'DISPUTED';
  const next = disputeRefundStatus(outcome);
  return next === current ? null : next;
}

type VoidAction = 'STAFF_VOID' | 'DISPUTE_CREATED' | 'DISPUTE_CLOSED';

/**
 * Cancel admission without releasing stock. Caller holds the order lock.
 * Refunds call transitionInventory and return capacity; a dispute or staff void
 * does not, because the charge still stands and a later manual restore must
 * not find the seat sold twice.
 */
export async function voidOrderTickets(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    ticketId?: string;
    actorId: string;
    reason: string;
    action: VoidAction;
    sourceId: string;
    voidTickets: boolean;
  }
): Promise<string[]> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) throw ApiError.badRequest('Reason is required');
  const tickets = await tx.ticket.findMany({
    where: { orderId: input.orderId, ...(input.ticketId ? { id: input.ticketId } : {}) },
    orderBy: { id: 'asc' },
    select: { id: true, status: true, inventoryState: true, ticketTypeId: true },
  });
  if (input.ticketId && tickets.length !== 1) throw ApiError.notFound('Ticket not found');
  const targets = input.voidTickets
    ? tickets.filter((ticket) => ticket.status !== 'CANCELLED')
    : [];
  if (targets.length) {
    const updated = await tx.ticket.updateMany({
      where: { id: { in: targets.map((ticket) => ticket.id) }, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    });
    if (updated.count !== targets.length) throw ApiError.conflict('Tickets changed during void');
  }
  const voided = new Set(targets.map((ticket) => ticket.id));
  const snapshot = (cancelled: boolean) =>
    tickets.map((ticket) => ({
      id: ticket.id,
      status: cancelled && voided.has(ticket.id) ? 'CANCELLED' : ticket.status,
      inventoryState: ticket.inventoryState,
    }));
  const before = snapshot(false);
  await tx.ticketInventoryReconciliation.create({
    data: {
      ticketTypeId: tickets[0]?.ticketTypeId || 'ticket-void',
      actorId: input.actorId,
      evidence: reason,
      snapshotFingerprint: createHash('sha256').update(JSON.stringify(before)).digest('hex'),
      planFingerprint: `${VOID_AUDIT_PREFIX}${input.action}:${input.sourceId}:${input.ticketId || input.orderId}`,
      before: {
        action: input.action,
        orderId: input.orderId,
        sourceId: input.sourceId,
        inventoryReleased: false,
        tickets: before,
      },
      after: {
        action: input.action,
        orderId: input.orderId,
        sourceId: input.sourceId,
        inventoryReleased: false,
        tickets: snapshot(true),
      },
    },
  });
  return targets.map((ticket) => ticket.id);
}

/**
 * payment_intent.succeeded can commit after charge.dispute.created. The dispute
 * handler will not void a still-pending order, so the paid transition has to
 * cancel those tickets itself. A second pass finds the dispute audit and does
 * not write another row.
 */
export async function voidDisputedAdmission(
  tx: Prisma.TransactionClient,
  order: { id: string; refundStatus: string | null }
): Promise<void> {
  if (!orderDisputed(order.refundStatus)) return;
  const audits = await tx.ticketInventoryReconciliation.findMany({
    where: { planFingerprint: { contains: order.id } },
  });
  const existing = audits.find(
    (row) =>
      row.planFingerprint.startsWith(`${VOID_AUDIT_PREFIX}DISPUTE_CREATED:`) &&
      row.planFingerprint.endsWith(`:${order.id}`)
  );
  const open = await tx.ticket.findMany({
    where: { orderId: order.id, status: { not: 'CANCELLED' } },
    orderBy: { id: 'asc' },
    select: { id: true, inventoryState: true },
  });
  if (!open.length) {
    if (existing) return;
    await voidOrderTickets(tx, {
      orderId: order.id,
      actorId: STRIPE_DISPUTE_ACTOR,
      reason: 'Payment disputed',
      action: 'DISPUTE_CREATED',
      sourceId: order.id,
      voidTickets: false,
    });
    return;
  }
  if (!existing) {
    await voidOrderTickets(tx, {
      orderId: order.id,
      actorId: STRIPE_DISPUTE_ACTOR,
      reason: 'Payment disputed',
      action: 'DISPUTE_CREATED',
      sourceId: order.id,
      voidTickets: true,
    });
    return;
  }
  const updated = await tx.ticket.updateMany({
    where: { id: { in: open.map((ticket) => ticket.id) }, status: { not: 'CANCELLED' } },
    data: { status: 'CANCELLED' },
  });
  if (updated.count !== open.length) throw ApiError.conflict('Tickets changed during void');
  const previous =
    existing.after && typeof existing.after === 'object' && !Array.isArray(existing.after)
      ? (existing.after as Record<string, unknown>)
      : {};
  const recorded = Array.isArray(previous.tickets)
    ? (previous.tickets as Array<{ id: string; status: string; inventoryState: string }>)
    : [];
  const live = new Map(open.map((ticket) => [ticket.id, ticket.inventoryState]));
  const seen = new Set<string>();
  const tickets = recorded.map((ticket) => {
    seen.add(ticket.id);
    const inventoryState = live.get(ticket.id);
    return inventoryState ? { id: ticket.id, status: 'CANCELLED', inventoryState } : ticket;
  });
  for (const ticket of open) {
    if (seen.has(ticket.id)) continue;
    tickets.push({ id: ticket.id, status: 'CANCELLED', inventoryState: ticket.inventoryState });
  }
  await tx.ticketInventoryReconciliation.update({
    where: { id: existing.id },
    data: {
      after: { ...previous, inventoryReleased: false, tickets },
    },
  });
}
