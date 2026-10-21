'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
let checks=0, children=0;
const pass=s=>console.log(`PASS ${++checks} ${s}`);
async function fixture(code){children++;const r=launch(process.execPath,['-e',`console.error('LEAD467_STDERR');process.exit(${code})`],{env:{}});await new Promise(resolve=>r.child.once('close',resolve));return r;}
function reaped(r){assert(!fs.existsSync(`/proc/${r.child.pid}`));assert.notEqual(r.child.exitCode,null);}
(async()=>{
 const r=await fixture(53);
 for(const key of ['timeoutMs','graceMs','teardownMs','evidenceMs'])for(const value of [null,undefined===null,NaN,Infinity,-Infinity,0,0.5,60001,'20',1n])await assert.rejects(finish(r,{[key]:value}),/integer/);
 pass('40 invalid timer options deny without consuming authority');
 let entered,release;const gate=new Promise(resolve=>entered=resolve);const held=new Promise(resolve=>release=resolve);let calls=0;
 const run=finish(r,{teardownMs:15,evidenceMs:15,teardown:()=>{reaped(r);entered();return held;},writeEvidence:async()=>{reaped(r);calls++;await assert.rejects(finish(r),/No live owned/);throw Error('SECONDARY467');}});
 await gate;await assert.rejects(finish(r),/No live owned/);let error;try{await run;}catch(e){error=e;}
 assert.equal(status(error.report),53);assert.equal(error.report.teardownStatus,'timed-out-pending-late-effects-possible');assert.match(error.report.evidenceError,/SECONDARY467/);assert.equal(calls,1);release();await new Promise(resolve=>setImmediate(resolve));await assert.rejects(finish(r),/No live owned/);
 pass('deadline/late settlement preserve53 and separate evidence error; reaped before callbacks, concurrent/reentrant/sequential denial');
 // Confirm rather than hide the adversarial failure. These assertions expect
 // the observed defect; a passing diagnostic script is NOT acceptance approval.
 for(const value of [null,undefined,'primitive467']){
  const c=await fixture(0);let caught,report;try{report=await finish(c,{writeEvidence:()=>{reaped(c);throw value;}});}catch(e){caught=e;}
  if(value==null){assert(caught instanceof TypeError);assert.equal(caught.report,undefined);console.log(`FINDING evidence rejection ${String(value)} escapes TypeError without primary report`);}
  else {assert.equal(report.evidenceStatus,'failed');assert.equal(report.evidenceError,undefined);assert.equal(status(report),0);console.log('FINDING evidence string rejection loses diagnostics and maps successful primary to exit0');}
  await assert.rejects(finish(c),/No live owned/);pass(`reproduced non-Error evidence defect ${String(value)} with reaped owned fixture`);
 }
 const c=await fixture(54);let caught;try{await finish(c,{teardown:()=>{reaped(c);return Promise.reject(null);}});}catch(e){caught=e;}
 assert(caught instanceof TypeError);assert.equal(caught.report.result.code,54);assert.match(caught.report.cleanupError,/Cannot read properties of null/);assert.equal(caught.report.teardownStatus,'pending');
 console.log('FINDING teardown null rejection reports stale pending and replaces original rejection with TypeError');pass('reproduced async teardown non-Error classification defect');
 console.log(`TOTAL ${checks} diagnostic groups PASS; ${children} owned direct children closed/reaped; 4 defect variants observed. NOT acceptance PASS.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
