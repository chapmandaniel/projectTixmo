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
