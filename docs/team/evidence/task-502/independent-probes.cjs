'use strict';
// Independent inert QA: builtins and reviewed actual helper only.
const assert = require('node:assert/strict');
const { checkoutOwnership, promiseMiddleware } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
async function unknown(throws) {
  const ids = { event: 'qa502-event', buyers: ['qa502-buyer'], foreign: { event: 'qa502-sentinel' } };
  const work = checkoutOwnership(ids, 50);
  let finishRaw, hiddenFinished = false, wrapperSettled = false, checkedEarly = false;
  const raw = new Promise(resolve => { finishRaw = resolve; });
  let hidden, cleanup = 0, disconnect = 0;
  const wrapper = promiseMiddleware(() => {
    hidden = raw.then(() => { hiddenFinished = true; });
    queueMicrotask(() => {
      assert.equal(wrapperSettled, false, 'latch precedes wrapper settlement notification');
      assert.equal(work.preserved, true);
      assert.throws(() => work.admit(), /preserve fixture IDs/);
      checkedEarly = true;
    });
    if (throws) throw Error('unknown lifetime after hidden start');
  }, work)();
  wrapper.then(() => { wrapperSettled = true; }, () => { wrapperSettled = true; });
  await assert.rejects(wrapper, /preserve fixture IDs/);
  assert.equal(checkedEarly, true);
  assert.equal(work.size, 0);
  assert.equal(hiddenFinished, false);
  assert.equal(work.preserved, true);
  assert.deepEqual(work.inventory, ids);
  const snapshot = work.inventory;
  snapshot.foreign.event = 'mutated external copy';
  assert.deepEqual(work.inventory, ids);
  const steps = [() => { cleanup++; }, () => { disconnect++; }];
  await assert.rejects(work.teardown(steps), /preserve fixture IDs/);
  assert.deepEqual([cleanup, disconnect], [0, 0]);
  finishRaw(); await hidden;
  assert.equal(hiddenFinished, true);
  await assert.rejects(work.join(), /preserve fixture IDs/);
  await assert.rejects(work.teardown(steps), /preserve fixture IDs/);
  assert.throws(() => work.admit(), /preserve fixture IDs/);
  assert.deepEqual(work.inventory, ids);
  assert.deepEqual([cleanup, disconnect], [0, 0]);
  console.log('PASS QA502 ' + (throws ? 'throwing' : 'missing') + ' contract: early permanent latch, zero teardown, retained IDs, late settlement closed');
}
(async () => {
  await unknown(false); await unknown(true);
  for (const reject of [true, false]) {
    const work = checkoutOwnership({ event: 'settled' }, 50);
    let cleaned = 0;
    const client = work.run(() => reject ? Promise.reject(Error('transport failure')) : Promise.resolve(201));
    if (reject) await assert.rejects(client, /transport failure/); else assert.equal(await client, 201);
    await work.join(); await work.teardown([() => { cleaned++; }]);
    assert.equal(cleaned, 1); assert.equal(work.preserved, false);
    console.log('PASS QA502 settled client ' + (reject ? 'failure' : 'success') + ' executes cleanup');
  }
  const failed = checkoutOwnership({ event: 'failed-step' }, 50);
  let disconnected = false;
  await assert.rejects(failed.teardown([() => { throw Error('cleanup failed'); }, () => { disconnected = true; }]), /preserve fixture IDs/);
  assert.equal(disconnected, false); assert.equal(failed.preserved, true);
  console.log('PASS QA502 failed teardown step blocks disconnect');
  const nested = checkoutOwnership({ event: 'nested' }, 50);
  let finish, cleaned = false;
  const child = new Promise(resolve => { finish = resolve; });
  await nested.run(() => { nested.run(() => child); });
  const draining = nested.teardown([() => { cleaned = true; }]);
  await Promise.resolve(); assert.equal(cleaned, false);
  finish(); await draining; assert.equal(cleaned, true);
  console.log('PASS QA502 nested raw registration joined before cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
