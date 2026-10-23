const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { numeric, booleans, validate, run } = require('./http-pressure-receipt.cjs');
const env = { TIXMO_PRESSURE_SOURCE_SHA: 'a'.repeat(40), TIXMO_PRESSURE_RUN_ID: '12345-1' };
const valid = () => ({
  scope: 'task608-http-reservation-pressure',
  sourceSha: env.TIXMO_PRESSURE_SOURCE_SHA,
  runId: env.TIXMO_PRESSURE_RUN_ID,
  ...Object.fromEntries(numeric.map((key) => [key, 0])),
  ...Object.fromEntries(booleans.map((key) => [key, true])),
  syntheticMaxima: 4000,
  limitsQualified: false,
});
test('fixed complete schema accepts finite numeric aggregate only', () =>
  assert.deepEqual(validate(valid(), env), valid()));
for (const [name, mutate] of [
  [
    'extra-private-key',
    (value) => {
      value['private-canary'] = 'https://private.invalid';
    },
  ],
  [
    'raw-string',
    (value) => {
      value.latencyP95Ms = 'private-canary';
    },
  ],
  [
    'missing',
    (value) => {
      delete value.orders;
    },
  ],
  [
    'nonfinite',
    (value) => {
      value.latencyP95Ms = Infinity;
    },
  ],
  [
    'negative',
    (value) => {
      value.orders = -1;
    },
  ],
  [
    'too-large',
    (value) => {
      value.orders = 1000001;
    },
  ],
  [
    'old-source',
    (value) => {
      value.sourceSha = 'b'.repeat(40);
    },
  ],
  [
    'old-run',
    (value) => {
      value.runId = '12344-1';
    },
  ],
  [
    'nonboolean',
    (value) => {
      value.cleanupVerified = 'private-canary';
    },
  ],
])
  test('reject ' + name + ' without echoing contents', () => {
    const value = valid();
    mutate(value);
    assert.throws(
      () => validate(value, env),
      (error) => error.message === 'Pressure receipt rejected'
    );
  });
test('freshness clear unlinks only fixed owned file, report rejects symlinks and malformed data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task608-receipt-'));
  try {
    run('clear', env, root);
    const directory = path.join(root, 'runtime');
    const file = path.join(directory, 'task608-http-pressure.json');
    const other = path.join(directory, 'other.json');
    fs.writeFileSync(other, 'private-canary');
    assert.throws(() => run('report', env, root));
    fs.writeFileSync(file, JSON.stringify(valid()));
    assert.deepEqual(run('report', env, root), valid());
    run('clear', env, root);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.readFileSync(other, 'utf8'), 'private-canary');
    fs.symlinkSync(other, file);
    assert.throws(() => run('clear', env, root));
    fs.unlinkSync(file);
    fs.writeFileSync(file, 'malformed private-canary');
    assert.throws(() => run('report', env, root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('actual managed workflow clears before test and reports current run even after test failure without relaxing verifier', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../.github/workflows/market-readiness-local.yml'),
    'utf8'
  );
  assert.ok(
    workflow.indexOf('http-pressure-receipt.cjs clear') <
      workflow.indexOf('name: Run market readiness gates')
  );
  assert.ok(
    workflow.indexOf('http-pressure-receipt.cjs report') >
      workflow.indexOf('run: npm run verify:market')
  );
  assert.match(workflow, /steps.market.outcome == 'failure'/);
  assert.match(workflow, /http-pressure-receipt.test.cjs/);
  assert.match(
    workflow,
    /TIXMO_PRESSURE_SOURCE_SHA: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/
  );
  assert.match(
    workflow,
    /TIXMO_PRESSURE_RUN_ID: \$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/
  );
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test('fractional counts are rejected while monotonic duration fractions remain valid', () => {
  const value = valid();
  value.orders = 0.5;
  assert.throws(() => validate(value, env));
  value.orders = 0;
  value.latencyP95Ms = 0.5;
  assert.equal(validate(value, env).latencyP95Ms, 0.5);
});

test('p95 success claim includes the2second boundary but rejects any greater latency', () => {
  const value = valid();
  value.latencyP95Ms = 2000;
  assert.equal(validate(value, env).latencyP95Ms, 2000);
  value.latencyP95Ms = 2000.01;
  assert.throws(() => validate(value, env));
  value.testAssertionsPassed = false;
  assert.equal(validate(value, env).latencyP95Ms, 2000.01);
});
test('synthetic maxima and unqualified deployed limits are fixed, never inferred from success', () => {
  const value = valid();
  value.syntheticMaxima = 1000;
  assert.throws(() => validate(value, env));
  value.syntheticMaxima = 4000;
  value.limitsQualified = true;
  assert.throws(() => validate(value, env));
  const source = fs.readFileSync(
    path.join(__dirname, '../tixmoapi2/tests/integration/orders-http-pressure.test.ts'),
    'utf8'
  );
  assert.match(source, /expect\(metrics.latencyP95Ms\).toBeLessThanOrEqual\(2000\)/);
  assert.match(source, /jest.replaceProperty\(config, name, 4000\)/);
});
