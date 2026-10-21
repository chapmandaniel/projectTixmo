import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createEvidenceStore, verifyEvidence } from '../../../../scripts/market-evidence-store.mjs';
const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'task432-publication-'));
fs.chmodSync(parent, 0o700);
const manifest = { receipts: [] };
const methods = ['linkSync', 'unlinkSync', 'chmodSync', 'fsyncSync'];
const originals = Object.fromEntries(methods.map(key => [key, fs[key]]));
try {
  for (const fault of ['none', 'before-link', 'unlinkSync', 'chmodSync', 'fsyncSync']) {
    let published = false;
    const persist = createEvidenceStore({ directory: parent, runId: fault });
    const fail = () => { const error = Error('Injected EIO'); error.code = 'EIO'; throw error; };
    fs.linkSync = (...args) => { if (fault === 'before-link') fail(); const result = originals.linkSync(...args); published = true; return result; };
    for (const method of ['unlinkSync', 'chmodSync', 'fsyncSync']) fs[method] = (...args) => { if (published && fault === method) fail(); return originals[method](...args); };
    try {
      if (fault === 'before-link') {
        await assert.rejects(persist(manifest), /EIO/);
        assert.throws(() => verifyEvidence(path.join(parent, fault)), /ENOENT/);
      } else {
        const result = await persist(manifest);
        assert.equal(result.committed, true);
        assert.equal(result.durabilityConfirmed, fault !== 'fsyncSync');
        assert.equal(result.warnings.length, fault === 'none' ? 0 : fault === 'fsyncSync' ? 2 : 1);
        assert.equal(verifyEvidence(result.directory).runId, fault);
        await assert.rejects(persist(manifest), /EEXIST/);
      }
    } finally { for (const key of methods) fs[key] = originals[key]; }
  }
  console.log('PASS offline publication commit-point: pre-link rejection unsealed; post-link unlink/chmod/fsync faults committed with warnings, durability explicit, readable and no-clobber');
} finally {
  for (const key of methods) fs[key] = originals[key];
  for (const entry of fs.readdirSync(parent)) fs.chmodSync(path.join(parent, entry), 0o700);
  fs.rmSync(parent, { recursive: true });
}
