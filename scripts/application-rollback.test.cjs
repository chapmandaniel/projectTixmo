// Offline contracts. Never starts an application, Docker, TCP or SQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  guard,
  parity,
  containerArgs,
  receipt,
  OLD_COMMIT,
} = require('./verify-application-rollback.cjs');
const env = {
  GITHUB_ACTIONS: 'true',
  TIXMO_APPLICATION_ROLLBACK: 'synthetic-only',
  DATABASE_URL:
    'postgresql://tixmo_restore_ci:synthetic_restore_password@127.0.0.1:49152/tixmo_disposable_restore_source?schema=public',
  REDIS_URL: 'redis://127.0.0.1:49153/6',
};
test('only explicit synthetic loopback source admitted', () =>
  assert.doesNotThrow(() => guard(env)));
for (const [name, patch] of [
  ['opt-in', { TIXMO_APPLICATION_ROLLBACK: 'true' }],
  ['CI', { GITHUB_ACTIONS: 'false' }],
  ['remoteSQL', { DATABASE_URL: env.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') }],
  [
    'sourceDB',
    {
      DATABASE_URL: env.DATABASE_URL.replace('tixmo_disposable_restore_source', 'railway'),
    },
  ],
  [
    'credentials',
    {
      DATABASE_URL: env.DATABASE_URL.replace('synthetic_restore_password', 'foreign'),
    },
  ],
  ['extraSQLoptions', { DATABASE_URL: env.DATABASE_URL + '&options=foreign' }],
  ['remoteRedis', { REDIS_URL: env.REDIS_URL.replace('127.0.0.1', 'remote.invalid') }],
  [
    'Rediscredentials',
    {
      REDIS_URL: env.REDIS_URL.replace('redis://', 'redis://foreign:foreign@'),
    },
  ],
  ['RedisDB', { REDIS_URL: env.REDIS_URL.replace('/6', '/0') }],
])
  test('reject ' + name, () => assert.throws(() => guard({ ...env, ...patch })));
test('containers receive only scrubbed synthetic values and explicit worker bypasses jobs/startuphooks', () => {
  for (const phase of ['new', 'old', 'forward', 'cleanup']) {
    const args = containerArgs(
      {
        ...env,
        STRIPE_SECRET_KEY: 'private-canary',
        TIXMO_APPROVED_EMAIL_ONCE: 'true',
      },
      phase,
      '/owned',
      '/repo'
    );
    assert.equal(args[0], 'create');
    assert.ok(args.includes('--network'));
    assert.equal(args.at(-1), '/task606-worker.cjs');
    assert.ok(args.includes('node'));
    assert.ok(args.includes('TIXMO_ROLLBACK_PHASE=' + phase));
    assert.ok(
      args.includes(phase === 'old' ? 'tixmo-task606-old:ci' : 'tixmo-task603-production:ci')
    );
    assert.doesNotMatch(
      args.join(' '),
      /private-canary|STRIPE|APPROVED_EMAIL|env-file|privileged|dist\/index|migrate/
    );
  }
  assert.throws(() => containerArgs(env, 'arbitrary', '/owned', '/repo'));
});
const CANDIDATE = 'a'.repeat(40);
function previousMainGit(overrides = {}) {
  const answers = {
    [`merge-base --is-ancestor ${OLD_COMMIT} origin/main`]: { status: 0, stdout: '' },
    'rev-parse HEAD': { status: 0, stdout: CANDIDATE },
    [`merge-base --is-ancestor ${OLD_COMMIT} HEAD`]: { status: 0, stdout: '' },
    ...overrides,
  };
  return (args) => {
    const answer = answers[args.join(' ')];
    assert.ok(answer, 'unexpected git ' + args.join(' '));
    return answer;
  };
}
function writeApiTree(dir, source) {
  for (const entry of [
    'src/a.js',
    'prisma/schema.prisma',
    'prisma/migrations/one/migration.sql',
    'package.json',
    'package-lock.json',
  ]) {
    const name = path.join(dir, entry);
    fs.mkdirSync(path.dirname(name), { recursive: true });
    fs.writeFileSync(name, source);
  }
}
test('parity accepts a previous main image and rejects a self-pin', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task606-contract-'));
  try {
    const current = path.join(dir, 'new');
    const old = path.join(dir, 'old');
    writeApiTree(current, 'candidate');
    writeApiTree(old, 'previous-main');
    const accepted = parity(current, old, { git: previousMainGit() });
    assert.equal(accepted.mode, 'previous-main-image');
    assert.equal(accepted.rollbackPromotionApproved, false);
    writeApiTree(old, 'candidate');
    assert.equal(parity(current, old, { git: previousMainGit() }).mode, 'previous-main-image');
    assert.throws(() =>
      parity(current, old, {
        git: previousMainGit({
          'rev-parse HEAD': { status: 0, stdout: OLD_COMMIT },
        }),
      })
    );
    assert.throws(() =>
      parity(current, old, {
        git: previousMainGit({
          [`merge-base --is-ancestor ${OLD_COMMIT} origin/main`]: { status: 1, stdout: '' },
        }),
      })
    );
    assert.throws(() =>
      parity(current, old, {
        git: previousMainGit({
          [`merge-base --is-ancestor ${OLD_COMMIT} HEAD`]: { status: 1, stdout: '' },
        }),
      })
    );
    fs.writeFileSync(path.join(old, 'src/a.js'), 'previous-main');
    assert.equal(
      parity(current, old, {
        git: previousMainGit({
          [`merge-base --is-ancestor ${OLD_COMMIT} HEAD`]: { status: 1, stdout: '' },
        }),
      }).mode,
      'previous-main-image'
    );
    fs.writeFileSync(path.join(old, 'src/a.js'), 'candidate');
    fs.unlinkSync(path.join(old, 'prisma/migrations/one/migration.sql'));
    assert.equal(
      parity(current, old, {
        git: previousMainGit({
          [`merge-base --is-ancestor ${OLD_COMMIT} HEAD`]: { status: 1, stdout: '' },
        }),
      }).mode,
      'previous-main-image'
    );
    fs.symlinkSync(
      path.join(current, 'prisma/migrations/one/migration.sql'),
      path.join(old, 'prisma/migrations/one/migration.sql')
    );
    assert.throws(() =>
      parity(current, old, {
        git: previousMainGit({
          [`merge-base --is-ancestor ${OLD_COMMIT} HEAD`]: { status: 1, stdout: '' },
        }),
      })
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('receipt admits only fixed projection and failed worker never passes', () => {
  const log = console.log;
  const seen = [];
  console.log = (value) => seen.push(value);
  try {
    receipt(
      'private-canary\n' +
        JSON.stringify({
          scope: 'task606-mounted-worker',
          mode: 'old',
          phase: 'read-smokes',
          ok: true,
          providerAttempts: 0,
          lifetimeCleanupVerified: true,
          token: 'private-canary',
        }),
      'old'
    );
    assert.doesNotMatch(seen.join(''), /private-canary/);
    assert.throws(() =>
      receipt(
        JSON.stringify({
          scope: 'task606-mounted-worker',
          mode: 'old',
          phase: 'read-smokes',
          ok: false,
          providerAttempts: 0,
          lifetimeCleanupVerified: true,
        }),
        'old'
      )
    );
    assert.throws(() =>
      receipt(
        JSON.stringify({
          scope: 'task606-mounted-worker',
          mode: 'old',
          phase: 'private-canary',
          ok: true,
          providerAttempts: 0,
          lifetimeCleanupVerified: true,
        }),
        'old'
      )
    );
  } finally {
    console.log = log;
  }
});
test('hosted workflow actually builds old image and invokes current worker on configured PG18 Redis8.2.9', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../.github/workflows/market-readiness-local.yml'),
    'utf8'
  );
  assert.ok(workflow.includes('ref: ' + OLD_COMMIT));
  assert.equal(workflow.includes('df0de4bde792e3b695939f90a18c4e3bd2468446'), false);
  const lane = workflow.split('  configured-image-restore:')[1];
  assert.match(lane, /fetch-depth: 0/);
  const fetchAt = lane.indexOf('git fetch --no-tags origin main');
  const parityAt = lane.indexOf("p.parity('tixmoapi2','.rollback-old/tixmoapi2')");
  assert.ok(fetchAt > 0 && parityAt > fetchAt);
  const source = fs.readFileSync(path.join(__dirname, 'verify-application-rollback.cjs'), 'utf8');
  assert.match(source, /previous-main-image/);
  assert.doesNotMatch(source, /byte-identical/);
  assert.match(source, /merge-base', '--is-ancestor', OLD_COMMIT, 'origin\/main'/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /docker build --tag tixmo-task606-old:ci \.rollback-old\/tixmoapi2/);
  assert.match(workflow, /run: node scripts\/verify-application-rollback.cjs/);
  assert.match(workflow, /postgres-ssl:18/);
  assert.match(workflow, /image: redis:8.2.9/);
  const worker = fs.readFileSync(path.join(__dirname, 'application-rollback-worker.cjs'), 'utf8');
  assert.match(worker, /require\(["']\/app\/dist\/app["']\)/);
  assert.doesNotMatch(worker, /dist\/index|startOrderExpiryJob|startPaymentRecoveryJob/);
  assert.match(worker, /assert.deepEqual\(normalized,\s*state.snapshot\)/);
  assert.match(worker, /\/app\/scripts\/migration-census\.cjs/);
  assert.match(worker, /rows\.length, MIGRATION_COUNT/);
  assert.match(worker, /providerAttempts,\s*0/);
  assert.match(worker, /fs.unlinkSync\(stateFile\)/);
  assert.ok(workflow.includes('scripts/application-rollback.test.cjs'));
});
test('bind-mounted driver loads without the host migration census path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task606-driver-'));
  const mounted = path.join(dir, 'task606-driver.cjs');
  fs.copyFileSync(path.join(__dirname, 'verify-application-rollback.cjs'), mounted);
  const driver = require(mounted);
  assert.equal(typeof driver.guard, 'function');
  assert.doesNotThrow(() => driver.guard(env));
});
test('owned subprocess protocol executes new-old-forward-cleanup, and failure never starts successor', async () => {
  const { verify } = require('./verify-application-rollback.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task606-protocol-'));
  for (const api of ['tixmoapi2', '.rollback-old/tixmoapi2'])
    for (const entry of [
      'src/a.js',
      'prisma/schema.prisma',
      'prisma/migrations/one/migration.sql',
      'package.json',
      'package-lock.json',
    ]) {
      const file = path.join(root, api, entry);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'same');
    }
  const log = console.log;
  console.log = () => {};
  const git = previousMainGit();
  try {
    for (const fail of [false, true]) {
      let phase;
      const modes = [],
        removed = [];
      const command = async (program, args) => {
        if (program === 'git') return OLD_COMMIT;
        assert.equal(program, 'docker');
        if (args[0] === 'create') {
          phase = args.find((value) => value.startsWith('TIXMO_ROLLBACK_PHASE=')).split('=')[1];
          modes.push(phase);
          return 'a'.repeat(64);
        }
        if (args[0] === 'start')
          return JSON.stringify({
            scope: 'task606-mounted-worker',
            mode: phase,
            phase: 'read-smokes',
            ok: !(fail && phase === 'old'),
            providerAttempts: 0,
            lifetimeCleanupVerified: true,
          });
        assert.equal(args[0], 'rm');
        removed.push(args);
        return '';
      };
      const work = verify(env, { root, command, git });
      if (fail) {
        await assert.rejects(work);
        assert.deepEqual(modes, ['new', 'old']);
        assert.ok(removed.at(-1).includes('--force'));
      } else {
        await work;
        assert.deepEqual(modes, ['new', 'old', 'forward', 'cleanup']);
        assert.equal(removed.length, 4);
      }
    }
  } finally {
    console.log = log;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
