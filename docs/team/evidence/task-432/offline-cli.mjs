import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runVerifyApiCli } from '../../../../scripts/verify-api-cli.mjs';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { collectApiReceipts } from '../../../../scripts/api-receipt-transport.mjs';
const root = path.resolve(import.meta.dirname, '../../../..');
const parent = '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379';
const identity = { source: 'offline-fixture', sourceHash: 'offline-fixture' };
const directories = [];
const fresh = () => {
  const directory = fs.mkdtempSync(path.join(parent, 'run.')); directories.push(directory);
  fs.chmodSync(directory, 0o700);
  fs.writeFileSync(path.join(directory, 'api-identity.json'), JSON.stringify(identity), { mode: 0o400 });
  return directory;
};
const environment = directory => ({ TASK432_API_RECEIPTS: directory, TASK379_ARTIFACT_DIR: directory,
  TASK379_RUN_ID: 'a'.repeat(64), npm_config_offline: 'true', npm_config_yes: 'false',
  DATABASE_URL: 'postgresql://test@127.0.0.1:23333/tixmo_disposable_cli',
  REDIS_URL: 'redis://127.0.0.1:24444/1', TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1' });
try {
  for (let fail = -1; fail < 4; fail++) {
    const directory = fresh(); let calls = 0;
    const invoke = () => runVerifyApiCli({ env: environment(directory), cwd: root, guarded: () => true,
      capture: () => identity, verify: options => verifyApi({ ...options, log() {}, spawn() {
        const status = calls++ === fail ? 7 : 0; return { status, stdout: 'raw\0cli', stderr: '' };
      } }) });
    if (fail < 0) invoke(); else assert.throws(invoke, /failed/);
    assert.equal(calls, fail < 0 ? 4 : fail + 1);
    const receipts = collectApiReceipts({ directory, root, identity, status: fail < 0 ? 0 : 1 });
    assert.equal(receipts.length, calls); assert.equal(receipts[0].stdout, 'raw\0cli');
  }
  const directory = fresh(); const env = environment(directory); let calls = 0;
  const options = { env, cwd: root, capture: () => identity, guarded: () => true, verify() { calls++; } };
  for (const override of [{ cwd: '/tmp' }, { guarded: () => false }, { capture: () => ({ ...identity, source: 'drift' }) },
    { env: { ...env, npm_config_offline: 'false' } }, { env: { ...env, TASK379_RUN_ID: '' } },
    { env: { ...env, TASK379_ARTIFACT_DIR: '/tmp' } }, { env: { ...env, TASK432_API_RECEIPTS: '' } }]) {
    assert.throws(() => runVerifyApiCli({ ...options, ...override }));
  }
  assert.equal(calls, 0);
  // Real executable entrypoint, rejected before verification target validation or spawn.
  const child = spawnSync(process.execPath, ['scripts/verify-api.mjs'], { cwd: root,
    env: { PATH: process.env.PATH, TASK432_API_RECEIPTS: directory }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert.match(child.stderr, /Missing pre-import task427 guard/);
  assert.equal(fs.readdirSync(directory).filter(file => /^api-\d/.test(file)).length, 0);
  let defaultOptions;
  runVerifyApiCli({ env: {}, verify: options => { defaultOptions = options; } });
  assert.deepEqual(defaultOptions, { env: {} });
  let captures = 0; let attempted = 0;
  assert.throws(() => runVerifyApiCli({ ...options, capture: () => ++captures === 1 ? identity : { ...identity, source: 'drift' },
    verify: options => verifyApi({ ...options, log() {}, spawn() { attempted++; return { status: 0, stdout: '', stderr: '' }; } }) }), /identity changed/);
  assert.equal(attempted, 1); // No migration/schema/test after first recorded source drift.
  console.log('PASS CLI adapter raw receipt/four failfast positions/seven preflight denials/default parity/real CLI guard denial/source drift; NO runtime');
} finally { for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true }); }
