import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { compose } from '../../../../scripts/market-composition.mjs';
import { createEvidenceStore, verifyEvidence } from '../../../../scripts/market-evidence-store.mjs';
const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'task432-caller-'));
fs.chmodSync(parent, 0o700);
const keys = ['linkSync', 'unlinkSync', 'chmodSync', 'fsyncSync'];
const originals = Object.fromEntries(keys.map(key => [key, fs[key]]));
const restore = () => { for (const key of keys) fs[key] = originals[key]; };
const input = persist => ({
  capture: () => ({ source: 'offline-fixture' }), versions: { node: 'stub', npm: 'stub' }, persist,
  openAudit: open, openLocal: open,
});
let stageFailed = false, closeFailed = false;
async function open(contract) { return { contract, run: async () => ({ status: stageFailed ? 1 : 0, stdout: 'raw\0output', stderr: '' }), close: async () => { if (closeFailed) throw Error('close failure'); } }; }
try {
  for (const fault of ['none', 'before-link', 'unlinkSync', 'chmodSync', 'fsyncSync', 'failed-stage', 'failed-cleanup']) {
    stageFailed = fault === 'failed-stage'; closeFailed = fault === 'failed-cleanup';
    let published = false;
    const persist = createEvidenceStore({ directory: parent, runId: fault });
    const fail = () => { const error = Error('Injected EIO'); error.code = 'EIO'; throw error; };
    fs.linkSync = (...args) => { if (fault === 'before-link') fail(); const result = originals.linkSync(...args); published = true; return result; };
    for (const key of ['unlinkSync', 'chmodSync', 'fsyncSync']) fs[key] = (...args) => { if (published && fault === key) fail(); return originals[key](...args); };
    try {
      let result, error;
      try { result = await compose(input(persist)); } catch (caught) { error = caught; result = error.evidence; }
      assert(result);
      assert.notEqual(result.qualification, 'PASS');
      if (fault === 'before-link') {
        assert.match(error.message, /EIO/);
        assert.equal(result.evidenceCompletion, 'CALLBACK_FAILED_PUBLICATION_UNKNOWN');
        assert.equal(result.qualification, 'INCOMPLETE');
        assert.throws(() => verifyEvidence(path.join(parent, fault)), /ENOENT/);
      } else {
        assert.equal(Boolean(error), stageFailed || closeFailed);
        assert.equal(result.persistence.committed, true);
        assert.equal(result.persistence.durabilityConfirmed, fault !== 'fsyncSync');
        assert.equal(result.persistence.warnings.length, ['unlinkSync', 'chmodSync'].includes(fault) ? 1 : fault === 'fsyncSync' ? 2 : 0);
        assert.equal(result.evidenceCompletion, fault === 'fsyncSync' ? 'COMMITTED_DURABILITY_UNCONFIRMED' : 'COMMITTED_DURABILITY_CONFIRMED');
        if (fault === 'fsyncSync' || error) assert.equal(result.qualification, 'INCOMPLETE');
        const sealed = verifyEvidence(result.persistence.directory);
        assert.equal(sealed.manifest.persistence, undefined); // no recursive seal rewrite
        assert.equal(sealed.manifest.receipts.length, stageFailed ? 1 : closeFailed ? 2 : 12);
        if (fault === 'unlinkSync') assert.equal(result.persistence.warnings[0].operation, 'remove-pending-seal');
        if (fault === 'chmodSync') assert.equal(result.persistence.warnings[0].operation, 'read-only-directory');
      }
    } finally { restore(); }
  }
  stageFailed = false; closeFailed = false;
  const missing = await compose(input(async () => undefined));
  assert.equal(missing.persistence, null);
  assert.equal(missing.evidenceCompletion, 'PUBLICATION_UNCONFIRMED');
  assert.equal(missing.qualification, 'INCOMPLETE');
  const denied = await compose(input(async () => ({ committed: false, durabilityConfirmed: false, warnings: [] })));
  assert.equal(denied.qualification, 'INCOMPLETE');
  console.log('PASS offline caller: retained committed warnings/durability; incomplete unconfirmed persistence; stage/cleanup rejects expose outcome; prepublication error and sealed bytes preserved');
} finally {
  restore();
  for (const entry of fs.readdirSync(parent)) fs.chmodSync(path.join(parent, entry), 0o700);
  fs.rmSync(parent, { recursive: true });
}
