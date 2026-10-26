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
