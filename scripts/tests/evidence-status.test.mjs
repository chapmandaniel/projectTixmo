import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const checker = new URL('../evidence-status.mjs', import.meta.url).pathname;
const local = [
  'external-smoke-runs/local-external-smoke-2026-06-09.json',
  'public-route-screenshots/public-route-evidence.json',
  'checkout-config-evidence/local-runtime-config-2026-06-09.json',
  'dependency-audit/production-dependency-audit.json',
];
const target = [
  'external-smoke-runs/staging-test.json',
  'checkout-config-evidence/staging-test.json',
  'public-route-screenshots/staging-test/public-route-evidence.json',
  ...['scanner-field-test', 'backup-rollback', 'external-review-share', 'policy-approval', 'uptime-status']
    .map((gate) => `${gate}-evidence/staging-test.json`),
];
const valid = { result: 'pass', environment: 'staging', capturedAt: '2026-10-19T12:00:00Z',
  releaseSha: 'synthetic-not-deployed', owner: 'Synthetic test', evidence: { summary: 'Fixture only' } };
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-evidence-test-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const write = (file, body) => {
    const dest = path.join(cwd, 'docs', file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, typeof body === 'string' ? body : JSON.stringify(body));
  };
  [...local, ...target].forEach((file) => write(file, valid));
  const run = () => {
    const result = spawnSync(process.execPath, [checker, '--strict', '--json'], { cwd, encoding: 'utf8' });
    assert.equal(result.signal, null);
    return { exit: result.status, ...JSON.parse(result.stdout) };
  };
  return { cwd, write, run };
}

test('all eight valid target/manual artifacts can reach zero gaps; local provenance remains visible', (t) => {
  const { run } = fixture(t);
  const result = run();
  assert.equal(result.exit, 0);
  assert.equal(result.summary.openEvidenceGaps, 0);
  assert.equal(result.summary.readyForGoNoGo, true);
  assert.deepEqual(result.sections[0].items[2].information, ['local non-launch evidence only']);
});

test('local pass never substitutes for any missing target/manual artifact', (t) => {
  const { cwd, run } = fixture(t);
  target.forEach((file) => fs.unlinkSync(path.join(cwd, 'docs', file)));
  const result = run();
  assert.equal(result.exit, 1);
  assert.equal(result.summary.openEvidenceGaps, 8);
  assert.ok(result.blockers.every((item) => item.status === 'missing'));
});

for (const file of target) {
  for (const [label, body] of [['failed', { ...valid, result: 'fail' }],
    ['pending', { ...valid, result: 'pending' }], ['unknown result', { ...valid, result: 'unknown' }],
    ['missing result', { ...valid, result: undefined }], ['malformed', '{invalid']]) {
    test(`${file}: ${label} stays blocking`, (t) => {
      const { write, run } = fixture(t);
      write(file, body);
      const result = run();
      assert.equal(result.exit, 1);
      assert.equal(result.summary.openEvidenceGaps, 1);
      assert.equal(result.summary.readyForGoNoGo, false);
    });
  }
}
for (const field of ['environment', 'capturedAt', 'releaseSha', 'owner', 'evidence.summary']) {
  test(`manual required field ${field} stays enforced`, (t) => {
    const { write, run } = fixture(t);
    const body = structuredClone(valid);
    if (field === 'evidence.summary') delete body.evidence.summary;
    else delete body[field];
    target.slice(3).forEach((file) => write(file, body));
    const result = run();
    assert.equal(result.exit, 1);
    assert.equal(result.summary.openEvidenceGaps, 5);
    assert.ok(result.blockers.every((item) => item.warnings.some((warning) => warning.includes(field))));
  });
}

test('local config validation failure is not suppressed with provenance', (t) => {
  const { write, run } = fixture(t);
  write(local[2], '{bad json');
  const result = run();
  assert.equal(result.exit, 1);
  assert.equal(result.summary.openEvidenceGaps, 1);
  assert.ok(result.blockers[0].warnings.includes('artifact is not valid JSON'));
});
