import assert from 'node:assert/strict';
import { compose, boundaries } from '../../../../scripts/market-composition.mjs';
import { localPhaseOpener } from '../../../../scripts/market-local-phase.mjs';
import { steps } from '../../../../scripts/market-stages.mjs';
const identity = { source: 'offline' };
const receipt = () => ({ status: 0, stdout: '\0raw', stderr: 'é' });
function fixture({ deny, drift = false, fail = -1, cleanupFailure = false } = {}) {
  const calls = []; let closed = 0, changed = false, count = 0;
  const capture = () => changed ? {} : identity;
  const openLocal = localPhaseOpener({ root: '/offline', capture,
    spawn(command, args, options) { calls.push({ command, args, options }); return { ...receipt(), status: count++ === fail ? 9 : 0 }; },
    acquire: async () => ({ env: { NODE_ENV: 'test' },
      assertNativeAdmission: async () => { if (deny === 'native') throw Error('native denied'); },
      assertProvenance: async () => { if (deny === 'provenance') throw Error('provenance denied'); },
      assertOwnedRuntime: async () => { if (drift) changed = true; },
      close: async () => { closed++; if (cleanupFailure) throw Error('cleanup denied'); },
    }),
  });
  return { calls, openLocal, capture, closed: () => closed };
}
await assert.rejects(localPhaseOpener({ capture: () => identity })(boundaries.local, identity), /unavailable/);
for (const deny of ['native', 'provenance']) {
  const f = fixture({ deny }); await assert.rejects(f.openLocal(boundaries.local, identity));
  assert.equal(f.calls.length, 0); assert.equal(f.closed(), 1);
}
{
  let closed = 0;
  const open = localPhaseOpener({ capture: () => identity, acquire: async () => ({
    env: {}, assertNativeAdmission: true, assertProvenance: true, assertOwnedRuntime: true, close: async () => { closed++; },
  }) });
  await assert.rejects(open(boundaries.local, identity), /verifiers/); assert.equal(closed, 1);
}
{
  const f = fixture({ drift: true }); await assert.rejects(f.openLocal(boundaries.local, identity), /changed/);
  assert.equal(f.calls.length, 0); assert.equal(f.closed(), 1);
}
{
  let revoked = false, closed = 0, spawned = 0;
  const open = localPhaseOpener({ capture: () => identity, spawn: () => { spawned++; return receipt(); },
    acquire: async () => ({ env: {}, assertNativeAdmission: async () => { if (revoked) throw Error('revoked'); },
      assertProvenance: async () => {}, assertOwnedRuntime: async () => {}, close: async () => { closed++; } }) });
  const session = await open(boundaries.local, identity); revoked = true;
  await assert.rejects(session.run(steps[2]), /revoked/); await session.close();
  assert.equal(spawned, 0); assert.equal(closed, 1);
}
for (const fail of [-1, ...Array.from({ length: 10 }, (_, i) => i)]) {
  const f = fixture({ fail }); let auditClosed = 0, persisted;
  const run = compose({ capture: f.capture, versions: { node: 'stub', npm: 'stub' },
    openAudit: async contract => ({ contract, run: async () => receipt(), close: async () => { auditClosed++; } }),
    openLocal: f.openLocal, persist: async manifest => { persisted = manifest; return { committed: true, durabilityConfirmed: true }; },
  });
  if (fail < 0) assert.equal((await run).qualification, 'SOURCE_CORE_COMPLETED_NOT_QUALIFIED');
  else await assert.rejects(run, /stage failed/);
  assert.equal(auditClosed, 1); assert.equal(f.closed(), 1);
  assert.equal(f.calls.length, fail < 0 ? 10 : fail + 1);
  assert.deepEqual(f.calls.map(({ command, args }) => ({ command, args })), steps.slice(2, 2 + f.calls.length).map(({ command, args }) => ({ command, args })));
  assert.equal(persisted.receipts.length, f.calls.length + 2);
}
{
  const f = fixture({ cleanupFailure: true }); const s = await f.openLocal(boundaries.local, identity);
  await assert.rejects(s.close(), /cleanup/); await assert.rejects(s.close(), /cleanup/); assert.equal(f.closed(), 1);
}
console.log('PASS offline local lifecycle: default denial, boolean denial, native/provenance/source denial cleanup, compose exact12/all10 failfast, cleanup once');
