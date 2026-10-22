'use strict';
// Inert actual helper only, no product imports or resource access.
const assert = require('node:assert/strict');
const { checkoutOwnership, criticalCall } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function failed(kind) {
  const ids = { event: 'qa-owned', buyers: ['qa-buyer'], foreign: 'qa-foreign' };
  const work = checkoutOwnership(ids, 40), late = deferred();
  let cleanup = 0, disconnect = 0, consumed = false;
  const hidden = work.run(() => late.promise);
  const receiver = {};
  const wrapped = criticalCall(function (value) {
    assert.equal(this, receiver); assert.equal(value, 31);
    if (kind === 'throw') throw new Error('raw sync');
    return Promise.reject(new Error('raw async'));
  }, work);
  const raw = wrapped.call(receiver, 31);
  if (kind === 'reject') await assert.rejects(raw, /preserve fixture IDs/);
  else await raw.catch(error => { assert(work.preserved); assert(error.cause); consumed = true; });
  if (kind !== 'reject') assert(consumed);
  assert.equal(work.size, 1);
  assert.deepEqual(work.inventory, ids);
  work.inventory.buyers.push('cannot-mutate-inventory');
  await assert.rejects(work.teardown([() => { cleanup++; }, () => { disconnect++; }]), /preserve fixture IDs/);
  assert.throws(() => work.admit(), /preserve fixture IDs/);
  late.resolve(); await hidden;
  assert.equal(work.size, 0);
  await assert.rejects(work.join(), /preserve fixture IDs/);
  await assert.rejects(work.teardown([() => { cleanup++; }]), /preserve fixture IDs/);
  assert.deepEqual([cleanup, disconnect], [0, 0]); assert.deepEqual(work.inventory, ids);
  console.log('PASS independent raw ' + kind + ': failure latch before consumer, retained IDs, late work cannot reopen');
}
(async () => {
  for (const kind of ['reject', 'swallow', 'throw']) await failed(kind);
  const work = checkoutOwnership({ event: 'nested' }, 40), raw = deferred();
  let cleanup = 0;
  const inner = criticalCall(() => raw.promise, work);
  const outer = criticalCall(async () => 5 + await inner(), work);
  const result = outer(); await Promise.resolve(); await Promise.resolve();
  assert.equal(work.size, 2); assert.equal(work.preserved, false);
  raw.resolve(8); assert.equal(await result, 13);
  await work.teardown([() => { cleanup++; }]);
  assert.equal(cleanup, 1); assert.equal(work.preserved, false);
  console.log('PASS independent pending nested lifetime and successful cleanup');
  const client = checkoutOwnership({ event: 'client' }, 40);
  await assert.rejects(client.run(() => Promise.reject(new Error('settled transport'))), /settled transport/);
  await client.teardown([() => { cleanup++; }]);
  assert.equal(client.preserved, false); assert.equal(cleanup, 2);
  console.log('PASS independent settled client rejection is not raw critical failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
