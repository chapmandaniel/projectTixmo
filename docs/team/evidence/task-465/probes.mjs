import assert from 'node:assert/strict';
import {localPhaseOpener} from '../../../../scripts/market-local-phase.mjs';
import {compose,boundaries} from '../../../../scripts/market-composition.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
const id={sha:'offline465'}; let checks=0;
const pass=name=>{checks++;console.log(`PASS ${checks} ${name}`)};
function fixture({deny,fail=-1,cleanup=false}={}) {
 const state={spawn:[],close:0,counts:[0,0,0],drift:false,revoked:false};
 const runtime={env:{ONLY:'owned'},close:async()=>{state.close++;if(cleanup)throw Error('cleanup465')}};
 ['assertNativeAdmission','assertProvenance','assertOwnedRuntime'].forEach((key,i)=>runtime[key]=async()=>{state.counts[i]++;if(deny===i||state.revoked===i)throw Error(`deny465-${i}`)});
 const open=localPhaseOpener({capture:()=>state.drift?{}:id,acquire:async()=>runtime,spawn:(command,args,options)=>{state.spawn.push({command,args,options});return {status:state.spawn.length-1===fail?8:0,stdout:'raw\0',stderr:'é'}}});
 return {state,runtime,open};
}
await assert.rejects(localPhaseOpener({capture:()=>id})(boundaries.local,id),/unavailable/);pass('missing provider');
{
 const original=Error('acquisition465');let acquired=0;
 await assert.rejects(localPhaseOpener({capture:()=>id,acquire:async()=>{acquired++;throw original}})(boundaries.local,id),e=>e===original);assert.equal(acquired,1);pass('acquire rejection preserves original; provider rollback remains provider responsibility');
}
{
 const f=fixture();f.state.drift=true;await assert.rejects(f.open(boundaries.local,id),/changed/);assert.equal(f.state.close,0);pass('preacquire drift denies before acquisition');
}
{
 const f=fixture();f.runtime.assertProvenance=true;await assert.rejects(f.open(boundaries.local,id),/verifiers/);assert.equal(f.state.close,1);pass('boolean provider fails closed and cleans');
}
for(let i=0;i<3;i++){
 const f=fixture({deny:i});await assert.rejects(f.open(boundaries.local,id),new RegExp(`deny465-${i}`));assert.equal(f.state.close,1);assert.equal(f.state.spawn.length,0);pass(`admission verifier ${i} cleanup`);
 const g=fixture();const s=await g.open(boundaries.local,id);g.state.revoked=i;await assert.rejects(s.run(steps[2]),new RegExp(`deny465-${i}`));await Promise.all([s.close(),s.close()]);assert.equal(g.state.close,1);assert.equal(g.state.spawn.length,0);pass(`stage verifier ${i} revocation`);
}
{
 const f=fixture({deny:1,cleanup:true});await assert.rejects(f.open(boundaries.local,id),e=>e.message==='cleanup465'&&e.admissionFailure.message==='deny465-1');assert.equal(f.state.close,1);pass('admission plus cleanup retains original diagnostics');
}
{
 const f=fixture();const s=await f.open(boundaries.local,id);let release,entered;
 const held=new Promise(r=>entered=r);f.runtime.assertNativeAdmission=async()=>{entered();await new Promise(r=>release=r)};
 const pending=s.run(steps[2]);await held;await assert.rejects(s.run(steps[2]),/noncanonical/);await assert.rejects(s.close(),/active/);assert.equal(f.state.close,0);f.state.drift=true;release();await assert.rejects(pending,/changed/);await s.close();assert.equal(f.state.close,1);assert.equal(f.state.spawn.length,0);pass('held verifier overlap and postawait source drift');
}
{
 const f=fixture({cleanup:true});const s=await f.open(boundaries.local,id);const result=await Promise.allSettled([s.close(),s.close(),s.close()]);assert(result.every(r=>r.status==='rejected'&&r.reason.message==='cleanup465'));assert.equal(f.state.close,1);await assert.rejects(s.run(steps[2]));pass('concurrent failed cleanup once and closed cannot restart');
}
for(let fail=-1;fail<10;fail++){
 const f=fixture({fail});let saved,auditClose=0;
 const run=compose({capture:()=>id,versions:{node:'stub',npm:'stub'},openAudit:async contract=>({contract,run:async()=>({status:0,stdout:'',stderr:''}),close:async()=>auditClose++}),openLocal:f.open,persist:async m=>{saved=m;return {committed:true,durabilityConfirmed:true}}});
 if(fail<0)assert.equal((await run).qualification,'SOURCE_CORE_COMPLETED_NOT_QUALIFIED');else await assert.rejects(run,/stage failed/);
 assert.equal(f.state.close,1);assert.equal(auditClose,1);assert.equal(f.state.spawn.length,fail<0?10:fail+1);assert.equal(saved.receipts.length,f.state.spawn.length+2);
 assert.deepEqual(f.state.spawn.map(({command,args})=>({command,args})),steps.slice(2,2+f.state.spawn.length).map(({command,args})=>({command,args})));
 if(fail<0){assert.deepEqual(f.state.counts,[11,11,11]);assert.equal(saved.qualification,'SOURCE_CORE_COMPLETED_NOT_QUALIFIED')}
 pass(`compose ${fail<0?'exact12 and verifier11calls':'local failfast '+fail} cleanup once`);
}
{
 const f=fixture({fail:0,cleanup:true});let saved;
 await assert.rejects(compose({capture:()=>id,versions:{node:'stub',npm:'stub'},openAudit:async contract=>({contract,run:async()=>({status:0,stdout:'',stderr:''}),close:async()=>{}}),openLocal:f.open,persist:async m=>{saved=m;return {committed:true,durabilityConfirmed:true}}}),/cleanup465/);
 assert.match(saved.failure,/stage failed/);assert.equal(saved.cleanupFailure,'cleanup465');assert.equal(saved.qualification,'INCOMPLETE');assert.equal(f.state.close,1);pass('stage failure and cleanup failure both retained in evidence');
}
console.log(`TOTAL ${checks} checks PASS; all spawn functions inert, no children/services/network`);
