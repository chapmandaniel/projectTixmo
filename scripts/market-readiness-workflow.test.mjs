// Dependency-free contract check, not a YAML parser or GitHub runner emulator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyApi } from './verify-api.mjs';

const workflow = readFileSync(new URL('../.github/workflows/market-readiness-local.yml', import.meta.url), 'utf8');
const gateStep = workflow.split('      - name: Run market readiness gates\n')[1];
const mapped = { postgres: { 5432: '49152' }, redis: { 6379: '49153' } };
const env = {};
for (const key of ['TIXMO_ALLOW_DESTRUCTIVE_TESTS', 'DATABASE_URL', 'REDIS_URL']) {
  const value = gateStep.match(new RegExp(`^          ${key}: (.+)$`, 'm'))?.[1];
  assert.ok(value, `${key} must be step-scoped`);
  env[key] = value.replace(/^'(.*)'$/, '$1').replace(
    /\$\{\{ job\.services\.(postgres|redis)\.ports\[(5432|6379)\] \}\}/g,
    (_, service, port) => mapped[service][port],
  );
  assert.doesNotMatch(env[key], /\$\{\{/);
}

test('workflow uses job services, random loopback ports and health checks', () => {
  assert.match(workflow, /image: postgres:14/);
  assert.match(workflow, /image: redis:7/);
  assert.match(workflow, /'127\.0\.0\.1::5432'/);
  assert.match(workflow, /'127\.0\.0\.1::6379'/);
  assert.match(workflow, /POSTGRES_DB: tixmo_disposable_ci/);
  assert.match(workflow, /--health-cmd "pg_isready -U tixmo_ci -d tixmo_disposable_ci"/);
  assert.match(workflow, /--health-cmd "redis-cli ping"/);
  assert.doesNotMatch(workflow, /container_name:|volumes:|docker compose|--env-file|dotenv/);
  assert.match(gateStep, /run: npm run verify:market/);
});

test('interpolated workflow env satisfies real verifier, with subprocesses stubbed', () => {
  const calls = [];
  verifyApi({ env, log: () => {}, spawn: (...args) => { calls.push(args); return { status: 0 }; } });
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0][2].env.DATABASE_URL).port, '49152');
  assert.equal(new URL(calls[0][2].env.REDIS_URL).port, '49153');
});

for (const mutation of [
  { TIXMO_ALLOW_DESTRUCTIVE_TESTS: undefined },
  { DATABASE_URL: env.DATABASE_URL.replace('tixmo_disposable_ci', 'tixmoapi') },
  { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') },
  { REDIS_URL: env.REDIS_URL.replace(/\/1$/, '/0') },
  { REDIS_URL: env.REDIS_URL.replace(/\/1$/, '') },
  { REDIS_URL: env.REDIS_URL.replace(/\/1$/, '/16') },
]) {
  test(`workflow mutation rejects before any action: ${JSON.stringify(mutation)}`, () => {
    let calls = 0;
    assert.throws(() => verifyApi({ env: { ...env, ...mutation }, log: () => {}, spawn: () => { calls++; } }), /Unsafe verification/);
    assert.equal(calls, 0);
  });
}

// Source-contract checks only: never import/execute the migration helper or Prisma.
import targetGuard from './test-target.cjs';
const upgradeHelper = readFileSync(new URL('./verify-payment-upgrade.cjs', import.meta.url), 'utf8');
function upgradeContract(text, helper = upgradeHelper) {
  const marker = '      - name: Verify populated migration upgrade\n';
  const step = text.split(marker)[1]?.split('      - name: Run market readiness gates\n')[0];
  assert.ok(step, 'upgrade step must precede the unchanged full market gates');
  assert.ok(text.indexOf(marker) < text.indexOf('      - name: Run market readiness gates\n'), 'full market gates must remain after upgrade');
  assert.match(text, /run: npm run verify:market/);
  const values = {};
  for (const key of ['TIXMO_ALLOW_TEST_RESET', 'DATABASE_URL', 'REDIS_URL']) {
    const value = step.match(new RegExp(`^          ${key}: (.+)$`, 'm'))?.[1];
    assert.ok(value, `${key} must be scoped to the upgrade step`);
    values[key] = value.replace(/^'(.*)'$/, '$1').replace(
      /\$\{\{ job\.services\.(postgres|redis)\.ports\[(5432|6379)\] \}\}/g,
      (_, service, port) => mapped[service][port],
    );
  }
  assert.equal(values.DATABASE_URL, env.DATABASE_URL, 'upgrade must use the same job disposable database');
  assert.equal(values.REDIS_URL, env.REDIS_URL, 'upgrade must use the same job disposable Redis DB1');
  assert.match(text, /^      NODE_ENV: test$/m);
  assert.match(step, /TIXMO_TEST_DATABASE_URL="\$DATABASE_URL" node scripts\/verify-payment-upgrade\.cjs/);
  assert.ok(step.indexOf('npm --prefix tixmoapi2 run build') < step.indexOf('TIXMO_TEST_DATABASE_URL='));
  assert.match(step, /npm --prefix tixmoapi2 run build/);
  targetGuard.assertDisposableTestTarget({ NODE_ENV: 'test', ...values, TIXMO_TEST_DATABASE_URL: values.DATABASE_URL });
  assert.ok(helper.indexOf('assertDisposableTestTarget();') < helper.indexOf('prisma = new PrismaClient'));
  const remaining = helper.indexOf('if (name > migration)');
  const deploy = helper.indexOf("runPrisma(['migrate', 'deploy'", remaining);
  const runtime = helper.indexOf("require(path.join(api, 'dist/api/orders/service.js'))");
  assert.ok(remaining > 0 && deploy > remaining && runtime > deploy, 'current checkout loads only after all remaining migration DDL');
  assert.ok(helper.indexOf('const existingEvent =') < remaining);
  assert.ok(helper.indexOf('const upgradedEvent =') > deploy);
  assert.match(helper, /assert\.deepEqual\(upgradedEvent, \{ \.\.\.existingEvent, salesPaused: false \}\)/);
  assert.match(helper, /assert\.equal\(await prisma\.eventSalesControl\.count\(\), 0,/);
  assert.match(helper, /if \(runtimePrisma\) await runtimePrisma\.\$disconnect\(\)/);
  return values;
}
test('populated upgrade reuses guarded disposable services before all full market checks', () => {
  const values = upgradeContract(workflow);
  assert.equal(new URL(values.DATABASE_URL).port, '49152');
  assert.equal(new URL(values.REDIS_URL).port, '49153');
  assert.match(gateStep, /TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1'/);
  assert.match(gateStep, /run: npm run verify:market/);
});
for (const [name, mutate] of [
  ['wrong reset authorization', text => text.replace("TIXMO_ALLOW_TEST_RESET: 'true'", "TIXMO_ALLOW_TEST_RESET: '1'")],
  ['missing matching target derivation', text => text.replace('TIXMO_TEST_DATABASE_URL="$DATABASE_URL"', 'TIXMO_TEST_DATABASE_URL=""')],
  ['remote upgrade database', text => text.replace('DATABASE_URL: postgresql://tixmo_ci:synthetic_ci_password@127.0.0.1:', 'DATABASE_URL: postgresql://tixmo_ci:synthetic_ci_password@remote.invalid:')],
  ['wrong upgrade Redis DB', text => text.replace('ports[6379] }}/1', 'ports[6379] }}/0')],
  ['removed build', text => text.replace('npm --prefix tixmoapi2 run build', 'echo skipped')],
  ['removed full gates', text => text.replace('Run market readiness gates', 'Removed market gates')],
]) test(`upgrade workflow rejects mutation: ${name}`, () => assert.throws(() => upgradeContract(mutate(workflow))));
test('upgrade contract rejects current checkout loading before remaining DDL', () => {
  assert.throws(() => upgradeContract(workflow, upgradeHelper.replace('if (name > migration)', 'if (name === migration)')));
});
test('upgrade verifier retains legacy transfer tier history currency receipt and generation assertions', () => {
  for (const assertion of [
    "assert.notEqual(ticket.barcode, 'PRE-UPGRADE-SENDER-CREDENTIAL')",
    "assert.equal(ticket.qrCodeUrl, null)",
    "assert.equal(ticket.userId, 'upgrade-recipient')",
    "assert.equal(tier.quantitySold, 2)",
    "assert.equal(tier.quantityHeld, 1)",
    "assert.equal(unclear.tierInventoryStatus, 'REQUIRES_RECONCILIATION')",
    "assert.equal(order.currency, 'usd')",
    "assert.equal(order.receiptStatus, 'LEGACY_UNKNOWN')",
    "assert.equal(order.receiptSentAt, null)",
    "assert.equal(legacy.attemptGeneration, 0n)",
    "assert.equal(legacy.status, 'FAILED')",
    "orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: known.id, quantity: 1 }] }), /pricing tier/",
    "orderService.createOrder('upgrade-buyer', { items: [{ ticketTypeId: unclear.id, quantity: 1 }] }), /requires inventory reconciliation/",
  ]) assert.ok(upgradeHelper.includes(assertion), `must preserve ${assertion}`);
});
