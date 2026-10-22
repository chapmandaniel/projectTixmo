'use strict';
// Actual extracted instrumentation helper; no Redis/Jest/product imports.
const assert = require('node:assert/strict');
const { checkoutOwnership, criticalCall } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
async function rejection(name, synchronous) {
  const ids = { event: 'owned-event', buyers: ['owned-buyer'] };
  const work = checkoutOwnership(ids, 50);
  let cleanup = 0, disconnect = 0, logged = 0, settled = false;
  const rawError = new Error(name + ' raw failure');
  const receiver = { marker: name };
  const instrumented = criticalCall(function (key) {
    assert.equal(this, receiver); assert.equal(key, 'owned-key');
    if (synchronous) throw rawError;
    return Promise.reject(rawError);
  }, work);
  // Match waitingRoom: the detached command rejection is consumed/logged.
  await instrumented.call(receiver, 'owned-key').catch(error => {
    assert.equal(work.preserved, true, 'latch must precede consumer notification');
    assert.equal(error.cause, rawError); logged++;
  }).then(() => { settled = true; });
  assert.equal(settled, true); assert.equal(logged, 1); assert.equal(work.size, 0);
  await assert.rejects(work.join(), /preserve fixture IDs/);
  assert.throws(() => work.admit(), /preserve fixture IDs/);
  await assert.rejects(work.teardown([() => { cleanup++; }, () => { disconnect++; }]), /preserve fixture IDs/);
  assert.deepEqual([cleanup, disconnect], [0, 0]);
  assert.deepEqual(work.inventory, ids);
  await Promise.resolve();
  assert.equal(work.preserved, true);
  console.log('PASS actual criticalCall ' + name + (synchronous ? ' synchronous throw' : ' async rejection') + ': swallowed error cannot admit/cleanup/disconnect');
}
(async () => {
  for (const name of ['zRem', 'eval', 'sendCommand']) await rejection(name, false);
  await rejection('zRem', true);
  const work = checkoutOwnership({ event: 'success' }, 50);
  let cleanup = 0;
  const nested = criticalCall(async () => 7, work);
  // Nested registration must settle without a critical()/join() self-deadlock.
  const outer = criticalCall(async () => 1 + await nested(), work);
  assert.equal(await outer(), 8);
  await work.teardown([() => { cleanup++; }]);
  assert.equal(cleanup, 1); assert.equal(work.preserved, false);
  console.log('PASS actual criticalCall nested success: settles without self-join and permits cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
