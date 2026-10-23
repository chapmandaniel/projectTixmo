const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  fixed,
  integers,
  durations,
  booleans,
  stagePlan,
  numericInfo,
  validate,
  run,
} = require('./http-ramp-receipt.cjs');
const env = { TIXMO_RAMP_SOURCE_SHA: 'a'.repeat(40), TIXMO_RAMP_RUN_ID: '12345-1' };
function stage(actors = 100) {
  return {
    ...Object.fromEntries([...integers, ...durations].map((key) => [key, 0])),
    ...Object.fromEntries(booleans.map((key) => [key, true])),
    actors,
    maxActiveActors: actors,
    fullActorOverlapMs: 16000,
    reservation201: actors,
    recovery200: actors,
    plannedPublicReads: actors * 10,
    plannedReservations: actors,
    plannedRequests: actors * 12,
    startedRequests: actors * 12,
    completedRequests: actors * 12,
  };
}
const receipt = () => ({
  ...fixed,
  sourceSha: env.TIXMO_RAMP_SOURCE_SHA,
  runId: env.TIXMO_RAMP_RUN_ID,
  stages: [stage()],
});
for (const actors of [100, 250, 500])
  test(
    'stage ' + actors + ' has10paced public reads and one bounded staggered checkout per actor',
    () => {
      const checkouts = [];
      for (let actor = 0; actor < actors; actor++) {
        const actions = stagePlan(actors, actor),
          reads = actions.filter((row) => row.kind === 'public'),
          checkout = actions.filter((row) => row.kind === 'reservation');
        assert.equal(actions.length, 11);
        assert.equal(reads.length, 10);
        assert.equal(checkout.length, 1);
        assert.ok(reads[0].target >= 0 && reads[0].target < 2000);
        assert.ok(reads.at(-1).target >= 18000 && reads.at(-1).target < 20000);
        for (let cycle = 1; cycle < 10; cycle++)
          assert.ok(Math.abs(reads[cycle].target - reads[cycle - 1].target - 2000) < 1e-9);
        assert.ok(checkout[0].target >= 4000 && checkout[0].target < 16000);
        checkouts.push(checkout[0].target);
      }
      assert.equal(new Set(checkouts).size, actors);
      assert.equal(checkouts[0], 4000);
      assert.ok(checkouts.at(-1) > 15800);
    }
  );
test('invalid plans and fixed numeric INFO parsing fail without exposing raw text', () => {
  assert.throws(() => stagePlan(1, 0));
  assert.throws(() => stagePlan(100, 100));
  assert.throws(() => stagePlan(100, -1));
  assert.equal(
    numericInfo('# Memory\r\nused_memory:12345\r\nprivate:canary\r\n', 'used_memory'),
    12345
  );
  assert.equal(numericInfo('connected_clients:2\n', 'connected_clients'), 2);
  for (const [text, name] of [
    ['private-canary', 'used_memory'],
    ['used_memory:9007199254740992\n', 'used_memory'],
    ['private:canary', 'private'],
  ])
    assert.throws(
      () => numericInfo(text, name),
      (error) => error.message === 'Ramp evidence rejected'
    );
});
test('complete fixed projection accepts current run and partial failed stages without raw data', () => {
  const value = receipt();
  value.stages = [stage(100), stage(250), stage(500)];
  assert.deepEqual(validate(value, env), value);
  value.stages[1].testAssertionsPassed = false;
  value.stages[1].reservationP95Ms = 3000;
  assert.equal(validate(value, env).stages[1].reservationP95Ms, 3000);
});
for (const [name, mutate] of [
  [
    'extra-private-field',
    (value) => {
      value.private = 'https://private.invalid';
    },
  ],
  [
    'stale-sha',
    (value) => {
      value.sourceSha = 'b'.repeat(40);
    },
  ],
  [
    'stale-run',
    (value) => {
      value.runId = '12344-1';
    },
  ],
  [
    'browser-claim',
    (value) => {
      value.actorModel = 'browsers';
    },
  ],
  [
    'api-only-resourceclaim',
    (value) => {
      value.resourceScope = 'API-only';
    },
  ],
  [
    'limiter-budgetclaim',
    (value) => {
      value.limitsQualified = true;
    },
  ],
  [
    'readmaxchanged',
    (value) => {
      value.syntheticReadMax = 1000;
    },
  ],
  [
    'unobservedstage',
    (value) => {
      value.stages[0].actors = 250;
    },
  ],
  [
    'private-stage-field',
    (value) => {
      value.stages[0].private = 'canary';
    },
  ],
  [
    'nonfinite',
    (value) => {
      value.stages[0].publicReadP95Ms = NaN;
    },
  ],
  [
    'fractionalcount',
    (value) => {
      value.stages[0].http429 = 0.5;
    },
  ],
  [
    'read-tail',
    (value) => {
      value.stages[0].publicReadP95Ms = 500.01;
    },
  ],
  [
    'reservation-tail',
    (value) => {
      value.stages[0].reservationP95Ms = 2000.01;
    },
  ],
  [
    '5xx-boundary',
    (value) => {
      value.stages[0].unexpected5xxFraction = 0.005;
    },
  ],
  [
    '429',
    (value) => {
      value.stages[0].http429 = 1;
    },
  ],
  [
    '503',
    (value) => {
      value.stages[0].http503 = 1;
    },
  ],
  [
    'network-deadline',
    (value) => {
      value.stages[0].networkErrors = 1;
    },
  ],
  [
    'no-overlap',
    (value) => {
      value.stages[0].fullActorOverlapMs = 13999;
    },
  ],
  [
    'fakeactorpeak',
    (value) => {
      value.stages[0].maxActiveActors = 1;
    },
  ],
  [
    'unjoined-cleanup',
    (value) => {
      value.stages[0].lifetimeCleanupVerified = false;
    },
  ],
])
  test('reject ' + name + ' from passed evidence', () => {
    const value = receipt();
    mutate(value);
    assert.throws(
      () => validate(value, env),
      (error) => error.message === 'Ramp evidence rejected'
    );
  });
test('read500ms/reservation2000ms and5xx strictlybelow0.5percent retain exact boundaries', () => {
  const value = receipt();
  Object.assign(value.stages[0], {
    publicReadP95Ms: 500,
    reservationP95Ms: 2000,
    unexpected5xxFraction: 0.0049,
  });
  assert.doesNotThrow(() => validate(value, env));
});
test('clear/report touches only fixed regular owned file and rejects symlink or malformed data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task609-receipt-'));
  try {
    run('clear', env, root);
    const file = path.join(root, 'runtime/task609-http-ramp.json');
    const other = path.join(root, 'runtime/other.json');
    fs.writeFileSync(other, 'private-canary');
    assert.throws(() => run('report', env, root));
    fs.writeFileSync(file, JSON.stringify(receipt()));
    assert.deepEqual(run('report', env, root), receipt());
    run('clear', env, root);
    assert.equal(fs.readFileSync(other, 'utf8'), 'private-canary');
    fs.symlinkSync(other, file);
    assert.throws(() => run('clear', env, root));
    fs.unlinkSync(file);
    fs.writeFileSync(file, 'private-canary');
    assert.throws(() => run('report', env, root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('current managed workflow collects pure tests and binds fresh report to current source and run', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../.github/workflows/market-readiness-local.yml'),
    'utf8'
  );
  assert.ok(
    workflow.indexOf('http-ramp-receipt.cjs clear') <
      workflow.indexOf('name: Run market readiness gates')
  );
  assert.ok(
    workflow.indexOf('http-ramp-receipt.cjs report') >
      workflow.indexOf('run: npm run verify:market')
  );
  assert.match(workflow, /http-ramp-receipt.test.cjs/);
  assert.match(
    workflow,
    /TIXMO_RAMP_SOURCE_SHA: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/
  );
  const source = fs.readFileSync(
    path.join(__dirname, '../tixmoapi2/tests/integration/orders-http-ramp.test.ts'),
    'utf8'
  );
  assert.match(source, /jest.resetModules\(\)/);
  assert.match(source, /\/api\/v1\/events\/public\//);
  assert.match(source, /expect\(metrics.publicReadP95Ms\).toBeLessThanOrEqual\(500\)/);
  assert.match(source, /expect\(metrics.reservationP95Ms\).toBeLessThanOrEqual\(2000\)/);
  assert.match(source, /expect\(metrics.unexpected5xxFraction\).toBeLessThan\(0.005\)/);
});
