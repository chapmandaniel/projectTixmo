import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { runGate } from '../task-427/run-gate.mjs';
import { runVerifyApiCli } from '../../../../scripts/verify-api-cli.mjs';
import { collectApiReceipts } from '../../../../scripts/api-receipt-transport.mjs';
const root = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const validator = require('../task-379/runtime-path.cjs');
const original = validator.validate;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'task432-shell-'));
const identity = { source: 'fixture', sourceHash: 'fixture' };
// Fixture substitution ONLY; no genuine runtime path, admission or services.
validator.validate = directory => { assert.equal(path.dirname(directory), temporary); };
let cases = 0;
try {
  for (const fail of [-1, 0, 1, 2, 3, 'throw', 'drift', 'blocked', 'guard']) {
    const directory = fs.mkdtempSync(path.join(temporary, 'case-'));
    fs.writeFileSync(path.join(directory, 'api-identity.json'), JSON.stringify(identity), { mode: 0o400 });
    const env = { TASK432_API_RECEIPTS: directory, TASK379_ARTIFACT_DIR: directory,
      TASK427_BLOCK_LOG: path.join(directory, 'blocked.jsonl'), TASK379_RUN_ID: 'a'.repeat(64),
      npm_config_offline: 'true', npm_config_yes: 'false',
      DATABASE_URL: 'postgresql://test@127.0.0.1:23333/tixmo_disposable_shell',
      REDIS_URL: 'redis://127.0.0.1:24444/1', TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1' };
    if (fail === 'blocked') fs.writeFileSync(env.TASK427_BLOCK_LOG, 'blocked');
    let calls = 0;
    const run = () => runGate({ env, cli: options => runVerifyApiCli({ ...options, cwd: root,
      guarded: () => fail !== 'guard', capture: () => fail === 'drift' && calls ? { ...identity, source: 'changed' } : identity }),
      spawn(command, args, opts) {
        assert.equal(opts.stdio, 'pipe'); assert.equal(opts.shell, false);
        if (calls === 3) assert.deepEqual(args.slice(-2), ['--json', '--outputFile=' + path.join(directory, 'jest-result.json')]);
        const index = calls++;
        if (fail === 'throw') throw Error('injected spawn failure');
        return { status: index === fail ? 9 : 0, stdout: 'raw\0stdout\n', stderr: 'raw\0stderr\n' };
      } });
    if (fail === -1) run(); else assert.throws(run);
    const count = typeof fail === 'number' && fail >= 0 ? fail + 1 : fail === 'guard' ? 0 : ['throw', 'drift'].includes(fail) ? 1 : 4;
    assert.equal(calls, count);
    if (fail === 'drift') {
      assert.throws(() => collectApiReceipts({ directory, root, identity, status: 1 }), /Missing nested/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'api-1.json'))).stdout, 'raw\0stdout\n');
    } else if (fail !== 'guard') {
      const receipts = collectApiReceipts({ directory, root, identity, status: typeof fail === 'number' && fail >= 0 || fail === 'throw' ? 1 : 0 });
      assert.equal(receipts.length, count);
      if (fail !== 'throw') for (let i = 1; i <= count; i++) {
        assert.equal(fs.readFileSync(path.join(directory, i + '-stdout.log'), 'utf8'), receipts[i - 1].stdout);
        assert.equal(fs.readFileSync(path.join(directory, i + '-stderr.log'), 'utf8'), receipts[i - 1].stderr);
      }
    }
    cases++;
  }
  // Real shell stops at grant gate before creating runtime or starting services.
  const denial = spawnSync('bash', ['docs/team/evidence/task-427/runtime.sh'], { cwd: root, env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(denial.status, 2); assert.match(denial.stderr, /fresh explicit PM/); cases++;
  console.log(`PASS ${cases} offline shell/runner cases; fixture validator substitution NOT admission`);
} finally { validator.validate = original; fs.rmSync(temporary, { recursive: true, force: true }); }
