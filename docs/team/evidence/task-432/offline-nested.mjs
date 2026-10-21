import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyApi } from '../../../../scripts/verify-api.mjs';
import { compose, boundaries } from '../../../../scripts/market-composition.mjs';
import { createApiReceiptTransport, collectApiReceipts } from '../../../../scripts/api-receipt-transport.mjs';
import { createEvidenceStore, verifyEvidence } from '../../../../scripts/market-evidence-store.mjs';
const root = path.resolve(import.meta.dirname, '../../../..');
const parent = '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379';
// Owned disk-only fixture; no runtime runner, service, application or socket.
const directory = fs.mkdtempSync(path.join(parent, 'run.'));
fs.chmodSync(directory, 0o700);
const identity = { source: 'offline-fixture', sourceHash: 'offline-hash' };
const env = { DATABASE_URL: 'postgresql://test@127.0.0.1:23333/tixmo_disposable_nested', REDIS_URL: 'redis://127.0.0.1:24444/1', TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1' };
try {
  const run = (dir, fail = -1) => {
    const record = createApiReceiptTransport({ directory: dir, root, identity });
    let calls = 0;
    const invoke = () => verifyApi({ env, log() {}, record, spawn() { const status = calls++ === fail ? 7 : 0; return { status, stdout: `raw\0${calls}`, stderr: `err${calls}` }; } });
    if (fail < 0) invoke(); else assert.throws(invoke, /failed/);
    return calls;
  };
  assert.equal(run(directory), 4);
  const nested = collectApiReceipts({ directory, root, identity, status: 0 });
  assert.equal(nested.length, 4); assert.equal(nested[0].stdout, 'raw\x001');
  assert.throws(() => collectApiReceipts({ directory, root, identity: { ...identity, source: 'stale' }, status: 0 }), /provenance/);
  assert.throws(() => run(directory), /EEXIST/);
  let captured;
  const storeDir = fs.mkdtempSync(path.join(parent, 'run.')); fs.chmodSync(storeDir, 0o700);
  try {
    const persist = createEvidenceStore({ directory: storeDir, runId: 'nested' });
    const session = kind => ({ contract: structuredClone(boundaries[kind]), run: async () => ({ status: 0, stdout: '', stderr: '' }), close: async () => {} });
    await compose({ capture: () => identity, versions: { node: 'fixture', npm: 'fixture' }, openAudit: async () => session('audit'), openLocal: async () => session('local'), collectNestedApi: data => collectApiReceipts({ directory, root, ...data }), persist: async manifest => { captured = manifest; await persist(manifest); } });
    assert.equal(captured.receipts[4].nestedApi.length, 4);
    assert.equal(verifyEvidence(path.join(storeDir, 'nested')).manifest.receipts[4].nestedApi[0].stdout, 'raw\x001');
    assert.notEqual(captured.qualification, 'PASS');
  } finally { if (fs.existsSync(path.join(storeDir, 'nested'))) fs.chmodSync(path.join(storeDir, 'nested'), 0o700); fs.rmSync(storeDir, { recursive: true, force: true }); }
  for (let fail = 0; fail < 4; fail++) {
    const dir = fs.mkdtempSync(path.join(parent, 'run.')); fs.chmodSync(dir, 0o700);
    try { assert.equal(run(dir, fail), fail + 1); assert.equal(collectApiReceipts({ directory: dir, root, identity, status: 1 }).length, fail + 1); assert.throws(() => collectApiReceipts({ directory: dir, root, identity, status: 0 }), /Missing|did not pass/); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  fs.chmodSync(path.join(directory, 'api-1.json'), 0o600);
  const bad = JSON.parse(fs.readFileSync(path.join(directory, 'api-1.json'))); bad.stdout += 'tamper';
  fs.writeFileSync(path.join(directory, 'api-1.json'), JSON.stringify(bad));
  assert.throws(() => collectApiReceipts({ directory, root, identity, status: 0 }), /hash/);
  console.log('PASS offline nested raw transport, all four failfast positions, provenance, no-clobber, tamper and sealed join; NO runtime');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
