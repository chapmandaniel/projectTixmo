'use strict';
// Inert QA only: builtins + reviewed helper, no application/resources.
const assert = require('node:assert/strict');
const { checkoutOwnership, promiseMiddleware } = require('../../../../tixmoapi2/tests/qualification/task499/ownership.cjs');
(async () => {
  const steps = checkoutOwnership({ event: 'step-failure' }, 50);
  let disconnected = false;
  await assert.rejects(steps.teardown([() => { throw Error('cleanup failed'); }, () => { disconnected = true; }]), /preserve fixture IDs/);
  assert.equal(disconnected, false);
  assert.equal(steps.preserved, true);
  console.log('PASS rejected teardown step stops later disconnect and latches');

  const dynamic = checkoutOwnership({ event: 'dynamic' }, 50);
  let finish;
  const child = new Promise(resolve => { finish = resolve; });
  const parent = dynamic.run(() => { dynamic.run(() => child); });
  await parent;
  let cleaned = false;
  const draining = dynamic.teardown([() => { cleaned = true; }]);
  await Promise.resolve();
  assert.equal(cleaned, false);
  finish(); await draining;
  assert.equal(cleaned, true);
  console.log('PASS join includes work registered during parent operation');

  const uncertain = checkoutOwnership({ event: 'unknown-middleware-lifetime' }, 50);
  let rawFinished = false, finishRaw;
  const raw = new Promise(resolve => { finishRaw = resolve; }).then(() => { rawFinished = true; });
  // Invalid middleware can initiate work but fail the required promise contract.
  await assert.rejects(promiseMiddleware(() => { void raw; }, uncertain)(), /cannot establish continuation lifetime/);
  let unsafeCleanup = 0;
  await uncertain.teardown([() => { unsafeCleanup++; }]);
  assert.equal(rawFinished, false);
  assert.equal(unsafeCleanup, 1);
  assert.equal(uncertain.preserved, false);
  finishRaw(); await raw;
  console.log('REPRODUCED DEFECT: unknown middleware lifetime rejection permits cleanup without permanent latch');
})().catch(error => { console.error(error); process.exitCode = 1; });
