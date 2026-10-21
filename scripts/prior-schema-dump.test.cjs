const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { priorDumpRequested, retainPriorDump } = require('./prior-schema-dump.cjs');
const root = path.resolve(__dirname, '..');
const secret = 'NEVER_PRINT_THIS';
const base = { NODE_ENV: 'test', TIXMO_ALLOW_TEST_RESET: 'true',
  TIXMO_TEST_DATABASE_URL: `postgres://user:${secret}@127.0.0.1:5432/tixmo_test_409`,
  TIXMO_UPGRADE_PRIOR_DUMP: '1' };
function directory() { return fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-dump-stub-')); }

test('helper rejects target/options/destination before tools; exclusive archive; sanitized tool failure', () => {
  const dir = directory();
  const env = { ...base, TIXMO_UPGRADE_EVIDENCE_DIR: dir };
  let calls = 0;
  const run = () => { calls++; throw new Error(secret); };
  const args = { env, evidenceDir: dir, beforeSha256: 'a'.repeat(64), persist() {}, run };
  try {
    assert.throws(() => priorDumpRequested({ ...env, TIXMO_UPGRADE_PRIOR_DUMP: 'false' }));
    assert.throws(() => retainPriorDump({ ...args, env: { ...env, TIXMO_TEST_DATABASE_URL: 'postgres://remote/production' } }));
    assert.equal(calls, 0);
    fs.chmodSync(dir, 0o755);
    assert.throws(() => retainPriorDump(args), /checkpoint failed/);
    fs.chmodSync(dir, 0o700);
    fs.symlinkSync('/nonexistent', path.join(dir, 'prior-schema.dump'));
    assert.throws(() => retainPriorDump(args), /checkpoint failed/);
    assert.equal(calls, 0);
    fs.unlinkSync(path.join(dir, 'prior-schema.dump'));
    fs.writeFileSync(path.join(dir, 'prior-schema.dump'), 'existing');
    assert.throws(() => retainPriorDump(args), /checkpoint failed/);
    assert.equal(fs.readFileSync(path.join(dir, 'prior-schema.dump'), 'utf8'), 'existing');
    fs.unlinkSync(path.join(dir, 'prior-schema.dump'));
    assert.throws(() => retainPriorDump(args), error => !error.message.includes(secret));
    assert.equal(calls, 1);
  } finally {
    for (const name of fs.readdirSync(dir)) { const item = path.join(dir, name); if (fs.lstatSync(item).isDirectory()) fs.chmodSync(item, 0o700); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function harness({ failDump = false, malformed = false, rejected = false, enabled = true } = {}) {
  const dir = directory();
  const events = [];
  let output = '';
  let deploys = 0;
  const env = { ...base, TIXMO_UPGRADE_EVIDENCE_DIR: dir };
  if (!enabled) delete env.TIXMO_UPGRADE_PRIOR_DUMP;
  if (malformed) env.TIXMO_UPGRADE_PRIOR_DUMP = 'yes';
  if (rejected) env.TIXMO_TEST_DATABASE_URL = 'postgres://remote/production';
  const run = (tool, args, options) => {
    if (tool === 'git') return { status: 0, stdout: 'a'.repeat(40) };
    if (tool === 'pg_dump') {
      events.push(args[0] === '--version' ? 'version' : 'dump');
      assert.equal(args.some(x => x.includes(secret)), false);
      assert.equal(options.env.PGPASSWORD, secret);
      if (args[0] === '--version') return { status: 0, stdout: 'pg_dump (PostgreSQL) 17.6\n' };
      fs.writeSync(options.stdio[1], Buffer.from('PGDMPstub-not-real-archive'));
      return { status: failDump ? 1 : 0, stderr: secret };
    }
    if (args.includes('deploy')) { events.push(++deploys === 1 ? 'prefix' : 'upgrade'); }
    else events.push('fixture');
    return { status: 0 };
  };
  class PrismaClient {
    async $queryRaw() { return [{ count: 0 }]; }
    async $queryRawUnsafe(sql) {
      if (sql === 'SHOW server_version_num') { events.push('before-snapshot'); return [{ server_version_num: '170006' }]; }
      if (deploys > 1) throw new Error('mock stop after upgrade');
      return [];
    }
    async $disconnect() {}
  }
  const apiRequire = () => ({ PrismaClient });
  apiRequire.resolve = () => 'mock-prisma';
  const sandbox = { __dirname, __filename: path.join(__dirname, 'verify-payment-upgrade.cjs'),
    Buffer, URL, console, process: { env, execPath: 'mock-node', getuid: () => process.getuid(),
      stdout: { write: s => { output += s; } }, stderr: { write: s => { output += s; } } },
    require: name => {
      if (name === 'node:module') return { createRequire: () => apiRequire };
      if (name === 'node:child_process') return { spawnSync: run };
      if (name === './test-target.cjs') return { assertDisposableTestTarget: () => require('./test-target.cjs').assertDisposableTestTarget(env) };
      if (name === './prior-schema-dump.cjs') return { priorDumpRequested: () => priorDumpRequested(env),
        retainPriorDump: args => retainPriorDump({ ...args, env, run }) };
      if (name.startsWith('.')) return require(path.join(__dirname, name));
      return require(name);
    } };
  try {
    await vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'verify-payment-upgrade.cjs'), 'utf8'), sandbox);
    assert.equal(output.includes(secret), false);
    const child = fs.readdirSync(dir)[0];
    const receipt = child && fs.existsSync(path.join(dir, child, 'prior-dump.json')) ? JSON.parse(fs.readFileSync(path.join(dir, child, 'prior-dump.json'))) : null;
    if (receipt) {
      assert.match(receipt.archiveSha256, /^[a-f0-9]{64}$/);
      assert.match(receipt.beforeSha256, /^[a-f0-9]{64}$/);
      assert.equal(receipt.serverVersion, '170006');
      assert.equal(receipt.toolVersion, '17.6');
      assert.ok(receipt.startedAt && receipt.endedAt);
    }
    return { events, receipt };
  } finally {
    for (const name of fs.readdirSync(dir)) { const item = path.join(dir, name); if (fs.lstatSync(item).isDirectory()) fs.chmodSync(item, 0o700); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('harness snapshot -> dump -> upgrade; retained mock receipt is not restore proof', async () => {
  const { events, receipt } = await harness();
  assert.deepEqual(events, ['prefix', 'fixture', 'before-snapshot', 'version', 'dump', 'upgrade']);
  assert.equal(receipt.success, true);
});
test('dump tool failure prevents remaining migrations and retains failed receipt', async () => {
  const { events, receipt } = await harness({ failDump: true });
  assert.equal(events.includes('upgrade'), false);
  assert.equal(receipt.success, false);
  assert.equal(receipt.exitStatus, 1);
});
test('malformed option and rejected target never dump or migrate; default never dumps', async () => {
  assert.deepEqual((await harness({ malformed: true })).events, []);
  assert.deepEqual((await harness({ rejected: true })).events, []);
  assert.deepEqual((await harness({ enabled: false })).events, ['prefix', 'fixture', 'upgrade']);
});
