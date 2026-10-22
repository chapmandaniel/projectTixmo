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
  for (const name of fs.readdirSync(source).sort()) {
    if (name > migration) fs.cpSync(path.join(source, name), path.join(staged, 'migrations', name), { recursive: true });
  }
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
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
  process.stdout.write('Populated upgrade passed: transfer revocation, tier limits, ambiguous-history gate, historical currency, receipt safety, legacy webhook generation and additive unpaused event/audit upgrade.\n');
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; })
  .finally(async () => { if (runtimePrisma) await runtimePrisma.$disconnect(); if (prisma) await prisma.$disconnect(); fs.rmSync(temp, { recursive: true, force: true }); });
