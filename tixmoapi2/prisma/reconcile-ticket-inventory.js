'use strict';

const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { PrismaClient, Prisma } = require('@prisma/client');

const MAX_TICKETS = 25000;
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

function readPlan(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_PLAN_BYTES)
    reject('Plan must be a JSON file of at most 8 MiB.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2),
    command = args.shift();
  if (!command || ['--help', '-h'].includes(command)) {
    console.log(
      'Usage: npm run inventory:reconcile -- inspect --id TYPE --output PRIVATE_JSON | preview --file PRIVATE_JSON | apply --file PRIVATE_JSON --confirm-plan SHA256'
    );
    console.log(
      'Requires explicit TIXMO_INVENTORY_DATABASE_URL matching DATABASE_URL if present. Apply also requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true. Review allocations and provider evidence, stop old writers, and retain the backup before applying. This tool does not change financial state, pricing, currency or capacity.'
    );
    return;
  }
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
  OperatorError,
};
