#!/usr/bin/env node
// Requires an empty, explicitly authorized disposable loopback database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { assertDisposableTestTarget } = require('./test-target.cjs');
const root = path.resolve(__dirname, '..');
const api = path.join(root, 'tixmoapi2');
const apiRequire = createRequire(path.join(api, 'package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
const prefixEnd = '20260602010000_add_payment_webhook_events';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-upgrade-'));
let prisma;
let evidenceDir;
let phase = 'target-guard';
const artifacts = {};
const sha256 = data => createHash('sha256').update(data).digest('hex');
// JSON.stringify converts Dates to ISO strings; bigint must not lose precision.
const json = value => JSON.stringify(value, (key, item) =>
  typeof item === 'bigint' ? { $bigint: item.toString() } : item, 2) + '\n';
// Persist only selected synthetic row data, never credentials, addresses or URLs.
const scrub = value => {
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(scrub);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/password|email|barcode|qr_code|payment_intent|error_message|token|api_key/i.test(key))
    .map(([key, item]) => [key, scrub(item)]));
};
const persist = (name, value) => {
  if (!evidenceDir) return;
  const bytes = json(scrub(value));
  const fd = fs.openSync(path.join(evidenceDir, name), 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); fs.fchmodSync(fd, 0o400); }
  finally { try { fs.fchmodSync(fd, 0o400); } finally { fs.closeSync(fd); } }
  artifacts[name] = sha256(bytes);
};
const startEvidence = () => {
  const parent = process.env.TIXMO_UPGRADE_EVIDENCE_DIR;
  if (!parent) return; // Default remains in-memory only.
  const resolved = path.resolve(parent);
  const stat = fs.lstatSync(resolved);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
  assert.equal(fs.realpathSync(resolved), resolved, 'Evidence parent must not traverse symlinks');
  assert.equal(stat.uid, process.getuid(), 'Evidence parent must be owned by this user');
  assert.equal(stat.mode & 0o777, 0o700, 'Evidence parent must be mode 0700');
  // Caller separately attests disk backing; filesystem ownership is not authorization.
  evidenceDir = fs.mkdtempSync(path.join(resolved, 'upgrade-'));
  fs.chmodSync(evidenceDir, 0o700);
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.equal(commit.status, 0);
  assert.match(commit.stdout.trim(), /^[a-f0-9]{40}$/);
  persist('provenance.json', {
    format: 1, commit: commit.stdout.trim(), startedAt: new Date(), prefixEnd,
    harnessSha256: sha256(fs.readFileSync(__filename)),
    fixtureSha256: sha256(fs.readFileSync(path.join(api, 'tests/migrations/payment-inventory-upgrade-fixture.sql'))),
    scope: 'synthetic selected rows; not dump, restore, parity or rollback proof',
  });
};
const runPrisma = (args) => {
  const result = spawnSync(process.execPath, [apiRequire.resolve('prisma/build/index.js'), ...args],
    { cwd: api, env: process.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Disposable migration verification failed: ' + result.stderr);
};
(async () => {
  process.env.DATABASE_URL = assertDisposableTestTarget();
  startEvidence();
  phase = 'prefix-and-fixture';
  prisma = new PrismaClient({ log: [] });
  const tables = await prisma.$queryRaw`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
  assert.equal(tables[0].count, 0, 'Upgrade verification requires an empty disposable database');
  const staged = path.join(temp, 'prisma');
  fs.mkdirSync(path.join(staged, 'migrations'), { recursive: true });
  fs.copyFileSync(path.join(api, 'prisma/schema.prisma'), path.join(staged, 'schema.prisma'));
  const source = path.join(api, 'prisma/migrations');
  for (const name of fs.readdirSync(source).sort()) {
    if (name <= prefixEnd || name === 'migration_lock.toml') fs.cpSync(path.join(source, name), path.join(staged, 'migrations', name), { recursive: true });
  }
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  runPrisma(['db', 'execute', '--schema', path.join(staged, 'schema.prisma'), '--file', path.join(api, 'tests/migrations/payment-inventory-upgrade-fixture.sql')]);
  // Snapshot legacy columns only; added/rotated columns have separate assertions.
  const snapshot = async () => ({
    orders: await prisma.$queryRawUnsafe('SELECT id, order_number, user_id, event_id, status, total_amount, fees_amount, tax_amount, discount_amount, payment_status, payment_intent_id, created_at, updated_at FROM orders ORDER BY id'),
    webhooks: await prisma.$queryRawUnsafe('SELECT id, type, payment_intent_id, order_id, status, error_message, processing_started_at, processed_at, created_at, updated_at FROM payment_webhook_events ORDER BY id'),
    scans: await prisma.$queryRawUnsafe('SELECT * FROM scan_logs ORDER BY id'),
    tickets: await prisma.$queryRawUnsafe('SELECT id, order_id, event_id, ticket_type_id, user_id, price_paid, checked_in_at, checked_in_by, transferred_from, transferred_at, created_at FROM tickets ORDER BY id'),
    types: await prisma.$queryRawUnsafe('SELECT id, quantity_total, quantity_available FROM ticket_types ORDER BY id'),
    tiers: await prisma.$queryRawUnsafe('SELECT id, quantity_limit, quantity_sold FROM ticket_tiers ORDER BY id'),
    users: await prisma.$queryRawUnsafe('SELECT id, email, password_hash, first_name, last_name, created_at, updated_at FROM users ORDER BY id'),
  });
  const before = await snapshot();
  const readLedger = () => prisma.$queryRawUnsafe('SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
  persist('before.json', { rows: before, ledger: await readLedger() });
  phase = 'upgrade';
  const names = fs.readdirSync(source).filter(name => fs.existsSync(path.join(source, name, 'migration.sql'))).sort();
  assert.equal(names.length, 31, 'Review migration set changes before running');
  assert.equal(names.indexOf(prefixEnd), 25);
  persist('migration-sources.json', names.map(name => ({ name, checksum: sha256(fs.readFileSync(path.join(source, name, 'migration.sql'))) })));
  for (const name of names.filter(name => name > prefixEnd)) {
    fs.cpSync(path.join(source, name), path.join(staged, 'migrations', name), { recursive: true });
  }
  runPrisma(['migrate', 'deploy', '--schema', path.join(staged, 'schema.prisma')]);
  const after = await snapshot();
  const inventory = {
    tickets: await prisma.$queryRawUnsafe('SELECT id, inventory_state, tier_id FROM tickets ORDER BY id'),
    types: await prisma.$queryRawUnsafe('SELECT id, quantity_total, quantity_available, tier_inventory_status FROM ticket_types ORDER BY id'),
    tiers: await prisma.$queryRawUnsafe('SELECT id, quantity_limit, quantity_sold, quantity_held FROM ticket_tiers ORDER BY id'),
    generations: await prisma.$queryRawUnsafe('SELECT id, attempt_generation FROM payment_webhook_events ORDER BY id'),
  };
  persist('after.json', { rows: after, inventory, ledger: await readLedger() });
  phase = 'assertions';
  assert.deepEqual(after, before, 'Legacy identities, money and history must survive');
  const ledger = await readLedger();
  const expectedTickets = [
    ['upgrade-ambiguous-ticket', 'SOLD', null],
    ['upgrade-cancelled-ticket', 'UNKNOWN', null],
    ['upgrade-held', 'HELD', 'upgrade-tier'],
    ['upgrade-inconsistent-ticket', 'SOLD', 'upgrade-inconsistent-tier'],
    ['upgrade-released', 'RELEASED', null],
    ['upgrade-transferred', 'SOLD', 'upgrade-tier'],
    ['upgrade-unmatched-ticket', 'SOLD', null],
    ['upgrade-used', 'SOLD', 'upgrade-tier'],
  ];
  assert.deepEqual(inventory.tickets.map(row => [row.id, row.inventory_state, row.tier_id]), expectedTickets);
  assert.deepEqual(inventory.types.map(row => [row.id, row.quantity_total, row.quantity_available, row.tier_inventory_status]),
    ['ambiguous', 'cancelled', 'inconsistent', 'known', 'unmatched'].map(label =>
      ['upgrade-' + label, 100, 90, label === 'known' ? 'READY' : 'REQUIRES_RECONCILIATION']));
  assert.deepEqual(inventory.tiers.map(row => [row.id, row.quantity_limit, row.quantity_sold, row.quantity_held]), [
    ['upgrade-ambiguous-a', 10, 0, 0], ['upgrade-ambiguous-b', 10, 0, 0],
    ['upgrade-cancelled-tier', 10, 1, 0], ['upgrade-inconsistent-tier', 10, 5, 0],
    ['upgrade-tier', 3, 2, 1], ['upgrade-unmatched-tier', 10, 0, 0],
  ]);
  assert.deepEqual(ledger.map(row => row.migration_name), names);
  for (const row of ledger) assert.equal(row.checksum, require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(source, row.migration_name, 'migration.sql'))).digest('hex'));
  const generations = await prisma.$queryRawUnsafe('SELECT attempt_generation FROM payment_webhook_events');
  assert.equal(generations.length, 3);
  for (const row of generations) assert.equal(row.attempt_generation, 0n);
  for (const id of ['upgrade-bootstrap', 'upgrade-deleted']) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    assert.ok(user.disabledAt); assert.equal(user.sessionVersion, 1); assert.equal(user.isPlatformAdmin, false);
    if (id === 'upgrade-deleted') { assert.equal(user.role, 'CUSTOMER'); assert.equal(user.organizationId, null); }
  }
  const normal = await prisma.user.findUniqueOrThrow({ where: { id: 'upgrade-buyer' } });
  assert.equal(normal.disabledAt, null); assert.equal(normal.sessionVersion, 0);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: 'upgrade-unscoped' } })).isPlatformAdmin, false);
  const used = await prisma.ticket.findUniqueOrThrow({ where: { id: 'upgrade-used' } });
  assert.equal(used.status, 'USED'); assert.equal(used.barcode, 'SYNTHETIC-USED');
  for (const label of ['ambiguous', 'unmatched', 'inconsistent', 'cancelled']) {
    assert.equal((await prisma.ticketType.findUniqueOrThrow({ where: { id: 'upgrade-' + label } })).tierInventoryStatus, 'REQUIRES_RECONCILIATION');
  }
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: 'upgrade-transferred' } });
  assert.ok(ticket.updatedAt > new Date('2026-06-02T00:00:00Z'));
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
  phase = 'checkout-runtime';
  // Exercise the upgraded checkout runtime against the populated tier limit.
  const { orderService } = require(path.join(api, 'dist/api/orders/service.js'));
  await assert.rejects(orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: known.id, quantity: 1 }] }), /pricing tier/);
  for (const label of ['ambiguous', 'unmatched', 'inconsistent']) {
    await assert.rejects(orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: 'upgrade-' + label, quantity: 1 }] }), /requires inventory reconciliation/);
  }
  await require(path.join(api, 'dist/config/prisma.js')).default.$disconnect();
  process.stdout.write('Populated upgrade passed: transfer revocation, tier limits, ambiguous-history gate, historical currency and receipt safety.\n');
  phase = 'complete';
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; })
  .finally(async () => {
    try { if (prisma) await prisma.$disconnect(); }
    catch { process.stderr.write('Prisma disconnect failed; retained evidence is partial.\n'); process.exitCode = 1; }
    finally {
      // No raw errors/env/connection strings are written to evidence. Earlier files
      // survive failures and are never overwritten or removed with staging cleanup.
      try {
        persist('result.json', { passed: !process.exitCode, phase, finishedAt: new Date(), artifacts: { ...artifacts } });
      } catch {
        process.stderr.write('Evidence finalization failed; earlier artifacts retained.\n');
        process.exitCode = 1;
      } finally {
        if (evidenceDir) fs.chmodSync(evidenceDir, 0o500);
        fs.rmSync(temp, { recursive: true, force: true });
      }
    }
  });
