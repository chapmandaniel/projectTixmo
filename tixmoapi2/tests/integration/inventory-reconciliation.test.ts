import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupTestData, prisma } from '../utils/testUtils';

const {
  explicitTarget,
  inspectInventory,
  previewInventory,
  applyInventory,
} = require('../../prisma/reconcile-ticket-inventory.js');
const authorized = {
  TIXMO_ALLOW_INVENTORY_RECONCILIATION: 'true',
  TIXMO_INVENTORY_WRITERS_QUIESCED: 'true',
};
const script = path.resolve(__dirname, '../../prisma/reconcile-ticket-inventory.js');

async function fixture() {
  const organization = await prisma.organization.create({
    data: {
      name: 'Inventory operator test',
      slug: randomUUID(),
      type: 'PROMOTER',
      status: 'ACTIVE',
    },
  });
  const actor = await prisma.user.create({
    data: {
      email: 'inventory-owner-' + randomUUID() + '@test.com',
      passwordHash: 'unused',
      firstName: 'Test',
      lastName: 'Operator',
      role: 'OWNER',
      organizationId: organization.id,
    },
  });
  const buyer = await prisma.user.create({
    data: {
      email: 'inventory-buyer-' + randomUUID() + '@test.com',
      passwordHash: 'unused',
      firstName: 'Private',
      lastName: 'Customer',
      role: 'CUSTOMER',
    },
  });
  const event = await prisma.event.create({
    data: {
      name: 'Inventory test',
      slug: randomUUID(),
      organizationId: organization.id,
      status: 'PUBLISHED',
      startDatetime: new Date(Date.now() + 86400000),
    },
  });
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'Historical inventory',
      price: 20,
      quantityTotal: 10,
      quantityAvailable: 5,
      quantitySold: 5,
      tierInventoryStatus: 'REQUIRES_RECONCILIATION',
    },
  });
  const tier = await prisma.ticketTier.create({
    data: {
      ticketTypeId: type.id,
      name: 'Reviewed allocation',
      price: 20,
      quantityLimit: 4,
      quantitySold: 4,
      createdAt: new Date('2019-01-01T00:00:00Z'),
    },
  });
  const paid = await prisma.order.create({
    data: {
      orderNumber: randomUUID(),
      userId: buyer.id,
      eventId: event.id,
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      totalAmount: 20,
      currency: 'usd',
      paymentIntentId: 'pi_owned_' + randomUUID(),
    },
  });
  const pending = await prisma.order.create({
    data: {
      orderNumber: randomUUID(),
      userId: buyer.id,
      eventId: event.id,
      status: 'PENDING',
      totalAmount: 15,
      currency: 'cad',
    },
  });
  const sold = await prisma.ticket.create({
    data: {
      userId: buyer.id,
      orderId: paid.id,
      eventId: event.id,
      ticketTypeId: type.id,
      barcode: 'PRIVATE-' + randomUUID(),
      pricePaid: 20,
      inventoryState: 'SOLD',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    },
  });
  const held = await prisma.ticket.create({
    data: {
      userId: buyer.id,
      orderId: pending.id,
      eventId: event.id,
      ticketTypeId: type.id,
      barcode: 'PRIVATE-' + randomUUID(),
      pricePaid: 15,
      inventoryState: 'HELD',
      createdAt: new Date('2025-01-02T00:00:00Z'),
    },
  });
  return { actor, buyer, event, type, tier, paid, pending, sold, held };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
const target = () =>
  explicitTarget({
    TIXMO_INVENTORY_DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  });
async function reviewed(f: Fixture) {
  const plan = await inspectInventory(prisma, f.type.id, target().fingerprint);
  plan.actorId = f.actor.id;
  plan.evidence = 'Owned historical sales ledger confirms the complete ticket population.';
  plan.counterEvidence = 'Owned ledger confirms legacy counters include duplicated allocations.';
  plan.assignments = [
    { ticketId: f.sold.id, tierId: f.tier.id },
    {
      ticketId: f.held.id,
      tierId: f.tier.id,
      evidence: 'Owned pricing archive confirms the historical discounted allocation.',
    },
  ];
  return plan;
}

beforeEach(cleanupTestData);
afterAll(cleanupTestData);

it('executes the reviewed preview/apply CLI without logging database credentials', async () => {
  const f = await fixture(),
    plan = await reviewed(f);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-inventory-cli-'));
  const file = path.join(directory, 'reviewed.json');
  fs.writeFileSync(file, JSON.stringify(plan), { mode: 0o600 });
  const env = {
    ...process.env,
    ...authorized,
    TIXMO_INVENTORY_DATABASE_URL: process.env.DATABASE_URL,
  };
  try {
    const preview = spawnSync(process.execPath, [script, 'preview', '--file', file], {
      env,
      encoding: 'utf8',
    });
    expect(preview.status).toBe(0);
    const fingerprint = JSON.parse(preview.stdout).planFingerprint;
    const applied = spawnSync(
      process.execPath,
      [script, 'apply', '--file', file, '--confirm-plan', fingerprint],
      { env, encoding: 'utf8' }
    );
    expect(applied.status).toBe(0);
    expect(JSON.parse(applied.stdout).applied).toBe(true);
    expect(applied.stdout + applied.stderr).not.toContain(process.env.DATABASE_URL);
    expect(applied.stdout + applied.stderr).not.toContain(f.buyer.email);
    expect(applied.stdout + applied.stderr).not.toContain(f.sold.barcode);
    expect(await prisma.ticketInventoryReconciliation.count()).toBe(1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('requires an explicit matching target, creates a private inspection and never exports customer credentials', async () => {
  const f = await fixture(),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-inventory-test-'));
  const output = path.join(directory, 'plan.json');
  const args = [script, 'inspect', '--id', f.type.id, '--output', output];
  try {
    const missing = spawnSync(process.execPath, args, {
      env: { ...process.env, TIXMO_INVENTORY_DATABASE_URL: '' },
      encoding: 'utf8',
    });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('explicit TIXMO_INVENTORY_DATABASE_URL');
    const mismatch = spawnSync(process.execPath, args, {
      env: { ...process.env, TIXMO_INVENTORY_DATABASE_URL: 'postgresql://invalid.test/other' },
      encoding: 'utf8',
    });
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain('match the inherited DATABASE_URL');
    const inspected = spawnSync(process.execPath, args, {
      env: { ...process.env, TIXMO_INVENTORY_DATABASE_URL: process.env.DATABASE_URL },
      encoding: 'utf8',
    });
    expect(inspected.status).toBe(0);
    expect(fs.statSync(output).mode & 0o077).toBe(0);
    const file = fs.readFileSync(output, 'utf8');
    expect(file).not.toContain(f.buyer.email);
    expect(file).not.toContain(f.sold.barcode);
    expect(file).not.toContain(f.paid.paymentIntentId);
    expect(file).not.toContain(process.env.DATABASE_URL);
    expect(inspected.stdout).not.toContain(f.sold.barcode);
    expect(JSON.parse(file).assignments).toEqual([]);
    expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).tierInventoryStatus
    ).toBe('REQUIRES_RECONCILIATION');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('previews without writing and atomically records corrected stock while preserving money and credentials', async () => {
  const f = await fixture(),
    plan = await reviewed(f);
  const orders = await prisma.order.findMany({ orderBy: { id: 'asc' } });
  const preview = await previewInventory(prisma, plan, target().fingerprint);
  expect(preview.writes).toBe(false);
  expect(preview.stockReleases).toHaveLength(3);
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id: f.sold.id } })).tierId).toBeNull();
  const result = await applyInventory(
    prisma,
    plan,
    preview.planFingerprint,
    target().fingerprint,
    authorized
  );
  expect(result.changedTickets).toBe(2);
  expect(await prisma.order.findMany({ orderBy: { id: 'asc' } })).toEqual(orders);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).toMatchObject({
    quantityHeld: 1,
    quantitySold: 1,
    quantityAvailable: 8,
    quantityTotal: 10,
    tierInventoryStatus: 'READY',
  });
  expect(await prisma.ticketTier.findUniqueOrThrow({ where: { id: f.tier.id } })).toMatchObject({
    quantityHeld: 1,
    quantitySold: 1,
    quantityLimit: 4,
    price: f.tier.price,
  });
  expect(await prisma.ticket.findUniqueOrThrow({ where: { id: f.sold.id } })).toMatchObject({
    barcode: f.sold.barcode,
    userId: f.buyer.id,
    inventoryState: 'SOLD',
    tierId: f.tier.id,
    pricePaid: f.sold.pricePaid,
  });
  const audit = await prisma.ticketInventoryReconciliation.findUniqueOrThrow({
    where: { id: result.auditId },
  });
  expect(audit.actorId).toBe(f.actor.id);
  expect(audit.planFingerprint).toBe(preview.planFingerprint);
  expect(audit.before).toMatchObject({ type: { quantitySold: 5 } });
  expect(audit.after).toMatchObject({
    type: { quantitySold: 1 },
    counterEvidence: plan.counterEvidence,
  });
});

it('requires mutation authorization and a quiesced-writers acknowledgement', async () => {
  const f = await fixture(),
    plan = await reviewed(f),
    preview = await previewInventory(prisma, plan, target().fingerprint);
  await expect(
    applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, {})
  ).rejects.toThrow('Apply requires');
  await expect(
    applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, {
      TIXMO_ALLOW_INVENTORY_RECONCILIATION: 'true',
    })
  ).rejects.toThrow('WRITERS_QUIESCED');
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
});

it('refuses a changed inventory snapshot or database target', async () => {
  const f = await fixture(),
    plan = await reviewed(f),
    preview = await previewInventory(prisma, plan, target().fingerprint);
  await expect(
    applyInventory(prisma, plan, preview.planFingerprint, '0'.repeat(64), authorized)
  ).rejects.toThrow('different database target');
  await prisma.ticketTier.update({ where: { id: f.tier.id }, data: { quantitySold: 3 } });
  await expect(
    applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, authorized)
  ).rejects.toThrow('changed since inspection');
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
  expect((await prisma.ticket.findUniqueOrThrow({ where: { id: f.sold.id } })).tierId).toBeNull();
});

it('rejects a reviewed plan edited after its fingerprint was confirmed', async () => {
  const f = await fixture(),
    plan = await reviewed(f),
    preview = await previewInventory(prisma, plan, target().fingerprint);
  plan.evidence = 'A different operator decision was inserted after the review.';
  await expect(
    applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, authorized)
  ).rejects.toThrow('exact reviewed');
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
});

it('requires evidence for historical overrides and for reductions in old counters', async () => {
  const f = await fixture(),
    plan = await reviewed(f);
  plan.assignments[1].evidence = '';
  await expect(previewInventory(prisma, plan, target().fingerprint)).rejects.toThrow(
    'price/window overrides'
  );
  plan.assignments[1].evidence = 'Owned pricing records confirm the historical allocation.';
  plan.counterEvidence = '';
  await expect(previewInventory(prisma, plan, target().fingerprint)).rejects.toThrow(
    'Releasing stock'
  );
});

it('requires stock-release evidence when availability increases without reducing held or sold counters', async () => {
  const f = await fixture();
  await prisma.ticketType.update({
    where: { id: f.type.id },
    data: { quantityHeld: 1, quantitySold: 1, quantityAvailable: 5 },
  });
  await prisma.ticketTier.update({
    where: { id: f.tier.id },
    data: { quantityHeld: 1, quantitySold: 1 },
  });
  const plan = await reviewed(f);
  plan.counterEvidence = '';
  await expect(previewInventory(prisma, plan, target().fingerprint)).rejects.toThrow(
    'Releasing stock'
  );
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
  expect(
    (await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).quantityAvailable
  ).toBe(5);
  plan.counterEvidence = 'Owned stock ledger confirms all allocations and the available balance.';
  const preview = await previewInventory(prisma, plan, target().fingerprint);
  expect(preview.stockReleases).toEqual([
    { scope: 'type', id: f.type.id, field: 'quantityAvailable', before: 5, after: 8 },
  ]);
});

it('rejects duplicate, foreign-tier and unallocated-ticket assignments', async () => {
  const f = await fixture(),
    plan = await reviewed(f);
  plan.assignments.push(plan.assignments[0]);
  await expect(previewInventory(prisma, plan, target().fingerprint)).rejects.toThrow(
    'unique valid'
  );
  const other = await prisma.ticketType.create({
    data: {
      eventId: f.event.id,
      name: 'Other',
      price: 20,
      quantityTotal: 10,
      quantityAvailable: 10,
    },
  });
  const tier = await prisma.ticketTier.create({
    data: { ticketTypeId: other.id, name: 'Other', price: 20 },
  });
  const foreign = await reviewed(f);
  foreign.assignments[0].tierId = tier.id;
  await expect(previewInventory(prisma, foreign, target().fingerprint)).rejects.toThrow(
    'belonging to this ticket type'
  );
  await prisma.ticket.update({
    where: { id: f.held.id },
    data: { inventoryState: 'RELEASED', status: 'CANCELLED' },
  });
  const released = await reviewed(f);
  await expect(previewInventory(prisma, released, target().fingerprint)).rejects.toThrow(
    'allocated ticket'
  );
});

it('keeps unresolved financial inventory and failed paid-order state quarantined', async () => {
  const f = await fixture();
  await prisma.ticket.update({ where: { id: f.sold.id }, data: { inventoryState: 'UNKNOWN' } });
  await expect(previewInventory(prisma, await reviewed(f), target().fingerprint)).rejects.toThrow(
    'financial/provider reconciliation'
  );
  await prisma.ticket.update({ where: { id: f.sold.id }, data: { inventoryState: 'SOLD' } });
  await prisma.order.update({ where: { id: f.paid.id }, data: { paymentStatus: 'FAILED' } });
  await expect(previewInventory(prisma, await reviewed(f), target().fingerprint)).rejects.toThrow(
    'financial state first'
  );
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
});

it.each(['type', 'tier'])('refuses allocations above %s capacity', async (scope) => {
  const f = await fixture();
  if (scope === 'type')
    await prisma.ticketType.update({ where: { id: f.type.id }, data: { quantityTotal: 1 } });
  else await prisma.ticketTier.update({ where: { id: f.tier.id }, data: { quantityLimit: 1 } });
  await expect(previewInventory(prisma, await reviewed(f), target().fingerprint)).rejects.toThrow(
    scope === 'type' ? 'ticket-type capacity' : 'tier limit'
  );
  expect(
    (await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).tierInventoryStatus
  ).toBe('REQUIRES_RECONCILIATION');
});

it.each(['CUSTOMER', 'disabled', 'inactive business'])(
  'rejects an operator with %s authority',
  async (state) => {
    const f = await fixture(),
      plan = await reviewed(f);
    if (state === 'CUSTOMER') plan.actorId = f.buyer.id;
    else if (state === 'disabled')
      await prisma.user.update({ where: { id: f.actor.id }, data: { disabledAt: new Date() } });
    else
      await prisma.organization.update({
        where: { id: f.actor.organizationId! },
        data: { status: 'SUSPENDED' },
      });
    await expect(previewInventory(prisma, plan, target().fingerprint)).rejects.toThrow(
      'enabled OWNER/ADMIN'
    );
    expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
  }
);

it('rolls back allocations, counters and the READY flag when durable audit storage rejects the write', async () => {
  const f = await fixture(),
    plan = await reviewed(f),
    preview = await previewInventory(prisma, plan, target().fingerprint);
  await prisma.$executeRawUnsafe(
    "CREATE FUNCTION tixmo_test_reject_inventory_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned audit failure'; END; $$"
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER tixmo_test_inventory_audit_failure BEFORE INSERT ON ticket_inventory_reconciliations FOR EACH ROW EXECUTE FUNCTION tixmo_test_reject_inventory_audit()'
  );
  try {
    await expect(
      applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, authorized)
    ).rejects.toThrow();
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: f.sold.id } })).tierId).toBeNull();
    expect(
      (await prisma.ticketTier.findUniqueOrThrow({ where: { id: f.tier.id } })).quantitySold
    ).toBe(4);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).tierInventoryStatus
    ).toBe('REQUIRES_RECONCILIATION');
    expect(await prisma.ticketInventoryReconciliation.count()).toBe(0);
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER tixmo_test_inventory_audit_failure ON ticket_inventory_reconciliations'
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION tixmo_test_reject_inventory_audit()');
  }
});

it('reconciles a thousand historical allocations while preserving their paid invoice and capacity', async () => {
  const f = await fixture();
  await prisma.ticketType.update({
    where: { id: f.type.id },
    data: { quantityTotal: 2000, quantityAvailable: 1995 },
  });
  await prisma.ticketTier.update({ where: { id: f.tier.id }, data: { quantityLimit: 2000 } });
  const invoice = await prisma.order.create({
    data: {
      orderNumber: randomUUID(),
      userId: f.buyer.id,
      eventId: f.event.id,
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      totalAmount: 20000,
      currency: 'usd',
    },
  });
  const tickets = Array.from({ length: 1000 }, () => ({
    id: randomUUID(),
    userId: f.buyer.id,
    orderId: invoice.id,
    eventId: f.event.id,
    ticketTypeId: f.type.id,
    barcode: 'BULK-' + randomUUID(),
    pricePaid: 20,
    inventoryState: 'SOLD' as const,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  }));
  await prisma.ticket.createMany({ data: tickets });
  const plan = await reviewed(f);
  plan.assignments.push(...tickets.map((ticket) => ({ ticketId: ticket.id, tierId: f.tier.id })));
  const preview = await previewInventory(prisma, plan, target().fingerprint);
  const result = await applyInventory(
    prisma,
    plan,
    preview.planFingerprint,
    target().fingerprint,
    authorized
  );
  expect(result.changedTickets).toBe(1002);
  expect(await prisma.ticket.count({ where: { tierId: f.tier.id } })).toBe(1002);
  expect(await prisma.order.findUniqueOrThrow({ where: { id: invoice.id } })).toEqual(invoice);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).toMatchObject({
    quantitySold: 1001,
    quantityHeld: 1,
    quantityAvailable: 998,
  });
  expect(await prisma.ticketTier.findUniqueOrThrow({ where: { id: f.tier.id } })).toMatchObject({
    quantitySold: 1001,
    quantityHeld: 1,
  });
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(1);
});

it('lets only one concurrent application of a reviewed plan commit', async () => {
  const f = await fixture(),
    plan = await reviewed(f),
    preview = await previewInventory(prisma, plan, target().fingerprint);
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      applyInventory(prisma, plan, preview.planFingerprint, target().fingerprint, authorized)
    )
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await prisma.ticketInventoryReconciliation.count()).toBe(1);
  expect(
    (await prisma.ticketType.findUniqueOrThrow({ where: { id: f.type.id } })).quantityAvailable
  ).toBe(8);
  expect(
    (await prisma.ticketTier.findUniqueOrThrow({ where: { id: f.tier.id } })).quantitySold
  ).toBe(1);
});
