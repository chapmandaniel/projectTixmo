#!/usr/bin/env node
// Requires an empty, explicitly authorized disposable loopback database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { assertDisposableTestTarget } = require('./test-target.cjs');
const root = path.resolve(__dirname, '..');
const api = path.join(root, 'tixmoapi2');
const apiRequire = createRequire(path.join(api, 'package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
const migration = '20261005003000_payment_and_inventory_integrity';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-upgrade-'));
let prisma, runtimePrisma;
const runPrisma = (args) => {
  const result = spawnSync(process.execPath, [apiRequire.resolve('prisma/build/index.js'), ...args],
    { cwd: api, env: process.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Disposable migration verification failed: ' + result.stderr);
};
(async () => {
  process.env.DATABASE_URL = assertDisposableTestTarget();
  prisma = new PrismaClient({ log: [] });
  const tables = await prisma.$queryRaw`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
  assert.equal(tables[0].count, 0, 'Upgrade verification requires an empty disposable database');
  const staged = path.join(temp, 'prisma');
  fs.mkdirSync(path.join(staged, 'migrations'), { recursive: true });
  fs.copyFileSync(path.join(api, 'prisma/schema.prisma'), path.join(staged, 'schema.prisma'));
  const source = path.join(api, 'prisma/migrations');
  for (const name of fs.readdirSync(source).sort()) {
    if (name < migration || name === 'migration_lock.toml') fs.cpSync(path.join(source, name), path.join(staged, 'migrations', name), { recursive: true });
  }
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  runPrisma(['db', 'execute', '--schema', path.join(staged, 'schema.prisma'), '--file', path.join(api, 'tests/migrations/payment-inventory-upgrade-fixture.sql')]);
  fs.cpSync(path.join(source, migration), path.join(staged, 'migrations', migration), { recursive: true });
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: 'upgrade-transferred' } });
  assert.notEqual(ticket.barcode, 'PRE-UPGRADE-SENDER-CREDENTIAL');
  assert.equal(ticket.qrCodeUrl, null); assert.equal(ticket.status, 'VALID');
  assert.equal(ticket.userId, 'upgrade-recipient'); assert.equal(ticket.tierId, 'upgrade-tier');
  const tier = await prisma.ticketTier.findUniqueOrThrow({ where: { id: 'upgrade-tier' } });
  assert.equal(tier.quantitySold, 2); assert.equal(tier.quantityHeld, 1);
  const known = await prisma.ticketType.findUniqueOrThrow({ where: { id: 'upgrade-known' } });
  const unclear = await prisma.ticketType.findUniqueOrThrow({ where: { id: 'upgrade-ambiguous' } });
  assert.equal(known.tierInventoryStatus, 'READY');
  assert.equal(unclear.tierInventoryStatus, 'REQUIRES_RECONCILIATION');
  const order = await prisma.order.findUniqueOrThrow({ where: { id: 'upgrade-paid' } });
  assert.equal(order.currency, 'usd'); assert.equal(order.receiptStatus, 'LEGACY_UNKNOWN');
  assert.equal(order.receiptSentAt, null);
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })).amount, 1600);
  // A real pre-generation ledger row must retain identity and receive generation zero.
  await prisma.$executeRaw`INSERT INTO payment_webhook_events (id, type, status, created_at, updated_at) VALUES ('upgrade-legacy-webhook', 'payment_intent.succeeded', 'FAILED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
  // Select only legacy columns until every additive migration has been applied.
  const eventSelection = { id: true, organizationId: true, name: true, slug: true,
    status: true, startDatetime: true, endDatetime: true };
  const existingEvent = await prisma.event.findUniqueOrThrow({
    where: { id: 'upgrade-event' }, select: eventSelection,
  });
  const refundedMigration = '20261026180000_payment_status_refunded';
  const { MIGRATION_COUNT } = require(path.join(api, 'scripts/migration-census.cjs'));
  const refundedSql = fs.readFileSync(path.join(source, refundedMigration, 'migration.sql'), 'utf8');
  assert.match(refundedSql, /ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';/);
  assert.doesNotMatch(refundedSql, /\b(INSERT|UPDATE|DELETE)\b/);
  for (const name of fs.readdirSync(source).sort()) {
    if (name > migration) {
      // The new PaymentStatus label is proved on its own, after every other migration.
      if (name === refundedMigration) continue;
      fs.cpSync(path.join(source, name), path.join(staged, 'migrations', name), { recursive: true });
    }
  }
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  const labelsBefore = await prisma.$queryRaw`SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'PaymentStatus'`;
  assert.deepEqual(labelsBefore.map((row) => row.label).sort(), ['FAILED', 'PENDING', 'PROCESSING', 'SUCCEEDED']);
  const ledgerBefore = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`;
  assert.equal(ledgerBefore.length, MIGRATION_COUNT - 1);
  assert.equal(ledgerBefore.some((row) => row.migration_name === refundedMigration), false);
  const version = await prisma.$queryRaw`SELECT current_setting('server_version_num') AS version`;
  assert.ok(Number(version[0].version) >= 120000);
  // The type must already be committed. PostgreSQL 18 allows a new label on a
  // type created in the same transaction; a label added to an existing type
  // still cannot be used until that transaction commits.
  await prisma.$executeRawUnsafe(`CREATE TYPE "RefundedProbe" AS ENUM ('SUCCEEDED')`);
  let rejectedUncommittedUse = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`ALTER TYPE "RefundedProbe" ADD VALUE 'REFUNDED'`);
      await tx.$queryRawUnsafe(`SELECT 'REFUNDED'::"RefundedProbe" AS label`);
    });
  } catch (error) {
    rejectedUncommittedUse = /unsafe use of new value/.test(String(error && error.message));
  }
  assert.equal(rejectedUncommittedUse, true);
  const probeLabels = await prisma.$queryRaw`SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'RefundedProbe' ORDER BY e.enumsortorder`;
  assert.deepEqual(probeLabels.map((row) => row.label), ['SUCCEEDED']);
  await prisma.$executeRawUnsafe(`DROP TYPE "RefundedProbe"`);
  fs.cpSync(path.join(source, refundedMigration), path.join(staged, 'migrations', refundedMigration), { recursive: true });
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  const labelsAfter = await prisma.$queryRaw`SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'PaymentStatus'`;
  assert.deepEqual(labelsAfter.map((row) => row.label).sort(), ['FAILED', 'PENDING', 'PROCESSING', 'REFUNDED', 'SUCCEEDED']);
  assert.equal((await prisma.$queryRaw`SELECT 'REFUNDED'::"PaymentStatus" AS label`)[0].label, 'REFUNDED');
  const ledgerAfter = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`;
  assert.equal(ledgerAfter.length, MIGRATION_COUNT);
  assert.equal(ledgerAfter.some((row) => row.migration_name === refundedMigration), true);
  const upgradedEvent = await prisma.event.findUniqueOrThrow({
    where: { id: 'upgrade-event' }, select: { ...eventSelection, salesPaused: true },
  });
  assert.deepEqual(upgradedEvent, { ...existingEvent, salesPaused: false });
  assert.equal(await prisma.eventSalesControl.count(), 0, 'Upgrade must not fabricate pause audit history');
  // Exercise the upgraded checkout runtime against the populated tier limit.
  const { orderService } = require(path.join(api, 'dist/api/orders/service.js'));
  runtimePrisma = require(path.join(api, 'dist/config/prisma.js')).default;
  await assert.rejects(orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: known.id, quantity: 1 }] }), /pricing tier/);
  await assert.rejects(orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: unclear.id, quantity: 1 }] }), /requires inventory reconciliation/);
  const legacy = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: 'upgrade-legacy-webhook' } });
  assert.equal(legacy.attemptGeneration, 0n);
  assert.equal(legacy.status, 'FAILED');
  assert.equal((await prisma.paymentWebhookEvent.updateMany({ where: { id: legacy.id, attemptGeneration: 0n, status: 'FAILED' }, data: { attemptGeneration: { increment: 1 }, status: 'PROCESSING' } })).count, 1);
  assert.equal((await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: legacy.id } })).attemptGeneration, 1n);
  for (const id of ['upgrade-paid', 'upgrade-pending', 'upgrade-unclear']) {
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id } })).currency, 'usd');
  }
  const defaults = await prisma.$queryRaw`SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'`;
  assert.equal(defaults[0].column_default, "'cad'::text");
  await prisma.$executeRaw`INSERT INTO orders (id, order_number, user_id, event_id, total_amount, updated_at) VALUES ('upgrade-default-cad', 'UPGRADE-DEFAULT-CAD', 'upgrade-buyer', 'upgrade-event', 1, CURRENT_TIMESTAMP)`;
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: 'upgrade-default-cad' } })).currency, 'cad');
  const freshName = 'tixmo_disposable_refunded_fresh';
  assert.match(freshName, /^tixmo_disposable_[a-z0-9_]+$/);
  const savedUrl = process.env.DATABASE_URL;
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${freshName} WITH (FORCE)`);
  // template0 accepts no sessions, so this still works while the service image
  // has other connections to template1.
  await prisma.$executeRawUnsafe(`CREATE DATABASE ${freshName} TEMPLATE template0`);
  const freshUrl = new URL(savedUrl);
  freshUrl.pathname = `/${freshName}`;
  let freshPrisma;
  process.env.DATABASE_URL = freshUrl.toString();
  try {
    runPrisma(['migrate', 'deploy', '--schema', path.join(api, 'prisma/schema.prisma')]);
    freshPrisma = new PrismaClient({ datasources: { db: { url: freshUrl.toString() } }, log: [] });
    const names = (await freshPrisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`).map((row) => row.migration_name);
    assert.equal(names.length, MIGRATION_COUNT);
    const currencyIndex = names.indexOf('20261026120000_order_currency_default_cad');
    const refundedIndex = names.indexOf(refundedMigration);
    const linesIndex = names.indexOf('20261026230000_payment_refund_lines');
    assert.equal(refundedIndex, currencyIndex + 1);
    assert.equal(linesIndex, refundedIndex + 1);
    assert.equal((await freshPrisma.$queryRaw`SELECT 'REFUNDED'::"PaymentStatus" AS label`)[0].label, 'REFUNDED');
  } finally {
    if (freshPrisma) await freshPrisma.$disconnect();
    process.env.DATABASE_URL = savedUrl;
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${freshName} WITH (FORCE)`);
  }
  process.stdout.write('Populated upgrade passed: transfer revocation, tier limits, ambiguous-history gate, historical currency, receipt safety, legacy webhook generation, additive unpaused event/audit upgrade, and PaymentStatus REFUNDED on a fresh database and on top of the previous migrations.\n');
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; })
  .finally(async () => { if (runtimePrisma) await runtimePrisma.$disconnect(); if (prisma) await prisma.$disconnect(); fs.rmSync(temp, { recursive: true, force: true }); });
