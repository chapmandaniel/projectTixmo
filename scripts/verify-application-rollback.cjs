'use strict';
// Hosted-only, synthetic source. No target/environment credentials are inherited.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const OLD_COMMIT = 'f7fbb1a4c43af495639740c2d8e2f6d77db19911';
const IMAGES = {
  new: 'tixmo-task603-production:ci',
  old: 'tixmo-task606-old:ci',
  forward: 'tixmo-task603-production:ci',
  cleanup: 'tixmo-task603-production:ci',
};
function guard(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.TIXMO_APPLICATION_ROLLBACK, 'synthetic-only');
  const db = new URL(env.DATABASE_URL);
  assert.equal(db.protocol, 'postgresql:');
  assert.equal(db.hostname, '127.0.0.1');
  assert.ok(Number(db.port) >= 1024 && Number(db.port) <= 65535);
  assert.equal(db.username, 'tixmo_restore_ci');
  assert.equal(db.password, 'synthetic_restore_password');
  assert.equal(db.pathname, '/tixmo_disposable_restore_source');
  assert.equal(db.search, '?schema=public');
  assert.equal(db.hash, '');
  const redis = new URL(env.REDIS_URL);
  assert.equal(redis.protocol, 'redis:');
  assert.equal(redis.hostname, '127.0.0.1');
  assert.ok(Number(redis.port) >= 1024 && Number(redis.port) <= 65535);
  assert.equal(redis.username, '');
  assert.equal(redis.password, '');
  assert.equal(redis.pathname, '/6');
  assert.equal(redis.search, '');
  assert.equal(redis.hash, '');
}
function inventory(base, prefix) {
  const result = [];
  function visit(relative) {
    const absolute = path.join(base, relative),
      stat = fs.lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false);
    if (stat.isDirectory())
      for (const entry of fs.readdirSync(absolute).sort()) visit(path.join(relative, entry));
    else {
      assert.ok(stat.isFile());
      result.push([relative, fs.readFileSync(absolute).toString('base64')]);
    }
  }
  visit(prefix);
  return result;
}
function applicationChanges(current, old) {
  const collect = (base) =>
    new Map(
      ['src', 'package.json', 'package-lock.json'].flatMap((name) =>
        inventory(base, name)
      )
    );
  const before = collect(old),
    after = collect(current);
  const hash = (value) =>
    value === undefined
      ? null
      : createHash('sha256').update(Buffer.from(value, 'base64')).digest('hex');
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .filter((name) => before.get(name) !== after.get(name))
    .map((name) => ({
      path: name,
      oldSha256: hash(before.get(name)),
      newSha256: hash(after.get(name)),
    }));
}
function parity(current, old, approvedTransition) {
  // Database contracts never receive an exception.
  for (const name of ['prisma/schema.prisma', 'prisma/migrations'])
    assert.deepEqual(inventory(current, name), inventory(old, name));
  const changes = applicationChanges(current, old);
  if (!changes.length)
    return { mode: 'byte-identical', rollbackPromotionApproved: false };
  let transition = approvedTransition;
  if (!transition) {
    const file = path.join(__dirname, 'rollback-zod-transition.json');
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 65536);
    transition = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  assert.deepEqual(Object.keys(transition).sort(), [
    'changes',
    'id',
    'newZod',
    'oldCommit',
    'oldZod',
    'schemaVersion',
  ]);
  assert.equal(transition.schemaVersion, 1);
  assert.equal(transition.id, 'task619-zod4-validation');
  assert.equal(transition.oldCommit, OLD_COMMIT);
  assert.equal(transition.oldZod, '3.25.76');
  assert.equal(transition.newZod, '4.6.7');
  for (const [base, version] of [
    [old, transition.oldZod],
    [current, transition.newZod],
  ]) {
    const lock = JSON.parse(
      fs.readFileSync(path.join(base, 'package-lock.json'), 'utf8')
    );
    assert.equal(lock.packages['node_modules/zod'].version, version);
  }
  assert.ok(
    Array.isArray(transition.changes) &&
      transition.changes.length > 0 &&
      transition.changes.length <= 64
  );
  for (const entry of transition.changes) {
    assert.deepEqual(Object.keys(entry).sort(), ['newSha256', 'oldSha256', 'path']);
    assert.ok(
      typeof entry.path === 'string' &&
        /^(?:src\/[A-Za-z0-9_.\/-]+\.ts|package(?:-lock)?\.json)$/.test(entry.path)
    );
    assert.ok(!entry.path.split('/').some((part) => part === '.' || part === '..'));
    for (const value of [entry.oldSha256, entry.newSha256])
      assert.ok(
        value === null || (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
      );
    assert.notEqual(entry.oldSha256, entry.newSha256);
  }
  assert.ok(transition.changes.some((entry) => entry.path === 'package.json'));
  assert.ok(transition.changes.some((entry) => entry.path === 'package-lock.json'));
  // The complete sorted difference must match reviewed old AND new bytes.
  // No version range, source subtree or arbitrary future change is admitted.
  assert.deepEqual(changes, transition.changes);
  return { mode: 'reviewed-zod4-transition', rollbackPromotionApproved: false };
}

async function command(program, args, timeout = 100000, allowWorkerFailure = false) {
  const child = spawn(program, args, {
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let output = '',
    size = 0;
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  };
  const timer = setTimeout(stop, timeout);
  child.stdout.on('data', (chunk) => {
    size += chunk.length;
    if (size > 1048576) stop();
    else output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    size += chunk.length;
    if (size > 1048576) stop();
  });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if ((result.code !== 0 && !allowWorkerFailure) || result.signal || size > 1048576)
      throw Error('Owned command failed');
    return output.trim();
  } finally {
    clearTimeout(timer);
  }
}
function containerArgs(env, mode, directory, root) {
  guard(env);
  assert.ok(Object.hasOwn(IMAGES, mode));
  return [
    'create',
    '--network',
    'host',
    '--user',
    process.getuid() + ':' + process.getgid(),
    '--mount',
    `type=bind,src=${directory},dst=/task606-state`,
    '--mount',
    `type=bind,src=${path.join(root, 'scripts/application-rollback-worker.cjs')},dst=/task606-worker.cjs,readonly`,
    '--mount',
    `type=bind,src=${path.join(root, 'scripts/verify-application-rollback.cjs')},dst=/task606-driver.cjs,readonly`,
    ...Object.entries({
      NODE_ENV: 'test',
      GITHUB_ACTIONS: 'true',
      TIXMO_APPLICATION_ROLLBACK: 'synthetic-only',
      TIXMO_ROLLBACK_PHASE: mode,
      DATABASE_URL: env.DATABASE_URL,
      REDIS_URL: env.REDIS_URL,
      REDIS_DB: '6',
      JWT_SECRET: 'synthetic-task606-access-signing-key',
      JWT_REFRESH_SECRET: 'synthetic-task606-refresh-signing-key',
      CLIENT_URL: 'http://127.0.0.1:39066',
      ASSET_SHARE_ENCRYPTION_KEY: '6'.repeat(64),
    }).flatMap(([key, value]) => ['--env', key + '=' + value]),
    '--entrypoint',
    'node',
    IMAGES[mode],
    '/task606-worker.cjs',
  ];
}
function receipt(output, mode) {
  const records = output
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((row) => row?.scope === 'task606-mounted-worker');
  assert.equal(records.length, 1);
  const row = records[0];
  const phases = [
    'guard',
    'connect',
    'mounted',
    'post-upgrade-write',
    'mounted-write',
    'read-smokes',
    'cleanup',
  ];
  assert.ok(phases.includes(row.phase));
  assert.equal(row.mode, mode);
  // Fixed projection only. Never echo arbitrary child logs/JSON/assertion actuals.
  console.log(
    JSON.stringify({
      scope: 'task606-application-rollback',
      mode,
      phase: row.phase,
      ok: row.ok === true,
      lifetimeCleanupVerified: row.lifetimeCleanupVerified === true,
      providerAttempts: row.providerAttempts === 0 ? 0 : 1,
    })
  );
  assert.equal(row.ok, true);
  assert.equal(row.lifetimeCleanupVerified, true);
  assert.equal(row.providerAttempts, 0);
}
async function verify(env = process.env, dependencies = {}) {
  guard(env);
  const root = dependencies.root || path.resolve(__dirname, '..');
  const contract = parity(path.join(root, 'tixmoapi2'), path.join(root, '.rollback-old/tixmoapi2'));
  const run = dependencies.command || command;
  assert.equal(
    await run('git', ['-C', path.join(root, '.rollback-old'), 'rev-parse', 'HEAD']),
    OLD_COMMIT
  );
  fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'runtime/task606-'));
  fs.chmodSync(directory, 0o700);
  let owned;
  const started = Date.now();
  try {
    for (const mode of ['new', 'old', 'forward', 'cleanup']) {
      owned = await run('docker', containerArgs(env, mode, directory, root));
      assert.match(owned, /^[a-f0-9]{64}$/);
      const id = owned;
      // Capture the failed worker's fixed receipt too; start --attach can exit nonzero.
      const output = await run('docker', ['start', '--attach', id], 100000, true);
      receipt(output, mode);
      await run('docker', ['rm', id]);
      owned = undefined;
    }
    assert.equal(fs.readdirSync(directory).length, 0);
    fs.rmdirSync(directory);
    console.log(
      JSON.stringify({
        scope: 'task606-application-rollback',
        ok: true,
        oldCommit: OLD_COMMIT,
        applicationContract: contract.mode,
        rollbackPromotionApproved: false,
        migrations: 33,
        postUpgradeWriteRetained: true,
        newOldNew: true,
        providerAttempts: 0,
        cleanupVerified: true,
        durationMs: Date.now() - started,
        customerRtoRpoProved: false,
      })
    );
  } finally {
    if (owned && /^[a-f0-9]{64}$/.test(owned)) await run('docker', ['rm', '--force', owned]);
    // Failed/unjoined fixtures remain for authoritative job-owned service teardown.
    if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  }
}
if (require.main === module)
  void verify().catch(() => {
    console.error('Synthetic application rollback qualification failed; child details suppressed.');
    process.exitCode = 1;
  });
module.exports = { guard, parity, applicationChanges, containerArgs, receipt, verify, OLD_COMMIT };
