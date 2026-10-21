'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
let total=0;const pass=x=>console.log('PASS '+(++total)+' '+x);
(async()=>{
 for(const stubborn of [false,true]){
  const r=launch(process.execPath,['-e',stubborn?'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)':'setInterval(()=>{},1000)'],{env:{}});
  let teardown=false;
  const report=await finish(r,{timeoutMs:180,graceMs:100,teardown(){assert(r.result);assert.equal(fs.existsSync('/proc/'+r.child.pid),false);teardown=true;}});
  assert(report.timedOut);assert(teardown);assert.equal(report.result.signal,stubborn?'SIGKILL':'SIGTERM');pass('real owned '+(stubborn?'stubborn SIGKILL':'cooperative TERM')+' timeout/reap before teardown');
  await assert.rejects(finish(r),/No live owned/);pass('consumed capability cannot repeat teardown');
 }
 const foreign=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 try{await assert.rejects(finish({child:foreign,identity:{pid:foreign.pid}}),/No live owned/);assert.equal(foreign.exitCode,null);process.kill(foreign.pid,0);pass('foreign live PID authority rejected/no signal');}finally{const closed=new Promise(r=>foreign.once('close',r));foreign.kill();await closed;}
 const r=launch(process.execPath,['-e','console.error("QA451_ORIGINAL_STDERR");process.exit(37)'],{env:{}});
 const report=await finish(r,{timeoutMs:1000,writeEvidence(){throw Error('QA451_ENOSPC');}});assert.equal(report.result.code,37);assert.match(report.evidenceError,/QA451_ENOSPC/);pass('original exit37 retained alongside evidence failure');
 const failure=launch('/nonexistent-qa451-command',[],{env:{}});
 const failed=await finish(failure,{timeoutMs:1000});
 assert.equal(failed.result.error,undefined);console.log('REPRODUCED DEFECT original ENOENT diagnostic lost: '+JSON.stringify(failed));
 assert(failed.result.error||failed.result.code!==0);pass('spawn failure not marked success');
 // Isolate preflight contract fixture checks; substitutions are NOT genuine admission.
 const provenance=require('../task-426/provenance.cjs'),paths=require('../task-426/runtime-path.cjs');
 const ov=provenance.verify,op=paths.validate;provenance.verify=()=>({fixture:true});paths.validate=()=>{};
 const verify=require('../task-426/preflight.cjs').verify;
 try{
  for(const k of ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD']){assert.throws(()=>verify({[k]:'bad'}),/Ambient preload/);pass(k+' denial');}
  for(const ports of ['', '1023,2345','65536,2345','1234,1234','1234','1234,abc']){assert.throws(()=>verify({TASK379_ALLOWED_PORTS:ports}),/two exact/);pass('port denial '+JSON.stringify(ports));}
  process.env.TASK379_ALLOWED_PORTS='2345,3456';verify(process.env);pass('fixture preflight installs native guard');
  assert.throws(()=>require('node:net').connect({host:'example.invalid',port:443}),/rejected/);assert.throws(()=>require('node:dgram').createSocket('udp4'),/forbids/);pass('native guard denies nonowned TCP/UDP before socket calls');
  let accepted=false;try{verify({TASK379_ALLOWED_PORTS:'02345,2345'});accepted=true;}catch{}assert.equal(accepted,true);console.log('REPRODUCED DEFECT duplicate numeric port accepted='+accepted);
 }finally{provenance.verify=ov;paths.validate=op;}
 console.log('TOTAL '+total+' independent checks PASS; observations require review');
})().catch(e=>{console.error(e);process.exitCode=1;});
