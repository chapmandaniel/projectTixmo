import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localStageSession } from '../../../../scripts/market-local-session.mjs';
import { steps } from '../../../../scripts/market-stages.mjs';
const identity = { source: 'fixture' };
function fixture(extra = {}) {
  const calls = [];
  const session = localStageSession({ root: '/offline', identity, env: { NODE_ENV: 'test' },
    capture: () => identity, assertOwnedRuntime: async () => {}, closeOwnedRuntime: async () => {},
    spawn: (command, args, options) => { calls.push({ command, args, options }); return { status: 0, stdout: '\0raw', stderr: '' }; }, ...extra });
  return { session, calls };
}
{
  const { session, calls } = fixture();
  for (const step of steps.slice(2)) assert.equal((await session.run(structuredClone(step))).stdout, '\0raw');
  assert.deepEqual(calls.map(({ command, args }) => ({ command, args })), steps.slice(2).map(({ command, args }) => ({ command, args })));
  assert.equal(calls[6].options.env.NODE_ENV, 'production');
  assert.equal(calls[7].options.env.NODE_ENV, 'test');
  await assert.rejects(session.run(steps[2]));
}
for (let failure = 0; failure < 10; failure++) {
  let count = 0;
  const { session } = fixture({ spawn: () => ({ status: count++ === failure ? 7 : 0, stdout: '', stderr: '' }) });
  for (let i = 0; i <= failure; i++) await session.run(steps[i + 2]);
  await assert.rejects(session.run(steps[Math.min(failure + 3, 11)]));
  assert.equal(count, failure + 1);
}
for (const extra of [
  { assertOwnedRuntime: async () => { throw Error('not admitted'); } },
  { capture: () => ({ source: 'changed' }) },
]) {
  const { session, calls } = fixture(extra);
  await assert.rejects(session.run(steps[2])); assert.equal(calls.length, 0);
}
{
  let changed = false;
  const { session, calls } = fixture({ capture: () => changed ? {} : identity,
    assertOwnedRuntime: async () => { changed = true; } });
  await assert.rejects(session.run(steps[2])); assert.equal(calls.length, 0);
}
{
  const { session, calls } = fixture();
  await assert.rejects(session.run(steps[3])); assert.equal(calls.length, 0);
  await session.close(); await assert.rejects(session.run(steps[2]));
}
const shell = fs.readFileSync(new URL('../task-427/runtime.sh', import.meta.url), 'utf8');
assert.ok(shell.indexOf('task432_identity=$(') < shell.indexOf('--prepare'));
assert.ok(shell.indexOf('Source changed before provisioning') < shell.indexOf('"$pgbin/initdb"'));
console.log('PASS exact10/parity/override/rawNUL/all10failfast/admission/source/order/closed/preprovision-order offline probes');

{
  let release, cleanups = 0;
  const { session, calls } = fixture({ assertOwnedRuntime: () => new Promise(resolve => { release = resolve; }),
    closeOwnedRuntime: async () => { cleanups++; } });
  const running = session.run(steps[2]);
  await assert.rejects(session.run(steps[2]));
  await assert.rejects(session.close());
  release(); await running;
  await Promise.all([session.close(), session.close()]);
  assert.equal(cleanups, 1); assert.equal(calls.length, 1);
}
