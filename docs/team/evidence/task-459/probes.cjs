'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
let checks=0; const pass=s=>{checks++;console.log('PASS '+s);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const gone=r=>{assert.notEqual(r.child.exitCode===null&&r.child.signalCode===null,true);assert.equal(fs.existsSync(`/proc/${r.child.pid}`),false);};
(async()=>{
 for(const stubborn of [false,true]){
  const record=launch(process.execPath,['-e',stubborn?"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)":"setInterval(()=>{},1000)"],{env:{}});
  await sleep(140);
  let td=0,ev=0,nested=0;
  const opts={teardown:()=>{nested++;},writeEvidence:()=>{nested++;}};
  const original=finish(record,{timeoutMs:60,graceMs:180,teardown:async()=>{gone(record);td++;await assert.rejects(finish(record,opts),/No live owned/);},writeEvidence:async()=>{ev++;await assert.rejects(finish(record,opts),/No live owned/);}});
  await assert.rejects(finish(record,opts),/No live owned/);
  const report=await original;
  assert.equal(report.timedOut,true);assert.equal(report.result.signal,stubborn?'SIGKILL':'SIGTERM');assert.deepEqual([td,ev,nested],[1,1,0]);gone(record);
  await assert.rejects(finish(record),/No live owned/);
  pass((stubborn?'KILL':'TERM')+' live simultaneous denial, both reentrant callbacks once, direct reap before teardown, sequential denial');
 }
 for(const hold of ['teardown','writeEvidence']){
  const r=launch(process.execPath,['-e','process.exit(29)'],{env:{}});await new Promise(resolve=>r.child.once('close',resolve));
  let release,enter;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>enter=resolve);let td=0,ev=0,nested=0;
  const p=finish(r,{teardown:async()=>{td++;gone(r);if(hold==='teardown'){enter();await gate;}},writeEvidence:async()=>{ev++;if(hold==='writeEvidence'){enter();await gate;}}});
  await entered;try{await assert.rejects(finish(r,{teardown:()=>nested++,writeEvidence:()=>nested++}),/No live owned/);}finally{release();}
  assert.equal((await p).result.code,29);assert.deepEqual([td,ev,nested],[1,1,0]);await assert.rejects(finish(r),/No live owned/);pass('closed child held '+hold+' overlapping finish denied with callbacks once');
 }
 const foreign=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 try{await assert.rejects(finish({child:foreign}),/No live owned/);assert.equal(foreign.exitCode,null);process.kill(foreign.pid,0);pass('foreign live PID denied without signal');}finally{const closed=new Promise(resolve=>foreign.once('close',resolve));foreign.kill();await closed;assert.equal(fs.existsSync(`/proc/${foreign.pid}`),false);}
 const missing=launch('/task459-missing-executable',['arg459'],{env:{}});await new Promise(resolve=>missing.child.once('close',resolve));
 const receipt=JSON.parse(JSON.stringify(await finish(missing,{writeEvidence:()=>{throw new Error('ENOSPC459');}})));
 for(const key of ['name','message','stack','code','errno','syscall','path','spawnargs'])assert.ok(Object.hasOwn(receipt.result.error,key));
 assert.equal(receipt.result.error.code,'ENOENT');assert.match(receipt.result.error.message,/task459-missing/);assert.deepEqual(receipt.result.error.spawnargs,['arg459']);assert.equal(receipt.result.code,-2);assert.equal(receipt.result.signal,null);assert.equal(receipt.timedOut,false);assert.match(receipt.evidenceError,/ENOSPC459/);await assert.rejects(finish(missing),/No live owned/);pass('real ENOENT eight serialized fields, close and evidence failure retained; consumed on evidence failure');
 const bad=launch(process.execPath,['-e','console.error("LEAD459_STDERR");process.exit(39)'],{env:{}});
 const report=await finish(bad,{timeoutMs:1000,writeEvidence:()=>{throw new Error('receipt459');}});assert.equal(report.result.code,39);assert.match(report.evidenceError,/receipt459/);gone(bad);pass('exit39 stderr and separate evidence error retained');
 const failed=launch(process.execPath,['-e','process.exit(0)'],{env:{}});await new Promise(resolve=>failed.child.once('close',resolve));let evidence=0;
 await assert.rejects(finish(failed,{teardown:()=>{gone(failed);throw new Error('teardown459');},writeEvidence:r=>{evidence++;assert.equal(r.result.code,0);assert.match(r.cleanupError,/teardown459/);}}),/teardown459/);assert.equal(evidence,1);await assert.rejects(finish(failed),/No live owned/);pass('teardown failure consumes authority and evidence once');
 console.log('TOTAL '+checks+' independent checks PASS; all direct children reaped');
})().catch(e=>{console.error(e);process.exitCode=1;});
