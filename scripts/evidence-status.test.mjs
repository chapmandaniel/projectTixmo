import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./evidence-status.mjs', import.meta.url));
test('a local informational warning does not veto complete target evidence, while pending/invalid evidence still fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-evidence-status-test-'));
  const write = (name, data) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data));
  };
  const local = [
    'docs/external-smoke-runs/local-external-smoke-2026-06-09.json',
    'docs/public-route-screenshots/public-route-evidence.json',
    'docs/checkout-config-evidence/local-runtime-config-2026-06-09.json',
    'docs/dependency-audit/production-dependency-audit.json',
  ];
  const target = [
    'docs/external-smoke-runs/staging-unit-test.json',
    'docs/checkout-config-evidence/staging-unit-test.json',
    'docs/public-route-screenshots/staging-unit-test/public-route-evidence.json',
    'docs/scanner-field-test-evidence/staging-unit-test.json',
    'docs/backup-rollback-evidence/staging-unit-test.json',
    'docs/external-review-share-evidence/staging-unit-test.json',
    'docs/policy-approval-evidence/staging-unit-test.json',
    'docs/uptime-status-evidence/staging-unit-test.json',
  ];
  const fixture = { result: 'pass', environment: 'staging', capturedAt: '2026-10-05T00:00:00Z', releaseSha: 'f'.repeat(40), owner: 'Unit test fixture', evidence: { summary: 'Synthetic status-parser fixture, not launch evidence.' } };
  const run = () => {
    const result = spawnSync(process.execPath, [script, '--strict', '--json'], { cwd: root, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
  };
  try {
    for (const name of [...local, ...target]) write(name, fixture);
    const ready = run();
    assert.equal(ready.status, 0);
    assert.equal(ready.output.summary.readyForGoNoGo, true);
    assert.deepEqual(ready.output.sections[0].items[2].warnings, ['local non-launch evidence only']);
    write(target[3], { ...fixture, result: 'pending' });
    assert.equal(run().status, 1);
    write(target[3], { ...fixture, owner: '' });
    assert.equal(run().status, 1);
    fs.rmSync(path.join(root, target[3]));
    assert.equal(run().status, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
