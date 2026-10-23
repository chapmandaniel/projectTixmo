// Dependency-free guards/protocol tests. No SQL/Docker/services are started.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { guard, verify } = require('./verify-parity-upgrade.cjs');
const { assertDisposableTestTarget } = require('./test-target.cjs');
const valid = {
  GITHUB_ACTIONS: 'true',
  TIXMO_POPULATED_PARITY: 'synthetic-only',
  PG_CONTAINER: 'a'.repeat(64),
  REDIS_CONTAINER: 'b'.repeat(64),
  DATABASE_URL:
    'postgresql://tixmo_restore_ci:synthetic_restore_password@127.0.0.1:49152/tixmo_disposable_restore_source?schema=public',
  REDIS_URL: 'redis://127.0.0.1:49153/7',
};
const uuid = '11111111-1111-4111-8111-111111111111';
const database = 'tixmo_disposable_upgrade_' + uuid.replaceAll('-', '');
function fixture(failure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task607-contract-'));
  const migrations = path.join(root, 'tixmoapi2/prisma/migrations');
  fs.mkdirSync(migrations, { recursive: true });
  for (let index = 0; index < 33; index++) {
    const dir = path.join(migrations, '202610' + String(index).padStart(8, '0') + '_synthetic');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'migration.sql'), '-- synthetic ' + index);
  }
  const calls = [];
  let dropped = false;
  const command = async (program, args, options) => {
    calls.push({ program, args, options });
    assert.equal(options.env.STRIPE_SECRET_KEY, undefined);
    assert.equal(options.env.POSTMARK_SERVER_TOKEN, undefined);
    if (program === 'npm') {
      assert.equal(args.at(-1), 'build');
      return '';
    }
    if (program === process.execPath) {
      assert.equal(args.at(-1), path.join(root, 'scripts/verify-payment-upgrade.cjs'));
      assert.equal(assertDisposableTestTarget(options.env), options.env.DATABASE_URL);
      assert.equal(new URL(options.env.DATABASE_URL).pathname, '/' + database);
      assert.equal(options.env.TMPDIR.startsWith(path.join(root, 'runtime/task607-')), true);
      if (failure === 'harness') throw Error('private-child-canary');
      return 'private-child-canary';
    }
    assert.equal(program, 'docker');
    if (args[0] === 'inspect')
      return JSON.stringify([
        {
          Id: args[1],
          Config: {
            Image:
              args[1] === valid.PG_CONTAINER
                ? 'ghcr.io/railwayapp-templates/postgres-ssl:18'
                : 'redis:8.2.9',
          },
          State: { Running: true, Health: { Status: 'healthy' } },
          NetworkSettings: {
            Ports:
              args[1] === valid.PG_CONTAINER
                ? {
                    '5432/tcp': [
                      { HostIp: '127.0.0.1', HostPort: failure === 'port' ? '49154' : '49152' },
                    ],
                  }
                : { '6379/tcp': [{ HostIp: '127.0.0.1', HostPort: '49153' }] },
          },
        },
      ]);
    if (args.includes('redis-cli')) return 'redis_version:8.2.9\r\n';
    const sql = options.input;
    if (sql.includes('server_version_num')) return failure === 'version' ? '140000' : '180006';
    if (sql.includes('CREATE DATABASE')) {
      assert.equal(args.at(-1), 'tixmo_disposable_restore_source');
      if (failure === 'create') throw Error('private-create-canary');
      return 'CREATE DATABASE';
    }
    if (sql.includes('current_database()')) return database;
    if (sql.includes('information_schema.tables')) return '0';
    if (sql.includes('_prisma_migrations'))
      return failure === 'checksum' && sql.includes('checksum=')
        ? '0'
        : sql.includes('checksum=')
          ? '1'
          : '33';
    if (sql.includes('pg_stat_activity')) return failure === 'active' ? '1' : '0';
    if (sql.includes('DROP DATABASE')) {
      assert.equal(args.at(-1), 'tixmo_disposable_restore_source');
      assert.equal(sql, `DROP DATABASE "${database}";`);
      if (failure === 'drop') throw Error('private-drop-canary');
      dropped = true;
      return 'DROP DATABASE';
    }
    if (sql.includes('pg_database')) return dropped ? '0' : failure === 'exists' ? '1' : '0';
    throw Error('Unexpected synthetic command');
  };
  return {
    root,
    calls,
    command,
    uuid: () => uuid,
    silent: true,
    close: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
test('guard admits only synthetic matching-loopback configured service identity', () =>
  assert.equal(guard(valid).hostname, '127.0.0.1'));
for (const [name, patch] of [
  ['opt-in', { TIXMO_POPULATED_PARITY: 'true' }],
  ['CI', { GITHUB_ACTIONS: 'false' }],
  ['container', { PG_CONTAINER: 'foreign' }],
  ['same-container', { REDIS_CONTAINER: valid.PG_CONTAINER }],
  ['remoteSQL', { DATABASE_URL: valid.DATABASE_URL.replace('127.0.0.1', 'remote.invalid') }],
  [
    'sourceDB',
    { DATABASE_URL: valid.DATABASE_URL.replace('tixmo_disposable_restore_source', 'railway') },
  ],
  ['remoteRedis', { REDIS_URL: valid.REDIS_URL.replace('127.0.0.1', 'remote.invalid') }],
  ['RedisDB', { REDIS_URL: valid.REDIS_URL.replace('/7', '/0') }],
])
  test('reject ' + name + ' before commands', async () => {
    const f = fixture();
    try {
      const result = await verify({ ...valid, ...patch }, f);
      assert.equal(result.ok, false);
      assert.equal(result.phase, 'guard');
      assert.equal(f.calls.length, 0);
    } finally {
      f.close();
    }
  });
test('UUID-owned target passes existing global disposable guard without changing it', () => {
  const url = valid.DATABASE_URL.replace('/tixmo_disposable_restore_source', '/' + database);
  assert.equal(
    assertDisposableTestTarget({
      NODE_ENV: 'test',
      TIXMO_ALLOW_TEST_RESET: 'true',
      DATABASE_URL: url,
      TIXMO_TEST_DATABASE_URL: url,
    }),
    url
  );
  assert.throws(() =>
    assertDisposableTestTarget({
      NODE_ENV: 'test',
      TIXMO_ALLOW_TEST_RESET: 'true',
      DATABASE_URL: valid.DATABASE_URL,
      TIXMO_TEST_DATABASE_URL: url,
    })
  );
});
test('joined unchanged harness then33checksums then connection-free owned drop/absence', async () => {
  const f = fixture();
  try {
    const result = await verify({ ...valid, STRIPE_SECRET_KEY: 'private-canary' }, f);
    assert.equal(result.ok, true);
    assert.equal(result.migrations, 33);
    assert.equal(result.databaseCleanupVerified, true);
    assert.equal(result.stagingCleanupVerified, true);
    assert.equal(f.calls.filter((call) => call.options.input?.includes('checksum=')).length, 33);
    const harness = f.calls.findIndex((call) => call.program === process.execPath),
      drop = f.calls.findIndex((call) => call.options.input?.includes('DROP DATABASE'));
    assert.ok(drop > harness);
    assert.ok(f.calls[drop - 1].options.input.includes('pg_stat_activity'));
    assert.doesNotMatch(JSON.stringify(result), /private|11111111|disposable|password|sha256/);
    assert.deepEqual(fs.readdirSync(path.join(f.root, 'runtime')), []);
  } finally {
    f.close();
  }
});
for (const failure of [
  'version',
  'port',
  'exists',
  'create',
  'harness',
  'checksum',
  'active',
  'drop',
])
  test('failure ' + failure + ' cannot claim proof or drop unowned/active database', async () => {
    const f = fixture(failure);
    try {
      const result = await verify(valid, f);
      assert.equal(result.ok, false);
      assert.doesNotMatch(JSON.stringify(result), /private|11111111|password/);
      const dropped = f.calls.some((call) => call.options.input?.includes('DROP DATABASE'));
      assert.equal(dropped, ['harness', 'checksum', 'drop'].includes(failure));
      if (['create', 'active', 'drop'].includes(failure))
        assert.equal(result.possibleDatabaseOrphan, true);
    } finally {
      f.close();
    }
  });
test('configured hosted lane explicitly collects tests and executes new guarded harness', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../.github/workflows/market-readiness-local.yml'),
    'utf8'
  );
  const lane = workflow.split('  configured-image-restore:')[1];
  assert.match(lane, /scripts\/parity-upgrade.test.cjs/);
  assert.match(lane, /TIXMO_POPULATED_PARITY: synthetic-only/);
  assert.match(lane, /run: node scripts\/verify-parity-upgrade.cjs/);
  assert.match(lane, /PG_CONTAINER: \$\{\{ job.services.postgres.id \}\}/);
  assert.match(lane, /REDIS_CONTAINER: \$\{\{ job.services.redis.id \}\}/);
  assert.match(lane, /redis:\/\/127.0.0.1:\$\{\{ job.services.redis.ports\[6379\] \}\}\/7/);
  const source = fs.readFileSync(path.join(__dirname, 'verify-parity-upgrade.cjs'), 'utf8');
  assert.doesNotMatch(source, /DROP SCHEMA|--force|--clean|migrate.*reset|db.*push/);
  assert.match(source, /child.once\('close'/);
});
test('pending upgrade child is joined before any owned database drop', async () => {
  const f = fixture();
  let release;
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const pending = new Promise((resolve, reject) => {
    release = () => reject(Error('private-child-canary'));
  });
  const original = f.command;
  f.command = async (program, args, options) => {
    if (program === process.execPath) {
      entered();
      return pending;
    }
    return original(program, args, options);
  };
  try {
    const work = verify(valid, f);
    await started;
    assert.equal(
      f.calls.some((call) => call.options.input?.includes('DROP DATABASE')),
      false
    );
    release();
    assert.equal((await work).ok, false);
    assert.equal(
      f.calls.some((call) => call.options.input?.includes('DROP DATABASE')),
      true
    );
  } finally {
    f.close();
  }
});
test('tool-created nested staging files are removed only within the original0700 owned root', async () => {
  const f = fixture();
  const original = f.command;
  f.command = async (program, args, options) => {
    if (program === process.execPath) {
      const cache = path.join(options.env.TMPDIR, 'tool-cache', 'nested');
      fs.mkdirSync(cache, { recursive: true });
      fs.writeFileSync(path.join(cache, 'synthetic.cache'), 'synthetic');
    }
    return original(program, args, options);
  };
  try {
    const result = await verify(valid, f);
    assert.equal(result.ok, true);
    assert.equal(result.stagingCleanupVerified, true);
    assert.deepEqual(fs.readdirSync(path.join(f.root, 'runtime')), []);
  } finally {
    f.close();
  }
});
test('foreign symlink anywhere rejects the entire cleanup before removing ordinary files', () => {
  const { cleanupStaging } = require('./verify-parity-upgrade.cjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'task607-staging-'));
  try {
    const owned = path.join(base, 'owned'),
      outside = path.join(base, 'outside');
    fs.mkdirSync(owned, { mode: 0o700 });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'keep'), 'private-canary');
    fs.writeFileSync(path.join(owned, 'ordinary'), 'synthetic');
    fs.symlinkSync(outside, path.join(owned, 'link'));
    assert.throws(() => cleanupStaging(owned, fs.lstatSync(owned)));
    assert.equal(fs.readFileSync(path.join(outside, 'keep'), 'utf8'), 'private-canary');
    assert.equal(fs.existsSync(path.join(owned, 'ordinary')), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
test('changed root inode or symlink root never authorizes replacement cleanup', () => {
  const { cleanupStaging } = require('./verify-parity-upgrade.cjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'task607-staging-'));
  try {
    const owned = path.join(base, 'owned'),
      original = path.join(base, 'original');
    fs.mkdirSync(owned, { mode: 0o700 });
    const identity = fs.lstatSync(owned);
    fs.renameSync(owned, original);
    fs.mkdirSync(owned, { mode: 0o700 });
    fs.writeFileSync(path.join(owned, 'keep'), 'private-canary');
    assert.throws(() => cleanupStaging(owned, identity));
    assert.equal(fs.existsSync(path.join(owned, 'keep')), true);
    fs.rmSync(owned, { recursive: true });
    fs.symlinkSync(original, owned);
    assert.throws(() => cleanupStaging(owned, identity));
    assert.equal(fs.existsSync(original), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
test('wrong ownership and traversal depth bounds fail closed without deleting root', () => {
  const { cleanupStaging } = require('./verify-parity-upgrade.cjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'task607-staging-'));
  try {
    fs.chmodSync(base, 0o700);
    const identity = fs.lstatSync(base);
    assert.throws(() => cleanupStaging(base, { ...identity, uid: identity.uid + 1 }));
    let directory = base;
    for (let i = 0; i < 17; i++) {
      directory = path.join(directory, 'nested');
      fs.mkdirSync(directory);
    }
    assert.throws(() => cleanupStaging(base, identity));
    assert.equal(fs.existsSync(directory), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
