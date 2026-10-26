// Offline contracts. Never starts an application, Docker, TCP or SQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
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
test('parity checks every byte and refuses symlinks or missing migrations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task606-contract-'));
  try {
    for (const root of ['a', 'b']) {
      for (const entry of [
        'src/a.js',
        'prisma/schema.prisma',
        'prisma/migrations/one/migration.sql',
        'package.json',
        'package-lock.json',
      ]) {
        const name = path.join(dir, root, entry);
        fs.mkdirSync(path.dirname(name), { recursive: true });
        fs.writeFileSync(name, 'same');
      }
    }
    const a = path.join(dir, 'a'),
      b = path.join(dir, 'b');
    parity(a, b);
    fs.writeFileSync(path.join(b, 'src/a.js'), 'different');
    assert.throws(() => parity(a, b));
    fs.writeFileSync(path.join(b, 'src/a.js'), 'same');
    fs.unlinkSync(path.join(b, 'prisma/migrations/one/migration.sql'));
    assert.throws(() => parity(a, b));
    fs.symlinkSync(
      path.join(a, 'prisma/migrations/one/migration.sql'),
      path.join(b, 'prisma/migrations/one/migration.sql')
    );
    assert.throws(() => parity(a, b));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('secure rollback parity rejects legacy transition overrides and all byte differences', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task619-contract-'));
  const current = path.join(dir, 'new'),
    old = path.join(dir, 'old');
  const before = {
    'src/a.ts': 'export const legacy = true;',
    'package.json': JSON.stringify({ dependencies: { zod: '^3.22.4' } }),
    'package-lock.json': JSON.stringify({
      packages: { 'node_modules/zod': { version: '3.25.76' } },
    }),
  };
  const after = {
    'src/a.ts': 'export const patched = true;',
    'src/compat.ts': 'export const compatible = true;',
    'package.json': JSON.stringify({ dependencies: { zod: '4.6.7' } }),
    'package-lock.json': JSON.stringify({
      packages: { 'node_modules/zod': { version: '4.6.7' } },
    }),
  };
  const write = (base, name, value) => {
    const file = path.join(base, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  const digest = (value) =>
    value === undefined ? null : createHash('sha256').update(value).digest('hex');
  const manifest = {
    schemaVersion: 1,
    id: 'task619-zod4-validation',
    oldCommit: OLD_COMMIT,
    oldZod: '3.25.76',
    newZod: '4.6.7',
    changes: Object.keys(after)
      .sort()
      .map((name) => ({
        path: name,
        oldSha256: digest(before[name]),
        newSha256: digest(after[name]),
      })),
  };
  try {
    for (const [base, files] of [
      [old, before],
      [current, after],
    ]) {
      for (const [name, value] of Object.entries(files)) write(base, name, value);
      for (const name of ['prisma/schema.prisma', 'prisma/migrations/one/migration.sql'])
        write(base, name, 'unchanged database contract');
    }
    assert.throws(() => parity(current, old, manifest));
    for (const patch of [
      { id: 'arbitrary-exception' },
      { oldCommit: '0'.repeat(40) },
      { newZod: '3.25.76' },
      { extra: 'not admitted' },
      { changes: manifest.changes.slice(1) },
      { changes: [...manifest.changes].reverse() },
      {
        changes: manifest.changes.map((entry) => ({
          ...entry,
          newSha256: '0'.repeat(64),
        })),
      },
    ])
      assert.throws(() => parity(current, old, { ...manifest, ...patch }));
    for (const [base, name, value, restore] of [
      [current, 'src/a.ts', 'unreviewed new source', after['src/a.ts']],
      [old, 'src/a.ts', 'unreviewed old source', before['src/a.ts']],
      [current, 'prisma/schema.prisma', 'changed schema', 'unchanged database contract'],
      [
        old,
        'prisma/migrations/one/migration.sql',
        'changed DDL',
        'unchanged database contract',
      ],
    ]) {
      write(base, name, value);
      assert.throws(() => parity(current, old, manifest));
      write(base, name, restore);
    }
    write(current, 'src/unlisted.ts', 'unreviewed addition');
    assert.throws(() => parity(current, old, manifest));
    fs.unlinkSync(path.join(current, 'src/unlisted.ts'));
    const downgraded = JSON.stringify({
      packages: { 'node_modules/zod': { version: '4.6.5' } },
    });
    write(current, 'package-lock.json', downgraded);
    const forged = {
      ...manifest,
      changes: manifest.changes.map((entry) =>
        entry.path === 'package-lock.json'
          ? { ...entry, newSha256: digest(downgraded) }
          : entry
      ),
    };
    assert.throws(() => parity(current, old, forged));
    write(current, 'package-lock.json', after['package-lock.json']);
    fs.unlinkSync(path.join(current, 'src/compat.ts'));
    fs.symlinkSync(path.join(current, 'src/a.ts'), path.join(current, 'src/compat.ts'));
    assert.throws(() => parity(current, old, manifest));
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
      const work = verify(env, { root, command });
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
