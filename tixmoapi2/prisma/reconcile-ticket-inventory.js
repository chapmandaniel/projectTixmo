'use strict';

const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { PrismaClient, Prisma } = require('@prisma/client');
const { isUpcoming } = require('./lib/upcoming.cjs');

const MAX_TICKETS = 25000;
const SYSTEM_ACTOR = 'system-inventory-reconcile';
const SYSTEM_EVIDENCE =
  'System inventory reconcile. Counters follow allocated tickets that already have a tier. UNKNOWN inventory and tickets with no tier stay flagged.';
const RESOLVE_EVIDENCE =
  'System inventory reconcile. A PAID or PARTIALLY_REFUNDED order with a VALID or USED ticket becomes SOLD. A REFUNDED or CANCELLED order becomes RELEASED. Ambiguous tickets are listed and not written. A paid valid seat is never released.';
const MAX_PLAN_BYTES = 8 * 1024 * 1024;
const allocated = (state) => ['HELD', 'SOLD'].includes(state);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
class OperatorError extends Error {}
const reject = (message) => {
  throw new OperatorError(message);
};
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const evidence = (value) =>
  typeof value === 'string' && value.trim().length >= 10 && value.length <= 500;
const sorted = (rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

function explicitTarget(env) {
  const value = env.TIXMO_INVENTORY_DATABASE_URL;
  let target;
  try {
    target = new URL(value || '');
  } catch {
    reject('An explicit TIXMO_INVENTORY_DATABASE_URL is required.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !target.hostname ||
    target.pathname.length < 2 ||
    (target.searchParams.get('schema') && target.searchParams.get('schema') !== 'public') ||
    (env.DATABASE_URL && env.DATABASE_URL !== value)
  ) {
    reject(
      'The explicit inventory target must use PostgreSQL/public and match the inherited DATABASE_URL if present.'
    );
  }
  return {
    url: target.toString(),
    fingerprint: digest([
      target.hostname,
      target.port || '5432',
      decodeURIComponent(target.pathname),
      'public',
    ]),
  };
}

async function readSnapshot(db, id) {
  if (!identifier(id)) reject('A valid ticket-type ID is required.');
  const type = await db.ticketType.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      price: true,
      quantityTotal: true,
      quantityAvailable: true,
      quantityHeld: true,
      quantitySold: true,
      tierInventoryStatus: true,
      status: true,
      updatedAt: true,
      event: { select: { id: true, organizationId: true, status: true, updatedAt: true } },
    },
  });
  if (!type) reject('Ticket type was not found.');
  const tiers = await db.ticketTier.findMany({
    where: { ticketTypeId: id },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      ticketTypeId: true,
      name: true,
      price: true,
      quantityLimit: true,
      quantityHeld: true,
      quantitySold: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const tickets = await db.ticket.findMany({
    where: { ticketTypeId: id },
    orderBy: { id: 'asc' },
    take: MAX_TICKETS + 1,
    select: {
      id: true,
      orderId: true,
      eventId: true,
      tierId: true,
      inventoryState: true,
      pricePaid: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (tickets.length > MAX_TICKETS)
    reject('This ticket type exceeds the 25,000-ticket reconciliation limit.');
  const orderIds = [...new Set(tickets.map((t) => t.orderId))].sort();
  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      eventId: true,
      status: true,
      paymentStatus: true,
      refundStatus: true,
      currency: true,
      totalAmount: true,
      paymentIntentId: true,
      updatedAt: true,
    },
  });
  return { type, tiers: sorted(tiers), tickets: sorted(tickets), orders: sorted(orders) };
}

function snapshotFingerprint(snapshot) {
  return digest(snapshot);
}

function draft(snapshot, targetFingerprint) {
  return {
    version: 1,
    ticketTypeId: snapshot.type.id,
    targetFingerprint,
    snapshotFingerprint: snapshotFingerprint(snapshot),
    actorId: '',
    evidence: '',
    counterEvidence: '',
    assignments: [],
    review: {
      type: snapshot.type,
      tiers: snapshot.tiers,
      tickets: snapshot.tickets.map((t) => ({
        id: t.id,
        tierId: t.tierId,
        inventoryState: t.inventoryState,
        pricePaid: t.pricePaid,
        createdAt: t.createdAt,
        candidates: snapshot.tiers
          .filter((tier) => historicalMatch(t, tier))
          .map((tier) => tier.id),
      })),
      note: 'Add explicit assignments for unattributed HELD/SOLD tickets. A price or historical-window mismatch requires its own evidence. UNKNOWN inventory must first be resolved through financial/provider reconciliation.',
    },
  };
}

function historicalMatch(ticket, tier) {
  return (
    new Prisma.Decimal(ticket.pricePaid).equals(tier.price) &&
    new Date(ticket.createdAt) >= new Date(tier.createdAt) &&
    (!tier.startsAt || new Date(ticket.createdAt) >= new Date(tier.startsAt)) &&
    (!tier.endsAt || new Date(ticket.createdAt) < new Date(tier.endsAt))
  );
}

function normalizedPlan(plan) {
  if (
    !plan ||
    plan.version !== 1 ||
    !identifier(plan.ticketTypeId) ||
    !identifier(plan.actorId) ||
    !evidence(plan.evidence) ||
    !/^[a-f0-9]{64}$/.test(plan.targetFingerprint || '') ||
    !/^[a-f0-9]{64}$/.test(plan.snapshotFingerprint || '') ||
    !Array.isArray(plan.assignments) ||
    plan.assignments.length > MAX_TICKETS ||
    (plan.counterEvidence !== undefined &&
      plan.counterEvidence !== '' &&
      !evidence(plan.counterEvidence))
  ) {
    reject(
      'Plan requires version 1, target/snapshot fingerprints, an operator ID, evidence and an assignments array.'
    );
  }
  const seen = new Set();
  const assignments = plan.assignments
    .map((a) => {
      if (
        !a ||
        !identifier(a.ticketId) ||
        !identifier(a.tierId) ||
        seen.has(a.ticketId) ||
        (a.evidence !== undefined && a.evidence !== '' && !evidence(a.evidence))
      ) {
        reject('Assignments require unique valid ticket IDs, tier IDs and optional evidence.');
      }
      seen.add(a.ticketId);
      return { ticketId: a.ticketId, tierId: a.tierId, evidence: a.evidence || '' };
    })
    .sort((a, b) => a.ticketId.localeCompare(b.ticketId));
  return {
    version: 1,
    ticketTypeId: plan.ticketTypeId,
    targetFingerprint: plan.targetFingerprint,
    snapshotFingerprint: plan.snapshotFingerprint,
    actorId: plan.actorId,
    evidence: plan.evidence.trim(),
    counterEvidence: plan.counterEvidence?.trim() || '',
    assignments,
  };
}

async function checkActor(db, actorId) {
  const actor = await db.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      role: true,
      disabledAt: true,
      isPlatformAdmin: true,
      organization: { select: { status: true } },
    },
  });
  if (
    !actor ||
    actor.disabledAt ||
    !['OWNER', 'ADMIN'].includes(actor.role) ||
    (!(actor.role === 'ADMIN' && actor.isPlatformAdmin) && actor.organization?.status !== 'ACTIVE')
  ) {
    reject(
      'Reconciliation requires an enabled OWNER/ADMIN with an active business or platform authority.'
    );
  }
}

function outcome(snapshot, plan, targetFingerprint) {
  if (plan.targetFingerprint !== targetFingerprint)
    reject('The plan belongs to a different database target.');
  if (plan.snapshotFingerprint !== snapshotFingerprint(snapshot))
    reject('Inventory changed since inspection; generate and review a fresh plan.');
  if (snapshot.type.tierInventoryStatus !== 'REQUIRES_RECONCILIATION')
    reject('This pricing schedule is not awaiting reconciliation.');
  if (snapshot.tickets.some((t) => t.inventoryState === 'UNKNOWN'))
    reject('UNKNOWN inventory needs confirmed financial/provider reconciliation first.');
  const tickets = new Map(snapshot.tickets.map((t) => [t.id, t]));
  const tiers = new Map(snapshot.tiers.map((t) => [t.id, t]));
  const assignments = new Map(plan.assignments.map((a) => [a.ticketId, a]));
  const orders = new Map(snapshot.orders.map((o) => [o.id, o]));
  for (const assignment of plan.assignments) {
    const ticket = tickets.get(assignment.ticketId),
      tier = tiers.get(assignment.tierId);
    if (!ticket || !tier || !allocated(ticket.inventoryState))
      reject(
        'Every assignment must name an allocated ticket and tier belonging to this ticket type.'
      );
    if (!historicalMatch(ticket, tier) && !evidence(assignment.evidence)) {
      reject(
        'Historical price/window overrides require explicit evidence on each affected assignment.'
      );
    }
  }
  const counters = new Map(
    snapshot.tiers.map((t) => [t.id, { id: t.id, quantitySold: 0, quantityHeld: 0 }])
  );
  const changes = [];
  let held = 0,
    sold = 0;
  for (const ticket of snapshot.tickets) {
    if (ticket.eventId !== snapshot.type.eventId) reject('Ticket/event binding is inconsistent.');
    if (!allocated(ticket.inventoryState)) continue;
    const order = orders.get(ticket.orderId);
    if (
      !order ||
      order.eventId !== snapshot.type.eventId ||
      (ticket.inventoryState === 'HELD' && order.status !== 'PENDING') ||
      (ticket.inventoryState === 'SOLD' &&
        (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.status) ||
          order.paymentStatus !== 'SUCCEEDED' ||
          ['REQUESTED', 'PENDING', 'UNCERTAIN'].includes(order.refundStatus)))
    ) {
      reject('Allocated ticket/order state is inconsistent; reconcile financial state first.');
    }
    const tierId = assignments.get(ticket.id)?.tierId ?? ticket.tierId;
    if (
      (snapshot.tiers.length && (!tierId || !counters.has(tierId))) ||
      (!snapshot.tiers.length && tierId)
    ) {
      reject('Every allocated ticket needs a valid allocation in the configured pricing schedule.');
    }
    if (ticket.inventoryState === 'HELD') held++;
    else sold++;
    if (tierId)
      counters.get(tierId)[ticket.inventoryState === 'HELD' ? 'quantityHeld' : 'quantitySold']++;
    if (tierId !== ticket.tierId)
      changes.push({
        ticketId: ticket.id,
        beforeTierId: ticket.tierId,
        afterTierId: tierId,
        evidence: assignments.get(ticket.id).evidence,
      });
  }
  if (held + sold > snapshot.type.quantityTotal)
    reject('Allocated tickets exceed ticket-type capacity; accept a capacity correction first.');
  for (const tier of snapshot.tiers) {
    const c = counters.get(tier.id);
    if (tier.quantityLimit !== null && c.quantityHeld + c.quantitySold > tier.quantityLimit) {
      reject('Allocated tickets exceed a tier limit; accept a capacity correction first.');
    }
  }
  const quantityAvailable = snapshot.type.quantityTotal - held - sold;
  const stockReleases = [];
  for (const [scope, before, after] of [
    ['type', snapshot.type, { quantityHeld: held, quantitySold: sold }],
    ...snapshot.tiers.map((t) => ['tier', t, counters.get(t.id)]),
  ]) {
    for (const field of ['quantityHeld', 'quantitySold']) {
      if (after[field] < before[field])
        stockReleases.push({
          scope,
          id: before.id,
          field,
          before: before[field],
          after: after[field],
        });
    }
  }
  if (quantityAvailable > snapshot.type.quantityAvailable) {
    stockReleases.push({
      scope: 'type',
      id: snapshot.type.id,
      field: 'quantityAvailable',
      before: snapshot.type.quantityAvailable,
      after: quantityAvailable,
    });
  }
  if (stockReleases.length && !evidence(plan.counterEvidence)) {
    reject(
      'Releasing stock requires separate counterEvidence confirming the complete allocation ledger.'
    );
  }
  return {
    type: {
      quantityTotal: snapshot.type.quantityTotal,
      quantityHeld: held,
      quantitySold: sold,
      quantityAvailable,
      tierInventoryStatus: 'READY',
    },
    tiers: [...counters.values()],
    changes,
    stockReleases,
  };
}

async function inspectInventory(prisma, id, targetFingerprint) {
  return prisma.$transaction(
    async (db) => {
      await db.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return draft(await readSnapshot(db, id), targetFingerprint);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 }
  );
}

async function previewInventory(prisma, input, targetFingerprint) {
  const plan = normalizedPlan(input);
  return prisma.$transaction(
    async (db) => {
      await db.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await checkActor(db, plan.actorId);
      const snapshot = await readSnapshot(db, plan.ticketTypeId);
      const result = outcome(snapshot, plan, targetFingerprint);
      return {
        planFingerprint: digest(plan),
        ticketTypeId: plan.ticketTypeId,
        changedTickets: result.changes.length,
        before: {
          type: {
            quantityHeld: snapshot.type.quantityHeld,
            quantitySold: snapshot.type.quantitySold,
            quantityAvailable: snapshot.type.quantityAvailable,
            tierInventoryStatus: snapshot.type.tierInventoryStatus,
          },
          tiers: snapshot.tiers.map((t) => ({
            id: t.id,
            quantityHeld: t.quantityHeld,
            quantitySold: t.quantitySold,
          })),
        },
        type: result.type,
        tiers: result.tiers,
        stockReleases: result.stockReleases,
        writes: false,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 }
  );
}

async function applyInventory(prisma, input, confirmation, targetFingerprint, env = process.env) {
  if (
    env.TIXMO_ALLOW_INVENTORY_RECONCILIATION !== 'true' ||
    env.TIXMO_INVENTORY_WRITERS_QUIESCED !== 'true'
  ) {
    reject(
      'Apply requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true.'
    );
  }
  const plan = normalizedPlan(input),
    planFingerprint = digest(plan);
  if (confirmation !== planFingerprint)
    reject('Apply requires the exact reviewed --confirm-plan fingerprint.');
  return prisma.$transaction(
    async (db) => {
      const initial = await readSnapshot(db, plan.ticketTypeId);
      // Match application writers: event, orders in ID order, then ticket type.
      await db.$queryRaw`SELECT id FROM events WHERE id = ${initial.type.eventId} FOR UPDATE`;
      const orderIds = [...new Set(initial.tickets.map((t) => t.orderId))].sort();
      if (orderIds.length) {
        await db.$queryRaw(
          Prisma.sql`SELECT id FROM orders WHERE id IN (${Prisma.join(orderIds)}) ORDER BY id FOR UPDATE`
        );
      }
      await db.$queryRaw`SELECT id FROM ticket_types WHERE id = ${plan.ticketTypeId} FOR UPDATE`;
      await db.$queryRaw`SELECT id FROM users WHERE id = ${plan.actorId} FOR SHARE`;
      await checkActor(db, plan.actorId);
      const snapshot = await readSnapshot(db, plan.ticketTypeId),
        result = outcome(snapshot, plan, targetFingerprint);
      const batches = new Map();
      for (const change of result.changes) {
        const ids = batches.get(change.afterTierId) || [];
        ids.push(change.ticketId);
        batches.set(change.afterTierId, ids);
      }
      for (const [tierId, ids] of batches) {
        const updated = await db.ticket.updateMany({
          where: {
            id: { in: ids },
            ticketTypeId: plan.ticketTypeId,
            inventoryState: { in: ['HELD', 'SOLD'] },
          },
          data: { tierId },
        });
        if (updated.count !== ids.length)
          reject('Inventory changed while allocations were being applied.');
      }
      for (const tier of result.tiers) {
        await db.ticketTier.update({
          where: { id: tier.id },
          data: {
            quantitySold: tier.quantitySold,
            quantityHeld: tier.quantityHeld,
          },
        });
      }
      await db.ticketType.update({ where: { id: plan.ticketTypeId }, data: result.type });
      const audit = await db.ticketInventoryReconciliation.create({
        data: {
          ticketTypeId: plan.ticketTypeId,
          actorId: plan.actorId,
          evidence: plan.evidence,
          snapshotFingerprint: plan.snapshotFingerprint,
          planFingerprint,
          before: {
            type: {
              quantityTotal: snapshot.type.quantityTotal,
              quantityHeld: snapshot.type.quantityHeld,
              quantitySold: snapshot.type.quantitySold,
              quantityAvailable: snapshot.type.quantityAvailable,
              tierInventoryStatus: snapshot.type.tierInventoryStatus,
            },
            tiers: snapshot.tiers.map((t) => ({
              id: t.id,
              quantityHeld: t.quantityHeld,
              quantitySold: t.quantitySold,
            })),
            assignments: result.changes.map((c) => ({
              ticketId: c.ticketId,
              tierId: c.beforeTierId,
            })),
          },
          after: {
            type: result.type,
            tiers: result.tiers,
            assignments: result.changes,
            stockReleases: result.stockReleases,
            counterEvidence: plan.counterEvidence,
          },
        },
        select: { id: true },
      });
      return {
        ticketTypeId: plan.ticketTypeId,
        auditId: audit.id,
        planFingerprint,
        changedTickets: result.changes.length,
        type: result.type,
        tiers: result.tiers,
        applied: true,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 60000,
      maxWait: 10000,
    }
  );
}

function paidLike(status) {
  return status === 'PAID' || status === 'PARTIALLY_REFUNDED';
}

function seatKept(ticket) {
  return ticket.status === 'VALID' || ticket.status === 'USED';
}

function windowMatch(ticket, tier) {
  const created = new Date(ticket.createdAt).getTime();
  if (created < new Date(tier.createdAt).getTime()) return false;
  if (tier.startsAt && created < new Date(tier.startsAt).getTime()) return false;
  if (tier.endsAt && created >= new Date(tier.endsAt).getTime()) return false;
  return true;
}

function bySchedule(left, right) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  const created = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  if (created !== 0) return created;
  return left.id.localeCompare(right.id);
}

function promoPriced(order) {
  return Boolean(
    order && (order.promoCodeId || new Prisma.Decimal(order.discountAmount || 0).greaterThan(0))
  );
}

function chooseTier(ticket, tiers, order) {
  if (ticket.tierId && tiers.some((tier) => tier.id === ticket.tierId)) return ticket.tierId;
  if (!tiers.length) return null;
  const priced = tiers.filter(
    (tier) => windowMatch(ticket, tier) && new Prisma.Decimal(ticket.pricePaid).equals(tier.price)
  );
  if (priced.length) return [...priced].sort(bySchedule)[0].id;
  const samePrice = tiers.filter((tier) => new Prisma.Decimal(ticket.pricePaid).equals(tier.price));
  if (samePrice.length) return [...samePrice].sort(bySchedule)[0].id;
  if (promoPriced(order)) {
    const windows = tiers.filter((tier) => windowMatch(ticket, tier));
    if (windows.length) return [...windows].sort(bySchedule)[0].id;
    if (tiers.length === 1) return tiers[0].id;
  }
  return undefined;
}

function listTicket(ticket, order, reason) {
  return {
    ticketId: ticket.id,
    fromState: ticket.inventoryState,
    orderStatus: order ? order.status : 'MISSING',
    ticketStatus: ticket.status,
    reason,
  };
}

function resolveUnknownDecision(snapshot, context) {
  const orders = new Map(snapshot.orders.map((order) => [order.id, order]));
  const tiers = snapshot.tiers.map((tier) => ({
    ...tier,
    sortOrder: context.sortOrder.get(tier.id) || 0,
  }));
  const unresolved = [];
  const ticketChanges = [];
  const finalState = new Map();
  for (const ticket of snapshot.tickets) {
    const order = orders.get(ticket.orderId);
    const keep = () =>
      finalState.set(ticket.id, { state: ticket.inventoryState, tierId: ticket.tierId });
    if (
      !order ||
      order.eventId !== snapshot.type.eventId ||
      ticket.eventId !== snapshot.type.eventId
    ) {
      unresolved.push(listTicket(ticket, order, 'inconsistent-ticket'));
      keep();
      continue;
    }
    if (ticket.inventoryState !== 'UNKNOWN') {
      if (ticket.inventoryState === 'HELD' && order.status !== 'PENDING') {
        unresolved.push(listTicket(ticket, order, 'held-on-non-pending-order'));
        keep();
        continue;
      }
      if (
        allocated(ticket.inventoryState) &&
        !paidLike(order.status) &&
        ticket.inventoryState === 'SOLD'
      ) {
        unresolved.push(listTicket(ticket, order, 'sold-on-unpaid-order'));
        keep();
        continue;
      }
      if (
        ticket.inventoryState === 'SOLD' &&
        (order.paymentStatus !== 'SUCCEEDED' ||
          ['REQUESTED', 'PENDING', 'UNCERTAIN'].includes(order.refundStatus))
      ) {
        unresolved.push(listTicket(ticket, order, 'financial-state'));
        keep();
        continue;
      }
      if (
        allocated(ticket.inventoryState) &&
        (!ticket.tierId || !tiers.some((tier) => tier.id === ticket.tierId))
      ) {
        unresolved.push(listTicket(ticket, order, 'unattributed'));
        keep();
        continue;
      }
      keep();
      continue;
    }
    let next = null;
    let reason = null;
    if (paidLike(order.status) && order.paymentStatus === 'SUCCEEDED' && seatKept(ticket)) {
      next = 'SOLD';
      reason = 'paid-valid-or-used';
    } else if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
      next = 'RELEASED';
      reason = 'refunded-or-cancelled-order';
    } else {
      unresolved.push(
        listTicket(
          ticket,
          order,
          paidLike(order.status)
            ? 'paid-ticket-not-valid'
            : order.status === 'PENDING'
              ? 'pending-order'
              : 'unclassified-unknown'
        )
      );
      keep();
      continue;
    }
    let tierId = ticket.tierId;
    if (next === 'SOLD') {
      const chosen = chooseTier(ticket, tiers, context.promo.get(ticket.orderId) || order);
      if (chosen === undefined) {
        unresolved.push(listTicket(ticket, order, 'tier-unattributed'));
        keep();
        continue;
      }
      tierId = chosen;
    }
    finalState.set(ticket.id, { state: next, tierId });
    if (next !== ticket.inventoryState || tierId !== ticket.tierId) {
      ticketChanges.push({
        ticketId: ticket.id,
        fromState: ticket.inventoryState,
        toState: next,
        fromTierId: ticket.tierId,
        toTierId: tierId,
        reason,
      });
    }
  }
  const counted = new Map(
    snapshot.tiers.map((tier) => [tier.id, { id: tier.id, quantitySold: 0, quantityHeld: 0 }])
  );
  let held = 0,
    sold = 0;
  for (const ticket of snapshot.tickets) {
    const final = finalState.get(ticket.id);
    if (final.state === 'HELD') held++;
    if (final.state === 'SOLD') sold++;
    if (
      (final.state === 'HELD' || final.state === 'SOLD') &&
      final.tierId &&
      counted.has(final.tierId)
    ) {
      counted.get(final.tierId)[final.state === 'HELD' ? 'quantityHeld' : 'quantitySold']++;
    }
  }
  const overCapacity =
    held + sold > snapshot.type.quantityTotal ||
    snapshot.tiers.some((tier) => {
      const count = counted.get(tier.id);
      return (
        tier.quantityLimit !== null && count.quantityHeld + count.quantitySold > tier.quantityLimit
      );
    });
  if (overCapacity) {
    return {
      action: 'leave-flagged',
      reason: 'over-capacity',
      changes: null,
      unresolved: snapshot.tickets
        .filter((ticket) => ticket.inventoryState !== 'RELEASED')
        .map((ticket) => listTicket(ticket, orders.get(ticket.orderId), 'over-capacity')),
    };
  }
  const ready = unresolved.length === 0;
  const typeAfter = {
    quantityTotal: snapshot.type.quantityTotal,
    quantityHeld: held,
    quantitySold: sold,
    quantityAvailable: snapshot.type.quantityTotal - held - sold,
    tierInventoryStatus: ready ? 'READY' : 'REQUIRES_RECONCILIATION',
  };
  const countersDiffer =
    snapshot.type.quantityHeld !== held ||
    snapshot.type.quantitySold !== sold ||
    snapshot.type.quantityAvailable !== typeAfter.quantityAvailable ||
    snapshot.type.tierInventoryStatus !== typeAfter.tierInventoryStatus ||
    snapshot.tiers.some((tier) => {
      const count = counted.get(tier.id);
      return tier.quantityHeld !== count.quantityHeld || tier.quantitySold !== count.quantitySold;
    });
  if (!ticketChanges.length && (!countersDiffer || !ready)) {
    return {
      action: unresolved.length ? 'list' : 'unchanged',
      reason: unresolved.length ? unresolved[0].reason : 'already-consistent',
      changes: null,
      unresolved,
    };
  }
  return {
    action: 'reconcile',
    reason: ready ? (ticketChanges.length ? 'resolve-unknown' : 'counters') : unresolved[0].reason,
    changes: { type: typeAfter, tiers: [...counted.values()], tickets: ticketChanges },
    unresolved,
  };
}

async function resolveContext(db, snapshot) {
  const orderIds = snapshot.orders.map((order) => order.id);
  const [tiers, orders] = await Promise.all([
    db.ticketTier.findMany({
      where: { ticketTypeId: snapshot.type.id },
      select: { id: true, sortOrder: true },
    }),
    orderIds.length
      ? db.order.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, promoCodeId: true, discountAmount: true },
        })
      : [],
  ]);
  return {
    sortOrder: new Map(tiers.map((tier) => [tier.id, tier.sortOrder])),
    promo: new Map(orders.map((order) => [order.id, order])),
  };
}

function systemDecision(snapshot, context = null) {
  if (context) return resolveUnknownDecision(snapshot, context);
  // UNKNOWN stays UNKNOWN. This path never assigns a tier or clears that state.
  if (snapshot.tickets.some((ticket) => ticket.inventoryState === 'UNKNOWN')) {
    return { action: 'leave-flagged', reason: 'unknown-inventory', changes: null };
  }
  const counters = new Map(
    snapshot.tiers.map((tier) => [tier.id, { id: tier.id, quantitySold: 0, quantityHeld: 0 }])
  );
  const orders = new Map(snapshot.orders.map((order) => [order.id, order]));
  let held = 0,
    sold = 0;
  for (const ticket of snapshot.tickets) {
    if (ticket.eventId !== snapshot.type.eventId) {
      return { action: 'leave-flagged', reason: 'inconsistent-ticket', changes: null };
    }
    if (!allocated(ticket.inventoryState)) continue;
    const order = orders.get(ticket.orderId);
    if (
      !order ||
      order.eventId !== snapshot.type.eventId ||
      (ticket.inventoryState === 'HELD' && order.status !== 'PENDING') ||
      (ticket.inventoryState === 'SOLD' &&
        (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.status) ||
          order.paymentStatus !== 'SUCCEEDED' ||
          ['REQUESTED', 'PENDING', 'UNCERTAIN'].includes(order.refundStatus)))
    ) {
      return { action: 'leave-flagged', reason: 'financial-state', changes: null };
    }
    if (!ticket.tierId || !counters.has(ticket.tierId)) {
      return { action: 'leave-flagged', reason: 'unattributed', changes: null };
    }
    if (ticket.inventoryState === 'HELD') held++;
    else sold++;
    counters.get(ticket.tierId)[
      ticket.inventoryState === 'HELD' ? 'quantityHeld' : 'quantitySold'
    ]++;
  }
  if (held + sold > snapshot.type.quantityTotal) {
    return { action: 'leave-flagged', reason: 'over-capacity', changes: null };
  }
  for (const tier of snapshot.tiers) {
    const counted = counters.get(tier.id);
    if (
      tier.quantityLimit !== null &&
      counted.quantityHeld + counted.quantitySold > tier.quantityLimit
    ) {
      return { action: 'leave-flagged', reason: 'over-capacity', changes: null };
    }
  }
  const typeAfter = {
    quantityTotal: snapshot.type.quantityTotal,
    quantityHeld: held,
    quantitySold: sold,
    quantityAvailable: snapshot.type.quantityTotal - held - sold,
    tierInventoryStatus: 'READY',
  };
  const tiers = [...counters.values()];
  const countersDiffer =
    snapshot.type.quantityHeld !== held ||
    snapshot.type.quantitySold !== sold ||
    snapshot.type.quantityAvailable !== typeAfter.quantityAvailable ||
    snapshot.type.tierInventoryStatus !== 'READY' ||
    snapshot.tiers.some((tier) => {
      const counted = counters.get(tier.id);
      return (
        tier.quantityHeld !== counted.quantityHeld || tier.quantitySold !== counted.quantitySold
      );
    });
  if (!countersDiffer) return { action: 'unchanged', reason: 'already-consistent', changes: null };
  return { action: 'reconcile', reason: 'counters', changes: { type: typeAfter, tiers } };
}

function systemSummary(event, snapshot, decision) {
  return {
    ticketTypeId: snapshot.type.id,
    eventId: event.id,
    eventName: event.name,
    eventStatus: event.status,
    tierInventoryStatus: snapshot.type.tierInventoryStatus,
    quantitySold: snapshot.type.quantitySold,
    quantityTotal: snapshot.type.quantityTotal,
    action: decision.action,
    reason: decision.reason,
    changes: decision.changes,
    unresolved: decision.unresolved || [],
  };
}

async function flaggedTicketTypes(db, resolveUnknown) {
  return db.ticketType.findMany({
    where: resolveUnknown
      ? {
          OR: [
            { tierInventoryStatus: 'REQUIRES_RECONCILIATION' },
            { tickets: { some: { inventoryState: 'UNKNOWN' } } },
          ],
        }
      : { tierInventoryStatus: 'REQUIRES_RECONCILIATION' },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          startDatetime: true,
          endDatetime: true,
        },
      },
    },
  });
}

async function systemDryRun(prisma, { upcomingOnly, resolveUnknown = false, now = new Date() }) {
  return prisma.$transaction(
    async (db) => {
      await db.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const selected = (await flaggedTicketTypes(db, resolveUnknown)).filter(
        (row) => !upcomingOnly || isUpcoming(row.event, now)
      );
      const types = [];
      for (const row of selected) {
        const snapshot = await readSnapshot(db, row.id);
        const context = resolveUnknown ? await resolveContext(db, snapshot) : null;
        types.push(systemSummary(row.event, snapshot, systemDecision(snapshot, context)));
      }
      return {
        mode: 'dry-run',
        actorId: SYSTEM_ACTOR,
        upcomingOnly,
        resolveUnknown,
        writes: false,
        changed: types.filter((row) => row.action === 'reconcile').length,
        types,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 }
  );
}

async function applySystemType(prisma, id, env, resolveUnknown) {
  if (
    env.TIXMO_ALLOW_INVENTORY_RECONCILIATION !== 'true' ||
    env.TIXMO_INVENTORY_WRITERS_QUIESCED !== 'true'
  ) {
    reject(
      'Apply requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true.'
    );
  }
  return prisma.$transaction(
    async (db) => {
      const initial = await readSnapshot(db, id);
      await db.$queryRaw`SELECT id FROM events WHERE id = ${initial.type.eventId} FOR UPDATE`;
      const orderIds = [...new Set(initial.tickets.map((ticket) => ticket.orderId))].sort();
      if (orderIds.length) {
        await db.$queryRaw(
          Prisma.sql`SELECT id FROM orders WHERE id IN (${Prisma.join(orderIds)}) ORDER BY id FOR UPDATE`
        );
      }
      await db.$queryRaw`SELECT id FROM ticket_types WHERE id = ${id} FOR UPDATE`;
      const snapshot = await readSnapshot(db, id);
      const context = resolveUnknown ? await resolveContext(db, snapshot) : null;
      const decision = systemDecision(snapshot, context);
      if (decision.action !== 'reconcile')
        return { decision, auditId: null, wrote: false, snapshot };
      for (const change of decision.changes.tickets || []) {
        if (
          change.fromState === 'SOLD' &&
          change.toState === 'RELEASED' &&
          change.reason !== 'refunded-or-cancelled-order'
        ) {
          reject('Refusing to release a sold seat on a paid, valid ticket.');
        }
        const written = await db.ticket.updateMany({
          where: {
            id: change.ticketId,
            ticketTypeId: id,
            inventoryState: change.fromState,
            tierId: change.fromTierId,
          },
          data: { inventoryState: change.toState, tierId: change.toTierId },
        });
        if (written.count !== 1)
          reject('Inventory changed while the system reconcile was applying.');
      }
      for (const tier of decision.changes.tiers) {
        await db.ticketTier.update({
          where: { id: tier.id },
          data: { quantitySold: tier.quantitySold, quantityHeld: tier.quantityHeld },
        });
      }
      await db.ticketType.update({
        where: { id },
        data: {
          quantityHeld: decision.changes.type.quantityHeld,
          quantitySold: decision.changes.type.quantitySold,
          quantityAvailable: decision.changes.type.quantityAvailable,
          tierInventoryStatus: 'READY',
        },
      });
      const audit = await db.ticketInventoryReconciliation.create({
        data: {
          ticketTypeId: id,
          actorId: SYSTEM_ACTOR,
          evidence:
            resolveUnknown && (decision.changes.tickets || []).length
              ? RESOLVE_EVIDENCE
              : SYSTEM_EVIDENCE,
          snapshotFingerprint: snapshotFingerprint(snapshot),
          planFingerprint: digest({
            actorId: SYSTEM_ACTOR,
            ticketTypeId: id,
            changes: decision.changes,
          }),
          before: {
            type: {
              quantityTotal: snapshot.type.quantityTotal,
              quantityHeld: snapshot.type.quantityHeld,
              quantitySold: snapshot.type.quantitySold,
              quantityAvailable: snapshot.type.quantityAvailable,
              tierInventoryStatus: snapshot.type.tierInventoryStatus,
            },
            tiers: snapshot.tiers.map((tier) => ({
              id: tier.id,
              quantityHeld: tier.quantityHeld,
              quantitySold: tier.quantitySold,
            })),
          },
          after: {
            type: decision.changes.type,
            tiers: decision.changes.tiers,
            tickets: decision.changes.tickets || [],
            unresolved: decision.unresolved || [],
            unknownResolved: Boolean(resolveUnknown && (decision.changes.tickets || []).length),
          },
        },
        select: { id: true },
      });
      return { decision, auditId: audit.id, wrote: true, snapshot };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 60000,
      maxWait: 10000,
    }
  );
}

async function systemApply(
  prisma,
  { upcomingOnly, resolveUnknown = false, now = new Date(), env = process.env }
) {
  const selected = (await flaggedTicketTypes(prisma, resolveUnknown)).filter(
    (row) => !upcomingOnly || isUpcoming(row.event, now)
  );
  const types = [];
  let changed = 0;
  for (const row of selected) {
    const result = await applySystemType(prisma, row.id, env, resolveUnknown);
    if (result.wrote) changed++;
    types.push(systemSummary(row.event, result.snapshot, result.decision));
  }
  return {
    mode: 'apply',
    actorId: SYSTEM_ACTOR,
    upcomingOnly,
    resolveUnknown,
    writes: changed > 0,
    changed,
    types,
  };
}

function readPlan(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_PLAN_BYTES)
    reject('Plan must be a JSON file of at most 8 MiB.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function systemOptions(args) {
  const allowed = ['--dry-run', '--apply', '--upcoming-only', '--resolve-unknown'];
  if (args.some((arg) => !allowed.includes(arg))) {
    reject('Unknown inventory reconciliation command.');
  }
  if (allowed.some((flag) => args.filter((arg) => arg === flag).length > 1)) {
    reject('Invalid or duplicate reconciliation option.');
  }
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  if (dryRun === apply) reject('Choose either --dry-run or --apply.');
  return {
    dryRun,
    upcomingOnly: args.includes('--upcoming-only'),
    resolveUnknown: args.includes('--resolve-unknown'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || ['--help', '-h'].includes(args[0])) {
    console.log(
      'Usage: npm run inventory:reconcile -- inspect --id TYPE --output PRIVATE_JSON | preview --file PRIVATE_JSON | apply --file PRIVATE_JSON --confirm-plan SHA256 | --dry-run [--upcoming-only] [--resolve-unknown] | --apply [--upcoming-only] [--resolve-unknown]'
    );
    console.log(
      'Requires explicit TIXMO_INVENTORY_DATABASE_URL matching DATABASE_URL if present. Apply also requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true. --dry-run and --apply use the system actor system-inventory-reconcile and do not need an enabled OWNER/ADMIN. --upcoming-only limits the run to events whose end, or start when there is no end, is still in the future. Ended flagged types are left unchanged and are not an error. --resolve-unknown maps a PAID or PARTIALLY_REFUNDED VALID or USED ticket to SOLD and a REFUNDED or CANCELLED order to RELEASED. Ambiguous tickets are listed and not written. This tool does not change financial state, pricing, currency, or capacity, and it never releases a paid valid seat.'
    );
    return;
  }
  if (args[0].startsWith('--')) {
    const options = systemOptions(args);
    require('dotenv').config();
    const target = explicitTarget(process.env),
      prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
    try {
      const result = options.dryRun
        ? await systemDryRun(prisma, options)
        : await systemApply(prisma, options);
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await prisma.$disconnect();
    }
    return;
  }
  const command = args.shift();
  if (!['inspect', 'preview', 'apply'].includes(command))
    reject('Unknown inventory reconciliation command.');
  const allowed =
    command === 'inspect'
      ? ['--id', '--output']
      : command === 'preview'
        ? ['--file']
        : ['--file', '--confirm-plan'];
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.includes(args[i]) || !args[i + 1] || options[args[i]])
      reject('Invalid or duplicate reconciliation option.');
    options[args[i]] = args[i + 1];
  }
  if (allowed.some((key) => !options[key]))
    reject('Supply all required command options; see --help.');
  require('dotenv').config();
  const target = explicitTarget(process.env),
    prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
  try {
    if (command === 'inspect') {
      const result = await inspectInventory(prisma, options['--id'], target.fingerprint);
      const text = JSON.stringify(result, null, 2) + '\n';
      if (Buffer.byteLength(text) > MAX_PLAN_BYTES)
        reject('Inspection exceeds the 8 MiB plan limit.');
      fs.writeFileSync(options['--output'], text, { mode: 0o600, flag: 'wx' });
      console.log(
        JSON.stringify({
          ticketTypeId: result.ticketTypeId,
          tickets: result.review.tickets.length,
          snapshotFingerprint: result.snapshotFingerprint,
          privatePlanCreated: true,
          writes: false,
        })
      );
    } else {
      const plan = readPlan(options['--file']);
      const result =
        command === 'preview'
          ? await previewInventory(prisma, plan, target.fingerprint)
          : await applyInventory(prisma, plan, options['--confirm-plan'], target.fingerprint);
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(
      error instanceof OperatorError
        ? error.message
        : 'Inventory reconciliation failed; verify the private plan, explicit target and current database state.'
    );
    process.exitCode = 1;
  });

module.exports = {
  explicitTarget,
  inspectInventory,
  previewInventory,
  applyInventory,
  systemDryRun,
  systemApply,
  SYSTEM_ACTOR,
  OperatorError,
};
