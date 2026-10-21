'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
let n=0; const pass=name=>console.log(`PASS ${++n} ${name}`);
const denied=p=>assert.rejects(p,/No live owned child authority/);
(async()=>{
 for(const stubborn of [false,true]) {
 const r=launch(process.execPath,['-e',stubborn?'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)':'setInterval(()=>{},1000)'],{env:{}});
 let teardowns=0,evidence=0,duplicate=0;
 const first=finish(r,{timeoutMs:300,graceMs:200,teardown:async()=>{teardowns++;assert(!fs.existsSync('/proc/'+r.child.pid));assert(r.child.exitCode!==null||r.child.signalCode!==null);await denied(finish(r,{teardown:()=>duplicate++,writeEvidence:()=>duplicate++}));},writeEvidence:async()=>{evidence++;await denied(finish(r,{teardown:()=>duplicate++,writeEvidence:()=>duplicate++}));}});
 await denied(finish(r,{teardown:()=>duplicate++,writeEvidence:()=>duplicate++}));
 const report=await first;assert.equal(report.timedOut,true);assert.equal(report.result.signal,stubborn?'SIGKILL':'SIGTERM');assert.deepEqual([teardowns,evidence,duplicate],[1,1,0]);pass(`live ${report.result.signal}: concurrent+bothcallback reentrancy denied, reap before teardown`);
 await denied(finish(r));pass('sequential reuse denied');
 }
 for(const phase of ['teardown','evidence']) {
 const r=launch(process.execPath,['-e','process.exit(28)'],{env:{}});await new Promise(resolve=>r.child.once('close',resolve));
 let enter,release,t=0,e=0,d=0;const entered=new Promise(resolve=>enter=resolve),gate=new Promise(resolve=>release=resolve);
 const options={teardown:async()=>{t++;if(phase==='teardown'){enter();await gate;}},writeEvidence:async()=>{e++;if(phase==='evidence'){enter();await gate;}}};
 const first=finish(r,options);await entered;
 await denied(finish(r,{teardown:()=>d++,writeEvidence:()=>d++}));release();const report=await first;
 assert.equal(report.result.code,28);assert.deepEqual([t,e,d],[1,1,0]);await denied(finish(r));pass(`closed real child held ${phase}, duplicate callbacks zero`);
 }
 const failed=launch(process.execPath,['-e','process.exit(29)'],{env:{}});await new Promise(resolve=>failed.child.once('close',resolve));
 let writes=0;await assert.rejects(finish(failed,{teardown:()=>{throw Error('teardown fixture');},writeEvidence:()=>{writes++;}}),/teardown fixture/);await denied(finish(failed));assert.equal(writes,1);pass('teardown failure consumes authority and evidence once');
 const foreign=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});try{await denied(finish({child:foreign}));process.kill(foreign.pid,0);assert.equal(foreign.signalCode,null);pass('foreign live child denied without signal');}finally{const closed=new Promise(resolve=>foreign.once('close',resolve));foreign.kill('SIGTERM');await closed;}
 const missing=launch('/task458-does-not-exist',['qa458'],{env:{}});await new Promise(resolve=>missing.child.once('close',resolve));const v=await finish(missing,{writeEvidence:()=>{throw Object.assign(Error('QA458_ENOSPC'),{code:'ENOSPC'});}});const j=JSON.parse(JSON.stringify(v));
 for(const k of ['name','message','stack','code','errno','syscall','path','spawnargs']) assert(Object.hasOwn(j.result.error,k));
 assert.match(j.result.error.message,/task458-does-not-exist/);assert.equal(j.result.error.code,'ENOENT');assert.equal(j.result.error.path,'/task458-does-not-exist');assert.deepEqual(j.result.error.spawnargs,['qa458']);assert.equal(j.result.code,-2);assert.equal(j.result.signal,null);assert.equal(j.timedOut,false);assert.match(j.evidenceError,/QA458_ENOSPC/);pass('real ENOENT after close: JSON8fields + primary status + separate ENOSPC');await denied(finish(missing));pass('evidence failure consumes authority');
 const exit=launch(process.execPath,['-e','console.error("QA458_STDERR_SENTINEL");process.exit(38)'],{env:{}});const report=await finish(exit,{writeEvidence:()=>{throw Error('QA458_EXIT_ENOSPC')}});assert.equal(report.result.code,38);assert.match(report.evidenceError,/QA458_EXIT_ENOSPC/);pass('exit38 + inherited stderr preserved despite evidence ENOSPC');
 console.log(`TOTAL ${n} independent checks PASS`);
})().catch(error=>{console.error(error);process.exitCode=1;});
