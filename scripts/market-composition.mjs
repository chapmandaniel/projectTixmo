// SOURCE-ONLY composition core. No production adapters or executable CLI supplied.
// Calling this with stubs is not market qualification or network authorization.
import { steps } from './market-stages.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function snapshot(root) {
  // Includes every tracked working-tree file, not merely HEAD/locks. Missing files
  // fail closed. Qualification requires a clean candidate, checked at both ends.
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git(['status', '--porcelain', '--untracked-files=all']).trim()) throw Error('Dirty candidate');
  const source = git(['rev-parse', 'HEAD']).trim();
  const files = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
  const hashes = Object.fromEntries(files.map(file => [file, digest(readFileSync(path.join(root, file)))]));
  for (const area of ['', 'tixmoapi2/', 'tdash/']) {
    for (const file of ['package.json', 'package-lock.json']) {
      if (!hashes[area + file]) throw Error('Missing package/lock: ' + area + file);
    }
  }
  return { source, hashes, sourceHash: digest(JSON.stringify(hashes)) };
}
const auditBoundary = {
  kind: 'audit', credentialFree: true, serviceFree: true,
  destinations: ['registry.npmjs.org:443'], dns: 'existing-resolver-only',
  redirects: false, proxies: false, alternateRegistries: false,
};
const localBoundary = {
  kind: 'local', freshScrubbed: true, preImportGuard: true,
  ownedDatabase: true, ownedRedis: true, nativeHttpRegistration: true,
  privateDiskArtifact: true, auditAuthorityAbsent: true,
};
export const boundaries = { audit: auditBoundary, local: localBoundary };
// Admission adapters are trusted external boundaries, not booleans supplied by
// shell environment. They MUST actually enforce the contract before returning.
// This core alone cannot enforce native/subprocess egress or validate ownership.
export async function compose({ capture, openAudit, openLocal, persist, versions, collectNestedApi, now = () => new Date().toISOString() }) {
  if (!versions?.node || !versions?.npm) throw Error('Runtime versions required');
  const identity = structuredClone(capture());
  const manifest = { schema: 'task432-source-core-v1', identity, versions,
    started: now(), qualification: 'INCOMPLETE', receipts: [] };
  const unchanged = () => { if (!equal(identity, capture())) throw Error('Candidate changed; qualification invalid'); };
  let session, failure;
  try {
    for (let index = 0; index < steps.length; index++) {
      unchanged();
      if (index === 0 || index === 2) {
        if (session) { await session.close(); session = undefined; }
        unchanged();
        const boundary = index === 0 ? auditBoundary : localBoundary;
        session = await (index === 0 ? openAudit : openLocal)(structuredClone(boundary), structuredClone(identity));
        if (!session || !equal(session.contract, boundary) || typeof session.run !== 'function' || typeof session.close !== 'function') {
          throw Error('Missing enforced phase boundary');
        }
      }
      const step = structuredClone(steps[index]);
      const started = now();
      // Adapter owns fresh env and mandatory pre-import guards; no parent env is
      // accepted/passed here. Dashboard production override remains exact.
      unchanged(); // Admission/teardown may have changed source; never run stale.
      const result = await session.run(structuredClone(step));
      if (!Number.isInteger(result?.status) || typeof result.stdout !== 'string' || typeof result.stderr !== 'string') throw Error('Missing raw stage receipt');
      manifest.receipts.push({ index: index + 1, phase: index < 2 ? 'audit' : 'local',
        ...step, started, finished: now(),
        status: result.status, signal: result.signal ?? null, error: result.error ?? null,
        stdout: result.stdout, stderr: result.stderr,
        stdoutHash: digest(result.stdout), stderrHash: digest(result.stderr) });
      if (index === 4 && collectNestedApi) {
        // Collect independently from private transport, never spread executor fields.
        manifest.receipts.at(-1).nestedApi = structuredClone(await collectNestedApi({ identity: structuredClone(identity), status: result.status }));
      }
      unchanged();
      if (result.status !== 0 || result.signal || result.error) throw Error('Market stage failed: ' + step.name);
    }
    await session.close(); session = undefined;
    unchanged();
    // Deliberately not PASS: this source-only core has no reviewed enforcement
    // adapters or nested API receipt transport yet. Independent review required.
    manifest.qualification = 'SOURCE_CORE_COMPLETED_NOT_QUALIFIED';
    return manifest;
  } catch (error) {
    manifest.failure = error.message;
    failure = error;
    throw error;
  } finally {
    try { if (session) await session.close(); }
    catch (error) { failure = error; manifest.qualification = 'INCOMPLETE'; manifest.cleanupFailure = error.message; throw error; }
    finally {
      manifest.finished = now();
      // The sealed input cannot contain its own post-publication outcome. Retain
      // that outcome in the caller envelope instead; never rewrite sealed bytes.
      try {
        const outcome = await persist(structuredClone(manifest));
        manifest.persistence = structuredClone(outcome ?? null);
        manifest.evidenceCompletion = outcome?.committed === true
          ? (outcome.durabilityConfirmed === true ? 'COMMITTED_DURABILITY_CONFIRMED' : 'COMMITTED_DURABILITY_UNCONFIRMED')
          : 'PUBLICATION_UNCONFIRMED';
        if (outcome?.committed !== true || outcome.durabilityConfirmed !== true) manifest.qualification = 'INCOMPLETE';
      } catch (error) {
        manifest.qualification = 'INCOMPLETE';
        manifest.persistenceFailure = error.message;
        // A generic callback rejection cannot prove publication never happened.
        manifest.evidenceCompletion = 'CALLBACK_FAILED_PUBLICATION_UNKNOWN';
        error.evidence = structuredClone(manifest);
        if (failure) error.executionFailure = failure;
        throw error;
      } finally {
        // Failed stages/cleanup still reject, with any committed outcome exposed.
        if (failure) failure.evidence = structuredClone(manifest);
      }
    }
  }
}
