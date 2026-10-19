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
