const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { priorDumpRequested, retainPriorDump } = require('../../../../scripts/prior-schema-dump.cjs');
test('explicit malformed options fail closed; absent stays disabled', () => {
  assert.equal(priorDumpRequested({}), false);
  for (const value of ['', '0', 'false', 'true', '01', ' 1', '1 ', '2']) {
    assert.throws(() => priorDumpRequested({ TIXMO_UPGRADE_PRIOR_DUMP: value, TIXMO_UPGRADE_EVIDENCE_DIR: '/unused' }));
  }
  assert.throws(() => priorDumpRequested({ TIXMO_UPGRADE_PRIOR_DUMP: '1' }));
});
test('bad archive/timeout/signal rejected; exact receipt hash and minimal env', () => {
  for (const mode of ['truncated', 'timeout', 'signal', 'success']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa410-stub-'));
    const env = { NODE_ENV: 'test', TIXMO_ALLOW_TEST_RESET: 'true',
      TIXMO_TEST_DATABASE_URL: 'postgres://stub:synthetic_password@127.0.0.1:5432/tixmo_test_410',
      TIXMO_UPGRADE_PRIOR_DUMP: '1', TIXMO_UPGRADE_EVIDENCE_DIR: dir,
      AWS_SECRET_ACCESS_KEY: 'must-not-inherit', PGOPTIONS: 'must-not-inherit', PATH: '/stub-only' };
    let receipt, calls = 0;
    const run = (tool, args, options) => {
      calls++;
      assert.equal(tool, 'pg_dump');
      assert.equal(options.env.AWS_SECRET_ACCESS_KEY, undefined);
      assert.equal(options.env.PGOPTIONS, undefined);
      assert.equal(args.join(' ').includes('synthetic_password'), false);
      if (args[0] === '--version') return { status: 0, stdout: 'pg_dump (PostgreSQL) 17.6\nINJECTED_PRIVATE_OUTPUT' };
      fs.writeSync(options.stdio[1], mode === 'truncated' ? 'PGDM' : 'PGDMPsynthetic-not-a-backup');
      return { status: mode === 'timeout' ? null : 0, error: mode === 'timeout' ? Error('private tool error') : undefined,
        signal: mode === 'signal' ? 'SIGTERM' : null, stderr: 'private tool output' };
    };
    try {
      const invoke = () => retainPriorDump({ env, evidenceDir: dir, beforeSha256: 'b'.repeat(64),
        serverVersion: '170006', run, persist: (name, value) => { assert.equal(name, 'prior-dump.json'); receipt = value; } });
      if (mode === 'success') invoke();
      else assert.throws(invoke, error => error.message === 'Prior-schema dump checkpoint failed; upgrade was not started.');
      assert.equal(calls, 2);
      assert.equal(receipt.success, mode === 'success');
      assert.equal(receipt.beforeSha256, 'b'.repeat(64));
      const archive = path.join(dir, 'prior-schema.dump');
      assert.equal(receipt.archiveSha256, createHash('sha256').update(fs.readFileSync(archive)).digest('hex'));
      assert.equal(fs.statSync(archive).mode & 0o777, 0o400);
      assert.equal(JSON.stringify(receipt).includes('PRIVATE_OUTPUT'), false);
      assert.equal(JSON.stringify(receipt).includes('synthetic_password'), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
