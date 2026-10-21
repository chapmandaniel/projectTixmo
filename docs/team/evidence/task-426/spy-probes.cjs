'use strict';
const assert = require('node:assert/strict');
const { spyOn } = require('/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/jest-mock');
const { trackedSpy } = require('./tracked-spy.cjs');
const { tracker } = require('./lifecycle.cjs');
(async () => {
  let evals = 0, removals = 0;
  const target = { async eval(value) { evals++; return value; }, async zRem(value) { removals++; return value; } };
  const originals = { ...target }, work = tracker();
  const evalLayer = trackedSpy({ spyOn }, target, 'eval', work);
  const removalLayer = trackedSpy({ spyOn }, target, 'zRem', work);
  for (const point of ['before', 'after', 'controller']) {
    let release, entered;
    const reached = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    evalLayer.setPhase(async (native, value) => { entered(); await gate; return native(value); });
    const pending = target.eval(point); await reached;
    await assert.rejects(work.join(5), /deadline/);
    release(); assert.equal(await pending, point); await work.join();
    evalLayer.resetPhase();
    assert.equal(target.eval, evalLayer.spy);
    await target.zRem(point); await work.join();
  }
  assert.equal(evals, 3); assert.equal(removals, 3);
  evalLayer.setPhase(async () => { throw new Error('phase failure'); });
  await assert.rejects(target.eval('bad'), /phase failure/); await work.join();
  evalLayer.resetPhase(); assert.equal(await target.eval('healthy'), 'healthy');
  assert.equal(evals, 4); assert.equal(removalLayer.spy.mock.calls.length, 3);
  evalLayer.spy.mockRestore(); removalLayer.spy.mockRestore();
  assert.equal(target.eval, originals.eval); assert.equal(target.zRem, originals.zRem);
  console.log('PASS installed jest-mock: three phase delegates, native called once each/no recursion, blocked phase joined, failure join/reset, zRem tracking retained, exact original restoration. Offline only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
