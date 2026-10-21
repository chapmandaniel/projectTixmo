import assert from 'node:assert/strict';
import { compose } from '../../../../scripts/market-composition.mjs';
import { steps } from '../../../../scripts/market-stages.mjs';
import { execFileSync } from 'node:child_process';
const original = execFileSync('git', ['show', 'fcab880ea7caf50493439a21032b7a93effc438f:scripts/verify-market-local.mjs'], { encoding: 'utf8' });
const text = original.slice(original.indexOf('const steps = [') + 'const steps = '.length, original.indexOf('\n\nconst run'));
assert.deepEqual(steps, Function('return '+text)());
assert.equal(steps.length,12);
async function trial(fail=-1, mutate=false, bad=false, cleanup=false) {
 const calls=[], records=[]; let changed=false,error;
 const open=kind=>async contract=>{calls.push('open:'+kind);return {contract:bad?{}:contract,async close(){calls.push('close:'+kind);if(cleanup)throw Error('cleanup');},async run(step){calls.push(step.name);const i=steps.findIndex(s=>s.name===step.name);if(mutate)changed=true;return {status:i===fail?9:0,stdout:'raw:'+i,stderr:''};}};};
 try{await compose({capture:()=>({source:changed?'changed':'candidate'}),openAudit:open('audit'),openLocal:open('local'),versions:{node:'stub',npm:'stub'},persist:async m=>records.push(m)});}catch(e){error=e;}
 return {calls,records,error};
}
const ok=await trial();assert.ifError(ok.error);
assert.deepEqual(ok.calls,['open:audit',...steps.slice(0,2).map(x=>x.name),'close:audit','open:local',...steps.slice(2).map(x=>x.name),'close:local']);
assert.equal(ok.records[0].receipts.length,12);assert.notEqual(ok.records[0].qualification,'PASS');
for(let i=0;i<12;i++){const r=await trial(i);assert(r.error);assert.equal(r.records[0].receipts.length,i+1);assert.equal(r.records[0].qualification,'INCOMPLETE');}
const stale=await trial(-1,true);assert.match(stale.error.message,/Candidate changed/);assert.equal(stale.records[0].receipts.length,1);
const denied=await trial(-1,false,true);assert(denied.error);assert.equal(denied.records[0].receipts.length,0);
const cleanup=await trial(-1,false,false,true);assert(cleanup.error);assert.equal(cleanup.records[0].qualification,'INCOMPLETE');
console.log('PASS offline: exact12/overrides, phase teardown, all12 failfast positions, stale source, boundary denial, cleanup failure. No network/runtime/services.');
// QA433 regressions: hostile result metadata and mutations during either
// side of the audit/local transition must not forge evidence/run stale source.
async function adversarial(mutation) {
 let changed=false, localRuns=0, receipt, error;
 const open=kind=>async contract=>{
  if(mutation==='admission'&&kind==='local')changed=true;
  return {contract,async close(){if(mutation==='teardown'&&kind==='audit')changed=true;},async run(step){
   if(kind==='local')localRuns++;
   step.args.push('malicious-step-mutation');
   return {status:0,stdout:'real raw',stderr:'real stderr',index:999,phase:'forged',name:'forged',command:'evil',args:['evil'],environment:{EVIL:'yes'},started:'forged',finished:'forged',stdoutHash:'forged'};
  }};
 };
 try{await compose({capture:()=>({source:changed?'mutated':'original'}),openAudit:open('audit'),openLocal:open('local'),versions:{node:'stub',npm:'stub'},now:()=> 'canonical-time',persist:async m=>{receipt=m;}});}catch(e){error=e;}
 return {receipt,error,localRuns};
}
const forged=await adversarial();assert.ifError(forged.error);
for(let i=0;i<12;i++){
 const r=forged.receipt.receipts[i],s=steps[i];
 assert.equal(r.index,i+1);assert.equal(r.phase,i<2?'audit':'local');
 for(const key of ['name','command','args','environment'])assert.deepEqual(r[key],s[key]);
 assert.equal(r.started,'canonical-time');assert.equal(r.finished,'canonical-time');
 assert.notEqual(r.stdoutHash,'forged');assert.equal(r.stdout,'real raw');
}
for(const when of ['teardown','admission']){const r=await adversarial(when);assert.match(r.error.message,/Candidate changed/);assert.equal(r.localRuns,0);assert.equal(r.receipt.qualification,'INCOMPLETE');assert.equal(r.receipt.receipts.length,2);}
console.log('PASS QA433 regression: canonical receipts reject all12 forged identities/step mutations; teardown/admission source mutation yields zero local runs.');
