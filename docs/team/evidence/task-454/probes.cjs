'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
let n=0; const pass=s=>console.log(`PASS ${++n} ${s}`);
(async()=>{
 for(const stubborn of [false,true]){
  const r=launch(process.execPath,['-e',stubborn?'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)':'setInterval(()=>{},1000)'],{env:{}});
  const v=await finish(r,{timeoutMs:300,graceMs:200,teardown(){assert(r.child.exitCode!==null||r.child.signalCode!==null);assert(!fs.existsSync('/proc/'+r.child.pid));}});
  assert(v.timedOut);assert.equal(v.result.signal,stubborn?'SIGKILL':'SIGTERM');pass('owned '+v.result.signal+' and direct reap before teardown');
  await assert.rejects(finish(r),/No live owned/);pass('sequential consumed capability denied');
 }
 const f=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 try {await assert.rejects(finish({child:f}),/No live owned/);process.kill(f.pid,0);assert.equal(f.signalCode,null);pass('foreign child denied and remains alive');}finally {const p=new Promise(r=>f.once('close',r));f.kill();await p;}
 const r=launch('/nonexistent-lead454-command',['lead454-argument'],{env:{}});
 await new Promise(resolve=>r.child.once('close',resolve));
 const v=await finish(r,{writeEvidence(){throw Error('LEAD454_ENOSPC');}});
 const j=JSON.parse(JSON.stringify(v));
 for(const k of ['name','message','stack','code','errno','syscall','path','spawnargs'])assert(Object.hasOwn(j.result.error,k));
 assert.equal(j.result.error.code,'ENOENT');assert.match(j.result.error.message,/nonexistent-lead454/);assert.deepEqual(j.result.error.spawnargs,['lead454-argument']);assert.equal(j.result.code,-2);assert.equal(j.result.signal,null);assert.equal(j.timedOut,false);assert.match(j.evidenceError,/LEAD454_ENOSPC/);pass('ENOENT close + JSON8fields + separate receipt failure');
 const e=launch(process.execPath,['-e','console.error("LEAD454_STDERR");process.exit(39)'],{env:{}});
 const ev=await finish(e,{writeEvidence(){throw Error('LEAD454_EXIT_ENOSPC');}});assert.equal(ev.result.code,39);assert.match(ev.evidenceError,/LEAD454_EXIT_ENOSPC/);pass('exit39 stderr and evidence failure preserved');
 const pre=require('../task-426/preflight.cjs');
 for(const k of ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD']){assert.throws(()=>pre.verify({[k]:'bad'}),/Ambient preload/);pass(k+' early denial');}
 assert.throws(()=>pre.verify({TASK426_EXPECTED_SHA:'0'.repeat(40)}),/exact executed/);pass('real wrong SHA denied before runtime path/native guard');
 assert.deepEqual(pre.validatePorts('2345,3456'),[2345,3456]);pass('canonical distinct port pair');
 for(const p of ['02345,2345','2345,03456','2345,2345','1023,3456','65536,3456','2345,3456,4567'])assert.throws(()=>pre.validatePorts(p),/owned service ports/);pass('six alias/range/malformed port denials');
 assert.equal(require('node:net')[Symbol.for('tixmo.task379.registerListener')],undefined);pass('no native guard installed by rejected preflights');
 // A genuine already-closed owned handle: two callers enter before capability deletion.
 const c=launch(process.execPath,['-e','process.exit(0)'],{env:{}});await new Promise(resolve=>c.child.once('close',resolve));
 let calls=0;let release;const gate=new Promise(resolve=>release=resolve);
 const first=finish(c,{teardown:async()=>{calls++;await gate;}});
 const second=finish(c,{teardown:async()=>{calls++;release();}});
 const both=await Promise.allSettled([first,second]);assert.equal(calls,2);assert(both.every(x=>x.status==='fulfilled'));
 console.log('REPRODUCED concurrent capability reuse: two finish calls accepted same handle; teardown called twice');
 console.log('TOTAL '+n+' checks PASS plus 1 reproduced defect');
})().catch(e=>{console.error(e);process.exitCode=1;});
