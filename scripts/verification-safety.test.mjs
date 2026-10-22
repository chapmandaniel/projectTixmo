import test from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import safety from './verification-safety.cjs';
import { verifyApi, formatTestFailures } from './verify-api.mjs';

const safe = {
  TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1',
  DATABASE_URL: 'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/tixmo_disposable_guard?schema=public',
  REDIS_URL: 'redis://synthetic_user:synthetic_password@localhost:6379/15',
};
const unsafe = [
  {}, { ...safe, TIXMO_ALLOW_DESTRUCTIVE_TESTS: undefined },
  ...[undefined, '', 'not-a-url', 'postgresql://u:%zz@localhost/tixmo_disposable_guard',
    'postgresql://localhost/tixmoapi', 'postgresql://remote.example/tixmo_disposable_guard',
    'postgresql://localhost.evil/tixmo_disposable_guard',
    'postgresql://localhost/tixmo_disposable_guard?host=remote.example',
    'postgresql://localhost/tixmo_disposable_guard?password=synthetic_query_secret',
    'postgresql://localhost/tixmo_disposable_guard#synthetic_secret',
    'postgresql://localhost/tixmo_disposable_guard?schema=public&schema=public',
  ].map(DATABASE_URL => ({ ...safe, DATABASE_URL })),
  ...[undefined, '', 'redis://localhost', 'redis://localhost/0', 'redis://localhost/16',
    'redis://remote.example/15', 'redis://localhost/15?password=synthetic_query_secret', 'bad redis',
  ].map(REDIS_URL => ({ ...safe, REDIS_URL })),
];

// Execute the actual setup prefix with only import bindings injected. No Jest,
// TypeScript compiler, app config, dotenv, Prisma, sockets or child processes.
const setupPrefix = fs.readFileSync(new URL('../tixmoapi2/tests/setup.ts', import.meta.url), 'utf8')
  .split('// Mock Redis client globally')[0].replace(/^import .*;$/gm, '');
function runSetup(env, execute) {
  vm.runInNewContext(setupPrefix, {
    process: { env }, execSync: execute,
    path: { resolve: () => '/synthetic-api' }, __dirname: '/synthetic-tests',
    require: (id) => { assert.equal(id, '../../scripts/verification-safety.cjs'); return safety; },
  });
}

for (const [index, env] of unsafe.entries()) {
  test(`unsafe configuration ${index} rejects before verifier/setup action`, () => {
    let calls = 0;
    const action = () => { calls++; throw new Error('must not run'); };
    const logs = [];
    assert.throws(() => verifyApi({ env, spawn: action, log: value => logs.push(value) }), /Unsafe verification/);
    assert.throws(() => runSetup(env, action), /Unsafe verification/);
    assert.equal(calls, 0);
    assert.deepEqual(logs, []);
  });
}

test('explicit disposable targets allow only schema and test commands', () => {
  const calls = [];
  verifyApi({ env: safe, spawn: (...args) => { calls.push(args); return { status: 0 }; }, log: () => {} });
  assert.deepEqual(calls.map(([command]) => command), ['npx', 'npm']);
  assert.equal(calls[0][2].env.NODE_ENV, 'test');
  assert.equal(calls[0][2].stdio, 'ignore');
  let count = 0;
  runSetup(safe, (_, options) => { count++; assert.equal(options.stdio, 'ignore'); });
  assert.equal(count, 1);
  safety.validateVerificationTargets({ ...safe, DATABASE_URL: 'postgresql://[::1]/tixmo_disposable_ipv6' });
});

for (const [label, value, useFallback] of [
  ['absent', undefined, true],
  ['empty', '', true],
  ['spaces', '   ', true],
  ['tabs', '\t\t', true],
  ['mixed whitespace', ' \t\n ', true],
  ['your-prefix placeholder', ' YOUR_synthetic ', true],
  ['your-suffix placeholder', 'synthetic_YOUR', true],
  ['change-this placeholder', ' CHANGE-THIS-synthetic ', true],
  ['placeholder marker', 'synthetic_PLACEHOLDER', true],
  ['nonblank synthetic', 'synthetic_nonblank_value', false],
  ['padded nonblank synthetic', ' \tsynthetic_nonblank_value\t ', false],
]) {
  test(`Stripe ${label} credentials use original fallback rules without mutating parent env`, () => {
    const fallbacks = {
      STRIPE_SECRET_KEY: 'sk_test_verify_api',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_verify_api',
      STRIPE_WEBHOOK_SECRET: 'whsec_verify_api',
    };
    const env = Object.freeze({
      ...safe,
      NODE_ENV: 'synthetic_parent',
      ...(value === undefined ? {} : Object.fromEntries(Object.keys(fallbacks).map(key => [key, value]))),
    });
    const original = { ...env };
    let calls = 0;
    verifyApi({
      env, log: () => {},
      spawn: (_command, _args, options) => {
        calls++;
        assert.notEqual(options.env, env);
        assert.equal(options.env.NODE_ENV, 'test');
        for (const [key, fallback] of Object.entries(fallbacks)) {
          assert.equal(options.env[key], useFallback ? fallback : value, key);
        }
        return { status: 0 };
      },
    });
    assert.equal(calls, 2);
    assert.deepEqual(env, original);
  });
}

test('bootstrap failure propagates immediately and child secrets never surface', () => {
  const secret = 'synthetic_child_secret';
  for (const result of [{ status: 1, stderr: secret }, { status: null, error: new Error(secret) }]) {
    let calls = 0;
    assert.throws(() => verifyApi({ env: safe, spawn: () => { calls++; return result; }, log: () => {} }), error => /Schema bootstrap failed/.test(error.message) && !error.message.includes(secret));
    assert.equal(calls, 1);
  }
  assert.throws(() => runSetup(safe, () => { throw new Error(secret); }), error => /bootstrap failed/.test(error.message) && !error.message.includes(secret));
});

test('logs and redaction never retain credentials, query secrets or malformed input', () => {
  const logs = [];
  verifyApi({ env: safe, spawn: () => ({ status: 0, stdout: 'synthetic_child_secret' }), log: value => logs.push(value) });
  for (const value of [safe.DATABASE_URL, safe.REDIS_URL, 'redis://user:pass@localhost/15?token=synthetic_query_secret', 'malformed synthetic_secret']) {
    logs.push(safety.redactConnectionUrl(value));
  }
  assert.doesNotMatch(logs.join('\n'), /synthetic|user|password|token|pass@/);
});

test('API test failure is not reported as success', () => {
  let count = 0;
  assert.throws(() => verifyApi({ env: safe, spawn: () => ({ status: ++count === 1 ? 0 : 1 }), log: () => {} }), /API tests failed/);
});


test('failure diagnostics expose suite filenames and counts without assertion or connection content', () => {
  const diagnostic = formatTestFailures({ numFailedTests: 2, testResults: [
    { status: 'failed', name: '/synthetic/private/payment-recovery.test.ts', message: 'postgresql://synthetic-secret', assertionResults: [{ fullName: 'synthetic-secret', failureMessages: ['synthetic-secret'] }] },
    { status: 'passed', name: '/synthetic/private/passed.test.ts' },
    { status: 'failed', name: 'postgresql://synthetic-secret' },
  ] });
  assert.match(diagnostic, /Failed tests: 2; suites: payment-recovery.test.ts/);
  assert.doesNotMatch(diagnostic, /synthetic|private|postgresql|passed/);
});


test('large child output is discarded without buffer overflow or leaking diagnostics', () => {
  let calls = 0;
  verifyApi({ env: safe, log: () => {}, spawn: (_command, _args, options) => {
    calls++;
    const result = spawnSync(process.execPath, ['-e', "process.stdout.write('x'.repeat(2 * 1024 * 1024)); process.stderr.write('synthetic-child-secret'.repeat(100000));"], options);
    assert.equal(result.status, 0);
    assert.equal(result.error, undefined);
    assert.equal(result.stdout, null);
    assert.equal(result.stderr, null);
    return result;
  } });
  assert.equal(calls, 2);
});

test('failure diagnostics expose only bounded assertion ordinals and matching source lines', () => {
  const diagnostic = formatTestFailures({ numFailedTests: 2, testResults: [{
    status: 'failed', name: '/private/payment-recovery-backlog.test.ts', message: 'synthetic-secret', assertionResults: [
      { status: 'passed', fullName: 'secret passed title' },
      { status: 'failed', fullName: 'secret failed title', failureMessages: ['Error: synthetic-secret https://private.example/token\n    at Object.fn (/private/payment-recovery-backlog.test.ts:421:9)\n    at other (/private/other.test.ts:88:2)'] },
      { status: 'failed', failureMessages: ['synthetic-argument\n at fn (C:\\private\\payment-recovery-backlog.test.ts:17:1)\n at fn (/private/payment-recovery-backlog.test.ts:100000:1)\n at fn (/private/payment-recovery-backlog.test.ts:0:1)\n at fn (/private/payment-recovery-backlog.test.ts:100001:1)\n at fn (/private/payment-recovery-backlogXtestXts:999:1)\n at fn (https://secret/payment-recovery-backlog.test.ts:666:1)'] },
    ],
  }] });
  assert.equal(diagnostic, ' Failed tests: 2; suites: payment-recovery-backlog.test.ts; assertions: payment-recovery-backlog.test.ts#2@421; payment-recovery-backlog.test.ts#3@17,100000.');
  assert.doesNotMatch(diagnostic, /private|synthetic|secret|https|argument|title|666|999|100001/);
});

test('malformed diagnostic reports cannot expose object coercion or unbounded fields', () => {
  const hidden = { toString: () => { throw new Error('must not coerce synthetic-secret'); } };
  for (const report of [undefined, null, 7, 'synthetic-secret', { testResults: hidden }, { testResults: [null, 42, {}, { status: 'failed', name: hidden }] }]) {
    assert.equal(formatTestFailures(report), ' Failed tests: unknown; suites: unavailable; assertions: unavailable.');
  }
  const diagnostic = formatTestFailures({ numFailedTests: -1, testResults: [{ status: 'failed', name: 'safe.test.ts', assertionResults: [null, { status: 'failed', failureMessages: [hidden, null, 5] }] }] });
  assert.equal(diagnostic, ' Failed tests: unknown; suites: safe.test.ts; assertions: safe.test.ts#2.');
  for (const numFailedTests of [Infinity, NaN, 1000001, '3']) assert.match(formatTestFailures({ numFailedTests }), /Failed tests: unknown/);
});

test('diagnostic traversal and output stay bounded with oversized reports and stack text', () => {
  const cases = Array.from({ length: 1001 }, () => ({ status: 'failed', fullName: 'synthetic-secret', failureMessages: ['x'.repeat(20000) + '\n at fn (/private/safe.test.ts:999:1)'] }));
  const diagnostic = formatTestFailures({ numFailedTests: 1000000, testResults: Array.from({ length: 101 }, (_, i) => ({ status: 'failed', name: `safe${i}.test.ts`, assertionResults: cases })) });
  assert.equal((diagnostic.match(/#/g) || []).length, 20);
  assert.doesNotMatch(diagnostic, /#21|@999|synthetic|safe20|safe100/);
  assert.ok(diagnostic.length < 4000);
  const frame = '\n at fn (/private/safe.test.ts:1:1)';
  const lines = formatTestFailures({ testResults: [{ status: 'failed', name: 'safe.test.ts', assertionResults: [{ status: 'failed', failureMessages: [frame + frame + '\n at fn (/private/safe.test.ts:2:1)\n at fn (/private/safe.test.ts:3:1)\n at fn (/private/safe.test.ts:4:1)'] }] }] });
  assert.match(lines, /safe.test.ts#1@1,2,3\./);
  assert.doesNotMatch(lines, /,4/);
});
