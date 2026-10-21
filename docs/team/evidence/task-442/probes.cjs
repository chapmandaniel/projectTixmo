'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const deps = '/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/';
const ts = require(deps + 'typescript');
const jest = require(deps + 'jest-mock');
const { tracker, finalize } = require('../task-426/lifecycle.cjs');
const source = fs.readFileSync('tixmoapi2/tests/qualification/orders-http-abort.local.ts', 'utf8');
const transpile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
(async () => {
  const work = tracker();
  let nativeCalls = 0;
  const native = async () => { nativeCalls++; return 1; };
  const redis = { eval: native, zRem: async () => 1 };
  const context = { redis, work, instrumentation: [], jest };
  const trackingBlock = source.slice(source.indexOf("    for (const name of ['zRem', 'eval']"), source.indexOf("    const { default: app }"));
  vm.runInNewContext(transpile(trackingBlock), context);
  const trackingSpy = redis.eval;
  const realEval = redis.eval.bind(redis);
  let depth = 0;
  const sentinel = new Error('bounded recursive spy sentinel');
  Object.assign(context, {
    realEval: (...args) => { if (++depth > 6) return Promise.reject(sentinel); return realEval(...args); },
    ACQUIRE_REQUEST_LEASE: 'ACQUIRE', point: 'before-acquire', token: undefined,
    reached: { resolve() {} }, released: { promise: Promise.resolve() }, evalSpy: undefined,
  });
  const phaseBlock = source.slice(source.indexOf("      evalSpy = jest.spyOn(redis, 'eval')"), source.indexOf("      if (point === 'controller')"));
  vm.runInNewContext(transpile(phaseBlock), context);
  assert.equal(context.evalSpy, trackingSpy);
  await assert.rejects(redis.eval('ACQUIRE', { arguments: ['synthetic'] }), error => error === sentinel);
  assert.equal(nativeCalls, 0);
  console.log('REPRO blocker: extracted actual tracking/phase blocks share same Jest spy; recursive depth7 sentinel, zero native eval calls');
  context.evalSpy.mockRestore();
  assert.equal(redis.eval, native);
  await redis.eval('NEXT_PHASE');
  assert.equal(work.size, 0);
  console.log('REPRO blocker: phase mockRestore removes lifetime eval tracking; subsequent native eval is not tracked');
  const nested = tracker(); let releaseChild; let child;
  const parent = nested.run(async () => { child = nested.run(() => new Promise(resolve => { releaseChild = resolve; })); });
  await parent;
  const join = nested.join(100);
  await Promise.resolve(); assert.equal(nested.size, 1); releaseChild(); await child; await join;
  assert.equal(nested.size, 0);
  console.log('PASS tracker includes child admitted while parent active and joins both');
  const primary = new Error('first failure'); let receipt; let diagnostics;
  await assert.rejects(finalize({ primary, steps: [['cleanup fails', () => { throw Error('cleanup'); }]], receipt: () => ({ invocation:'synthetic', sourceSHA:'offline', rows:[{status:'STARTED'}] }), publish: r => { receipt=r; throw Error('ENOSPC'); }, report: text => { diagnostics=text; } }), e => e===primary);
  assert.equal(receipt.status,'FAILED'); assert.match(diagnostics,/ENOSPC/); assert.match(diagnostics,/first failure/);
  console.log('PASS original error identity survives cleanup failure plus ENOSPC; partial/source receipt retained for publication attempt');
  await assert.rejects(finalize({ steps:[['cleanup fails',()=>{throw Error('cleanup');}]], receipt:()=>({}), publish:()=>{throw Error('ENOSPC');}, report:()=>{} }), /Owned cleanup incomplete/);
  console.log('PASS cleanup failure precedence over artifact failure without primary');
  const catchSource=fs.readFileSync('tixmoapi2/src/utils/catchAsync.ts','utf8');
  assert.match(catchSource,/void fn\(req, res, next\)\.catch\(next\)/);
  assert(source.indexOf("jest.spyOn(asyncModule, 'catchAsync')") < source.indexOf("const { default: app }"));
  assert(source.indexOf("['join admitted mutable work'") < source.indexOf("['restore instrumentation'"));
  assert.match(source,/if \(!joined\) throw new Error\('SKIPPED/);
  assert(source.indexOf("['diff', '--quiet', 'HEAD'") < source.indexOf('redis = await connectRedis()'));
  console.log('PASS source-only pre-app catchAsync tracking, join-before-restore and timeout skips, clean-source preconnection ordering; NOT app compatibility/runtime proof');
})().catch(e=>{console.error(e);process.exitCode=1;});
