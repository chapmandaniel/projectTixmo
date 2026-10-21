'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const deps='/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/';
const ts=require(deps+'typescript');
const jest=require(deps+'jest-mock');
const {trackedSpy}=require('../task-426/tracked-spy.cjs');
const {tracker,finalize}=require('../task-426/lifecycle.cjs');
const source=fs.readFileSync('tixmoapi2/tests/qualification/orders-http-abort.local.ts','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
(async()=>{
  const calls=[];const work=tracker();
  let releaseRemoval;
  const redis={async eval(script,options){calls.push([script,options.arguments[0]]);return 1;},zRem(){return new Promise(r=>{releaseRemoval=r;});}};
  const native={...redis};
  const evalLayer=trackedSpy(jest,redis,'eval',work);
  const removalLayer=trackedSpy(jest,redis,'zRem',work);
  const phaseText=source.slice(source.indexOf('      evalLayer.setPhase('),source.indexOf("      if (point === 'controller')"));
  const code=ts.transpileModule(phaseText,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const point of ['before-acquire','after-acquire','controller']){
    const reached=deferred(),released=deferred();
    const context={evalLayer,point,reached,released,ACQUIRE_REQUEST_LEASE:'ACQUIRE',token:undefined};
    vm.runInNewContext(code,context);
    const before=calls.length;
    const pending=redis.eval('ACQUIRE',{arguments:[point]});
    if(point!=='controller'){
      await reached.promise;
      assert.equal(calls.length-before,point==='before-acquire'?0:1);
      await assert.rejects(work.join(5),/deadline/);
      released.resolve();
    }
    assert.equal(await pending,1);await work.join();
    assert.equal(calls.length-before,1);
    assert.equal(context.token,point);
    evalLayer.resetPhase();assert.equal(redis.eval,evalLayer.spy);
    const fallback=redis.eval('HEALTHY',{arguments:[point]});
    assert.equal(work.size,1);await fallback;await work.join();
    console.log('PASS extracted '+point+' delegate: native once, gate ordering, join, tracking retained on reset and healthy fallback');
  }
  const detached=redis.zRem('lease');
  await Promise.resolve();assert.equal(work.size,1);
  await assert.rejects(work.join(5),/deadline/);
  releaseRemoval();await detached;await work.join();
  assert.equal(removalLayer.spy.mock.calls.length,1);
  console.log('PASS detached zRem remains tracked and blocks join until actual native settlement');
  evalLayer.setPhase(async()=>{throw Error('phase failure');});
  await assert.rejects(redis.eval('ANY',{}),/phase failure/);await work.join();evalLayer.resetPhase();
  evalLayer.spy.mockRestore();removalLayer.spy.mockRestore();
  assert.equal(redis.eval,native.eval);assert.equal(redis.zRem,native.zRem);
  console.log('PASS rejection settles tracker; final restoration preserves exact original method identities');
  const primary=Error('original');let diagnostic;
  await assert.rejects(finalize({primary,steps:[],receipt:()=>({sourceSHA:'synthetic',invocation:'offline',rows:[{status:'STARTED'}]}),publish:()=>{throw Error('ENOSPC');},report:msg=>diagnostic=msg}),error=>error===primary);
  assert.match(diagnostic,/original/);assert.match(diagnostic,/ENOSPC/);
  console.log('PASS original failure identity preserved on artifact ENOSPC');
  assert(!source.includes("jest.spyOn(redis, 'eval')"));assert(!source.includes('evalSpy.mockRestore'));
  assert(source.indexOf('await work.join();')<source.indexOf('evalLayer.resetPhase();'));
  console.log('PASS source has no duplicate eval spy/per-phase restore; join precedes reset');
})().catch(e=>{console.error(e);process.exitCode=1;});
