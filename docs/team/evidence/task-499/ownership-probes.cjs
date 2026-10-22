'use strict';
// Inert actual-helper checks only; no app, Jest, HTTP, DB, Redis or env imports.
const assert = require('node:assert/strict');
const { checkoutOwnership, promiseMiddleware, preallocateCheckout } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function unresolved(kind) {
  const ids = { event: 'synthetic-event', buyers: ['synthetic-buyer'], foreign: 'synthetic-sentinel' };
  const work = checkoutOwnership(ids, 10);
  const raw = deferred();
  let cleanups = 0, disconnects = 0, nexts = 0;
  await work.run(() => Promise.resolve('HTTP wrapper already settled'));
  let ongoing;
  if (kind === 'continuation') ongoing = promiseMiddleware(async () => { await raw.promise; nexts++; }, work)();
  else ongoing = work.run(() => raw.promise); // actual raw server.close callback lifetime
  await assert.rejects(work.teardown([() => { cleanups++; }, () => { disconnects++; }]), /preserve fixture IDs/);
  assert.equal(work.size, 1);
  assert.equal(work.preserved, true);
  assert.throws(() => work.admit(), /preserve fixture IDs/);
  assert.deepEqual(work.inventory, ids);
  assert.deepEqual([cleanups, disconnects], [0, 0]);
  raw.resolve(); await ongoing;
  assert.equal(nexts, kind === 'continuation' ? 1 : 0);
  await assert.rejects(work.join(), /preserve fixture IDs/);
  await assert.rejects(work.teardown([() => { cleanups++; }]), /preserve fixture IDs/);
  assert.deepEqual([cleanups, disconnects], [0, 0]);
  console.log('PASS unresolved ' + kind + ': permanent preserve, no teardown/admission, late settle cannot reopen');
}
async function settled(rejectClient) {
  const work = checkoutOwnership({ event: 'settled-fixture' }, 50);
  let cleanup = 0;
  const client = work.run(() => rejectClient ? Promise.reject(new Error('settled client transport failure')) : Promise.resolve(201));
  if (rejectClient) await assert.rejects(client, /transport failure/); else assert.equal(await client, 201);
  await work.join();
  await work.teardown([() => { cleanup++; }]);
  assert.equal(work.preserved, false); assert.equal(cleanup, 1);
  console.log('PASS settled client ' + (rejectClient ? 'failure' : 'success') + ': raw join permits owned cleanup');
}
(async () => {
  let sequence = 0;
  const ids = preallocateCheckout(() => 'synthetic-' + (++sequence));
  assert.equal(ids.buyers.length, 100);
  assert.equal(new Set([ids.organization, ids.event, ids.ticketType, ...ids.buyers, ...Object.values(ids.foreign)]).size, 107);
  console.log('PASS all 107 setup IDs preallocated, including independent foreign sentinel');
  await unresolved('continuation'); await unresolved('close');
  await settled(true); await settled(false);
  const work = checkoutOwnership({ event: 'observer-fixture' }, 50);
  await assert.rejects(work.critical(() => Promise.reject(new Error('observer failed'))), /preserve fixture IDs/);
  assert.throws(() => work.admit(), /preserve fixture IDs/);
  console.log('PASS settled critical observer rejection conservatively latches');
})().catch(error => { console.error(error); process.exitCode = 1; });
