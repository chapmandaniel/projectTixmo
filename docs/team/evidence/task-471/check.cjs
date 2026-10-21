'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
(async()=>{
 const revoked=Proxy.revocable({},{});revoked.revoke();
 const values=[null,undefined,'independent471',false,0,19n,Symbol('independent471'),Object.create(null),revoked.proxy,
 {get message(){throw 0},get stack(){throw null},get code(){throw undefined},[Symbol.toPrimitive](){throw Error('unprintable')}},
 {message:'',stack:'',code:17},new Error('ORIGINAL_ERROR471')];
 let cases=0;
 for(const path of ['teardown','evidence'])for(const [i,value]of values.entries())for(const primary of [0,61]){
  const r=launch(process.execPath,['-e',`console.error('QA471_STDERR_${path}_${i}_${primary}');process.exit(${primary})`],{env:{}});
  await r.closed;
  let cleanupCalls=0,evidenceCalls=0;
  const check=async()=>{assert.equal(r.child.exitCode,primary);assert.equal(fs.existsSync('/proc/'+r.child.pid),false);await assert.rejects(finish(r),/No live owned/);};
  const opts={teardown:async()=>{cleanupCalls++;await check();if(path==='teardown')throw value;},writeEvidence:async()=>{evidenceCalls++;await check();if(path==='evidence')throw value;}};
  let report,fail;
  try{report=await finish(r,opts)}catch(e){fail=e;report=e.report;}
  assert.equal(Boolean(fail),path==='teardown');assert.ok(report);
  assert.equal(report.result,r.result);assert.equal(report.result.code,primary);assert.equal(report.result.signal,null);assert.equal(report.timedOut,false);
  assert.equal(report[path==='teardown'?'teardownStatus':'evidenceStatus'],'failed');
  const diagnostic=report[path==='teardown'?'cleanupError':'evidenceError'];assert.equal(typeof diagnostic,'string');assert.ok(diagnostic.trim());
  if(i===11)assert.match(diagnostic,/ORIGINAL_ERROR471/);
  assert.equal(status(JSON.parse(JSON.stringify(report))),primary||1);
  assert.deepEqual([cleanupCalls,evidenceCalls],[1,1]);await assert.rejects(finish(r),/No live owned/);cases++;
 }
 console.log('PASS '+cases+' independent actual-owned closed/reaped cases: both callback paths/primary0+61, null undefined primitives revoked proxy hostile getters/unprintable empty diagnostic fields and real Error; report/JSON/status, ordering and one-shot retained');
})().catch(e=>{console.error(e);process.exitCode=1});
