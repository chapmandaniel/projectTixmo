'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
let checks=0;const pass=s=>console.log(`PASS ${++checks} ${s}`);
async function child(code){const r=launch(process.execPath,['-e',`console.error('QA466_PRIMARY_STDERR');process.exit(${code})`],{env:{}});await new Promise(resolve=>r.child.once('close',resolve));return r}
function reaped(r){assert.equal(fs.existsSync(`/proc/${r.child.pid}`),false);assert.notEqual(r.child.exitCode,null)}
(async()=>{
 const r=await child(49);
 for(const name of ['timeoutMs','graceMs','teardownMs','evidenceMs']){
  for(const value of [0,-1,1.1,60001,NaN,Infinity,'1',null])await assert.rejects(finish(r,{[name]:value}),/integer in 1..60000/);
  pass(`${name}: eight invalid values deny without consuming authority`);
 }
 for(const opts of [{teardown:true},{writeEvidence:null}])await assert.rejects(finish(r,opts),/functions/);pass('invalid callbacks do not consume authority');
 const set=global.setTimeout,clear=global.clearTimeout;const pending=new Set();let scheduled=0,cleared=0;
 global.setTimeout=(fn,ms,...args)=>{const handle=set(fn,ms,...args);pending.add(handle);scheduled++;return handle};
 global.clearTimeout=handle=>{if(pending.delete(handle))cleared++;return clear(handle)};
 try{
  const report=await finish(r,{timeoutMs:1,graceMs:60000,teardownMs:1,evidenceMs:60000,teardown:()=>reaped(r),writeEvidence:()=>reaped(r)});
  assert.equal(report.result.code,49);assert.equal(status(report),49);assert.equal(report.teardownStatus,'completed');assert.equal(report.evidenceStatus,'completed');
  assert.equal(scheduled,2);assert.equal(cleared,2);assert.equal(pending.size,0);pass('inclusive1..60000 accepted and both successful callback timers cleared');
 }finally{global.setTimeout=set;global.clearTimeout=clear}
 await assert.rejects(finish(r),/No live owned/);pass('successful completion one-shot');
 {
  const c=await child(50);let release,entered;const gate=new Promise(resolve=>entered=resolve);let calls=0,duplicates=0,seen;
  const start=Date.now();const run=finish(c,{teardownMs:20,evidenceMs:20,teardown:async()=>{calls++;reaped(c);entered();await assert.rejects(finish(c,{teardown:()=>duplicates++}),/No live owned/);return new Promise(resolve=>release=resolve)},writeEvidence:report=>{reaped(c);seen=report;throw Error('EVIDENCE466')}});
  await gate;await assert.rejects(finish(c),/No live owned/);let failure;try{await run}catch(e){failure=e}
  assert.equal(failure.code,'CALLBACK_DEADLINE');assert.equal(failure.report.result.code,50);assert.match(failure.report.cleanupError,/Teardown callback deadline/);assert.match(failure.report.evidenceError,/EVIDENCE466/);assert.equal(seen,failure.report);assert.equal(failure.report.teardownStatus,'timed-out-pending-late-effects-possible');assert.equal(failure.report.evidenceStatus,'failed');assert.equal(status(failure.report),50);assert.equal(calls,1);assert.equal(duplicates,0);assert(Date.now()-start<1000);pass('bounded teardown primary50 plus separate evidence failure and reentrant/concurrent denial');
  let late=false;release();await new Promise(resolve=>setImmediate(()=>{late=true;resolve()}));assert(late);assert.equal(failure.report.teardownStatus,'timed-out-pending-late-effects-possible');pass('late callback settlement does not relabel timeout as completion');
 }
 {
  const c=await child(0);let rejectLater,entered;const gate=new Promise(resolve=>entered=resolve);const run=finish(c,{evidenceMs:20,writeEvidence:async()=>{reaped(c);entered();await assert.rejects(finish(c),/No live owned/);return new Promise((_,reject)=>rejectLater=reject)}});
  await gate;await assert.rejects(finish(c),/No live owned/);const report=await run;assert.equal(report.evidenceStatus,'timed-out-pending-late-effects-possible');assert.equal(report.result.code,0);assert.equal(status(report),1);pass('pending evidence bounded with fallback1 and both concurrency/reentrancy denied');
  rejectLater(Error('LATE466'));await new Promise(resolve=>setImmediate(resolve));pass('late rejection handled without unhandled rejection');
 }
 {
  const c=await child(51);const set=global.setTimeout,clear=global.clearTimeout;const timers=new Set();let clears=0;
  global.setTimeout=(fn,ms)=>{const t=set(fn,ms);timers.add(t);return t};global.clearTimeout=t=>{if(timers.delete(t))clears++;clear(t)};
  try{let error;try{await finish(c,{teardown:()=>{reaped(c);throw Error('PRIMARY_TEARDOWN466')},writeEvidence:async()=>{reaped(c);throw Error('SECONDARY_EVIDENCE466')}})}catch(e){error=e}
   assert.equal(error.message,'PRIMARY_TEARDOWN466');assert.equal(error.report.result.code,51);assert.match(error.report.evidenceError,/SECONDARY_EVIDENCE466/);assert.equal(clears,2);assert.equal(timers.size,0);pass('sync teardown throw and async evidence rejection clear both timers and retain errors');
  }finally{global.setTimeout=set;global.clearTimeout=clear}
 }
 console.log(`TOTAL ${checks} checks PASS; all four direct owned children closed/reaped; no services/network`);
})().catch(e=>{console.error(e);process.exitCode=1});
