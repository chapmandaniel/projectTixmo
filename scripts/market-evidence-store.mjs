// Offline persistence adapter only: no execution, admission, or qualification grant.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
function privateDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Evidence directory must be private and owned');
  if (fs.realpathSync(directory) !== path.resolve(directory)) throw Error('Evidence directory cannot traverse symlinks');
}
function write(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o400);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function syncDirectory(directory) {
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function createEvidenceStore({ directory, runId }) {
  privateDirectory(directory);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(runId)) throw Error('Invalid evidence run id');
  const target = path.join(directory, runId);
  return async manifest => {
    privateDirectory(directory);
    // mkdir is the exclusive reservation: repeated/concurrent writes fail closed.
    fs.mkdirSync(target, { mode: 0o700 });
    const captured = structuredClone(manifest);
    if (!Array.isArray(captured.receipts)) throw Error('Missing receipts');
    const raw = [];
    for (const [index, receipt] of captured.receipts.entries()) {
      if (receipt.index !== index + 1) throw Error('Noncanonical receipt order');
      for (const stream of ['stdout', 'stderr']) {
        if (typeof receipt[stream] !== 'string' || receipt[stream + 'Hash'] !== hash(receipt[stream])) throw Error('Raw receipt hash mismatch');
        const file = `${receipt.index}-${stream}.log`;
        write(path.join(target, file), receipt[stream]);
        raw.push({ index: receipt.index, stream, file, sha256: receipt[stream + 'Hash'] });
      }
    }
    const joined = { schema: 'task432-disk-evidence-v1', runId, manifest: captured, raw };
    const bytes = json(joined);
    write(path.join(target, 'manifest.json'), bytes);
    // Before publication, failures leave unsealed evidence. Publication is the
    // commit point: later housekeeping/durability failures must not reject a
    // committed readable bundle. Read-only permissions are NOT tamper-proof.
    write(path.join(target, 'seal.pending'), hash(bytes) + '\n');
    syncDirectory(target);
    // Hard-link publishes the fully fsynced seal atomically, without overwrite.
    fs.linkSync(path.join(target, 'seal.pending'), path.join(target, 'manifest.sha256'));
    const warnings = [];
    const afterCommit = (operation, action) => {
      try { action(); return true; }
      catch (error) { warnings.push({ operation, code: error.code ?? null, message: error.message }); return false; }
    };
    afterCommit('remove-pending-seal', () => fs.unlinkSync(path.join(target, 'seal.pending')));
    afterCommit('read-only-directory', () => fs.chmodSync(target, 0o500));
    const targetSynced = afterCommit('sync-run-directory', () => syncDirectory(target));
    const parentSynced = afterCommit('sync-parent-directory', () => syncDirectory(directory));
    return { directory: target, manifestHash: hash(bytes), committed: true,
      durabilityConfirmed: targetSynced && parentSynced, warnings };
  };
}
export function verifyEvidence(directory) {
  privateDirectory(directory);
  const read = file => {
    const resolved = path.join(directory, file), stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw Error('Invalid evidence file');
    return fs.readFileSync(resolved);
  };
  const bytes = read('manifest.json');
  if (read('manifest.sha256').toString() !== hash(bytes) + '\n') throw Error('Manifest seal mismatch');
  const joined = JSON.parse(bytes);
  if (joined.schema !== 'task432-disk-evidence-v1' || !Array.isArray(joined.manifest?.receipts) || !Array.isArray(joined.raw)) throw Error('Invalid joined evidence');
  const expected = [];
  for (const [index, receipt] of joined.manifest.receipts.entries()) {
    if (receipt.index !== index + 1) throw Error('Noncanonical receipt order');
    for (const stream of ['stdout', 'stderr']) {
      const file = `${index + 1}-${stream}.log`, sha256 = hash(read(file));
      if (typeof receipt[stream] !== 'string' || hash(receipt[stream]) !== sha256 || receipt[stream + 'Hash'] !== sha256) throw Error('Raw evidence mismatch');
      expected.push({ index: index + 1, stream, file, sha256 });
    }
  }
  if (JSON.stringify(expected) !== JSON.stringify(joined.raw)) throw Error('Raw index mismatch');
  return joined;
}
