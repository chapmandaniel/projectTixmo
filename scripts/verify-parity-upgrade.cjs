'use strict';
// Hosted-only populated prior-schema upgrade. No target or shared-source reset.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { guard: imageGuard, PG_IMAGE, REDIS_IMAGE } = require('./verify-image-restore.cjs');
const { assertDisposableTestTarget } = require('./test-target.cjs');
function guard(env) {
  assert.equal(env.TIXMO_POPULATED_PARITY, 'synthetic-only');
  const source = imageGuard({ ...env, TIXMO_IMAGE_RESTORE: 'synthetic-only' });
  const redis = new URL(env.REDIS_URL);
  assert.equal(redis.protocol, 'redis:');
  assert.equal(redis.hostname, '127.0.0.1');
  assert.ok(Number(redis.port) > 1024 && Number(redis.port) <= 65535);
  assert.equal(redis.username, '');
  assert.equal(redis.password, '');
  assert.equal(redis.pathname, '/7');
  assert.equal(redis.search, '');
  assert.equal(redis.hash, '');
  return source;
}
function cleanupStaging(directory, ownership) {
  const same = (stat, expected) =>
    stat.dev === expected.dev && stat.ino === expected.ino && stat.uid === expected.uid;
  const verifyRoot = () => {
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && same(stat, ownership));
    assert.equal(stat.mode & 0o777, 0o700);
    assert.equal(stat.uid, process.getuid());
  };
  verifyRoot();
  const entries = new Map();
  let bytes = 0;
  // Validate the ENTIRE bounded tree before removing any entry.
  const visit = (relative, depth) => {
    assert.ok(depth <= 16 && entries.size < 4096);
    const absolute = path.join(directory, relative);
    const stat = fs.lstatSync(absolute);
    assert.ok(!stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory()));
    assert.equal(stat.dev, ownership.dev);
    assert.equal(stat.uid, ownership.uid);
    entries.set(relative, stat);
    if (stat.isFile()) {
      bytes += stat.size;
      assert.ok(bytes <= 268435456);
    } else
      for (const name of fs.readdirSync(absolute)) {
        assert.ok(name !== '.' && name !== '..' && !name.includes(path.sep));
        visit(path.join(relative, name), depth + 1);
      }
  };
  for (const name of fs.readdirSync(directory)) visit(name, 1);
  verifyRoot();
  const verifyPath = (relative) => {
    verifyRoot();
    let prefix = '';
    const names = relative.split(path.sep);
    for (let index = 0; index < names.length; index++) {
      prefix = path.join(prefix, names[index]);
      const stat = fs.lstatSync(path.join(directory, prefix));
      const original = entries.get(prefix);
      assert.ok(original && !stat.isSymbolicLink() && same(stat, original));
      if (index < names.length - 1) assert.ok(stat.isDirectory());
      else assert.equal(stat.isDirectory(), original.isDirectory());
    }
  };
  // Children are joined by command() before this cleanup can be reached.
  for (const [relative, stat] of [...entries].reverse()) {
    verifyPath(relative);
    const absolute = path.join(directory, relative);
    if (stat.isDirectory()) fs.rmdirSync(absolute);
    else fs.unlinkSync(absolute);
  }
  verifyRoot();
  fs.rmdirSync(directory);
  assert.equal(fs.existsSync(directory), false);
}
async function command(program, args, options) {
  const child = spawn(program, args, {
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
  });
  let out = '',
    bytes = 0,
    failed = false;
  const stop = () => {
    failed = true;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  };
  const timer = setTimeout(stop, options.timeout || 20000);
  child.stdin.on('error', () => {});
  child.stdin.end(options.input || '');
  child.stdout.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > 1048576) stop();
    else out += chunk;
  });
  child.stderr.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > 1048576) stop();
  });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (failed || result.code !== 0 || result.signal) throw Error('Owned subprocess failed');
    return out.trim();
  } finally {
    clearTimeout(timer);
  }
}
async function verify(env = process.env, dependencies = {}) {
  let phase = 'guard',
    owned = false,
    createAttempted = false,
    databaseRemoved = false,
    stageRemoved = false,
    verified = false;
  const started = Date.now();
  let postgresqlVersionNum = 0,
    redisVersion = 'unverified';
  let directory, ownership, database, source, safeEnv;
  const root = dependencies.root || path.resolve(__dirname, '..');
  const run = dependencies.command || command;
  const sql = async (db, input) =>
    run(
      'docker',
      [
        'exec',
        '-i',
        '-e',
        'PGOPTIONS=-c statement_timeout=5000 -c lock_timeout=2000',
        env.PG_CONTAINER,
        'psql',
        '-X',
        '-w',
        '-v',
        'ON_ERROR_STOP=1',
        '-A',
        '-t',
        '-U',
        'tixmo_restore_ci',
        '-d',
        db,
      ],
      { env: safeEnv, input, timeout: 15000 }
    );
  try {
    source = guard(env);
    for (const file of ['.env', 'tixmoapi2/.env', 'tixmoapi2/prisma/.env'])
      assert.equal(fs.existsSync(path.join(root, file)), false);
    safeEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test' };
    phase = 'identity';
    for (const [id, image, port, expectedPort] of [
      [env.PG_CONTAINER, PG_IMAGE, '5432/tcp', source.port],
      [env.REDIS_CONTAINER, REDIS_IMAGE, '6379/tcp', new URL(env.REDIS_URL).port],
    ]) {
      const [value] = JSON.parse(await run('docker', ['inspect', id], { env: safeEnv }));
      assert.equal(value.Id, id);
      assert.equal(value.Config.Image, image);
      assert.equal(value.State.Running, true);
      assert.equal(value.State.Health.Status, 'healthy');
      assert.equal(value.NetworkSettings.Ports[port].length, 1);
      assert.equal(value.NetworkSettings.Ports[port][0].HostIp, '127.0.0.1');
      assert.equal(value.NetworkSettings.Ports[port][0].HostPort, expectedPort);
    }
    const version = Number(
      await sql(source.pathname.slice(1), "SELECT current_setting('server_version_num');")
    );
    assert.ok(Number.isSafeInteger(version) && version >= 180000 && version < 190000);
    postgresqlVersionNum = version;
    const info = await run('docker', ['exec', env.REDIS_CONTAINER, 'redis-cli', 'INFO', 'server'], {
      env: safeEnv,
    });
    assert.match(info, /(?:^|\r?\n)redis_version:8\.2\.9(?:\r?\n|$)/);
    redisVersion = '8.2.9';
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
    directory = fs.mkdtempSync(path.join(root, 'runtime/task607-'));
    fs.chmodSync(directory, 0o700);
    ownership = fs.lstatSync(directory);
    database =
      'tixmo_disposable_upgrade_' + (dependencies.uuid || randomUUID)().replaceAll('-', '');
    assert.match(database, /^tixmo_disposable_upgrade_[a-f0-9]{32}$/);
    const target = new URL(source.href);
    target.pathname = '/' + database;
    const childEnv = {
      ...safeEnv,
      CI: 'true',
      TIXMO_ALLOW_TEST_RESET: 'true',
      DATABASE_URL: target.href,
      TIXMO_TEST_DATABASE_URL: target.href,
      REDIS_URL: env.REDIS_URL,
      REDIS_DB: '7',
      TMPDIR: directory,
    };
    assert.equal(assertDisposableTestTarget(childEnv), target.href);
    phase = 'build';
    await run('npm', ['--prefix', path.join(root, 'tixmoapi2'), 'run', 'build'], {
      env: childEnv,
      timeout: 180000,
    });
    phase = 'create';
    assert.equal(
      await sql(
        source.pathname.slice(1),
        `SELECT count(*) FROM pg_database WHERE datname='${database}';`
      ),
      '0'
    );
    createAttempted = true;
    await sql(source.pathname.slice(1), `CREATE DATABASE "${database}" TEMPLATE template0;`);
    owned = true;
    assert.equal(await sql(database, 'SELECT current_database();'), database);
    assert.equal(
      await sql(
        database,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
      ),
      '0'
    );
    phase = 'populated-upgrade';
    // Exact existing substantive harness; all descendants joined before ledger/drop.
    await run(process.execPath, [path.join(root, 'scripts/verify-payment-upgrade.cjs')], {
      env: childEnv,
      timeout: 180000,
    });
    phase = 'ledger';
    const migrations = fs
      .readdirSync(path.join(root, 'tixmoapi2/prisma/migrations'))
      .filter((name) => /^\d/.test(name))
      .sort();
    assert.equal(migrations.length, 33);
    assert.equal(await sql(database, 'SELECT count(*) FROM _prisma_migrations;'), '33');
    assert.equal(
      await sql(
        database,
        'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
      ),
      '33'
    );
    for (const name of migrations) {
      assert.match(name, /^[a-z0-9_]+$/);
      const hash = createHash('sha256')
        .update(
          fs.readFileSync(path.join(root, 'tixmoapi2/prisma/migrations', name, 'migration.sql'))
        )
        .digest('hex');
      assert.equal(
        await sql(
          database,
          `SELECT count(*) FROM _prisma_migrations WHERE migration_name='${name}' AND checksum='${hash}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;`
        ),
        '1'
      );
    }
    verified = true;
  } catch {
    /* No raw child output, SQL arguments, row identifiers or errors. */
  } finally {
    if (owned) {
      try {
        // No FORCE/termination: refuse cleanup until no child connection remains.
        assert.equal(
          await sql(
            source.pathname.slice(1),
            `SELECT count(*) FROM pg_stat_activity WHERE datname='${database}';`
          ),
          '0'
        );
        await sql(source.pathname.slice(1), `DROP DATABASE "${database}";`);
        databaseRemoved =
          (await sql(
            source.pathname.slice(1),
            `SELECT count(*) FROM pg_database WHERE datname='${database}';`
          )) === '0';
      } catch {
        databaseRemoved = false;
      }
    }
    if (directory) {
      try {
        cleanupStaging(directory, ownership);
        stageRemoved = true;
      } catch {
        /* Preserve changed/unrecognized staging; never traverse symlinks. */
      }
    }
  }
  const result = {
    scope: 'task607-configured-image-populated-upgrade',
    phase,
    ok: verified && databaseRemoved && stageRemoved,
    migrations: verified ? 33 : 0,
    unchangedHarnessPassed: verified,
    databaseCleanupVerified: databaseRemoved,
    stagingCleanupVerified: stageRemoved,
    possibleDatabaseOrphan: createAttempted && !databaseRemoved,
    durationMs: Date.now() - started,
    postgresqlVersionNum,
    redisVersion,
    targetUpgradeProved: false,
  };
  if (!dependencies.silent) console.log(JSON.stringify(result));
  return result;
}
if (require.main === module)
  void verify()
    .then((result) => {
      process.exitCode = result.ok ? 0 : 1;
    })
    .catch(() => {
      console.error('Synthetic parity upgrade failed; child details suppressed.');
      process.exitCode = 1;
    });
module.exports = { guard, verify, cleanupStaging };
