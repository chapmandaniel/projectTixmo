import a from 'node:assert/strict';
import {localPhaseOpener} from '../../../../scripts/market-local-phase.mjs';
import {boundaries,compose} from '../../../../scripts/market-composition.mjs';
import {steps} from '../../../../scripts/market-stages.mjs';
const id={sha:'independent464'},clone=x=>structuredClone(x);let checks=0;const pass=s=>console.log(`PASS ${++checks} ${s}`);
function fixture({deny,cleanupFail=false,spawnFail=false}={}){
 let drift=false,acquires=0,closed=0,spawns=0,stage=0;const checks={native:0,provenance:0,owned:0};
 let gate;const hold=new Promise(r=>gate=r);let holding=false;
 const capture=()=>drift?{}:clone(id);
 const runtime={env:{SAFE:'fixed'},close:async()=>{closed++;if(cleanupFail)throw Error('cleanup464');}};
 for(const type of ['native','provenance','owned'])runtime[{native:'assertNativeAdmission',provenance:'assertProvenance',owned:'assertOwnedRuntime'}[type]]=async()=>{checks[type]++;if(holding&&type==='native')await hold;if(deny?.(type,checks[type]))throw Error(type+'464');};
 const calls=[];const open=localPhaseOpener({root:'/offline464',capture,acquire:async()=>{acquires++;return runtime;},spawn:(command,args,options)=>{spawns++;calls.push({command,args,options});if(spawnFail)throw Error('spawn464');return {status:0,stdout:'\0actual-stub',stderr:'é'};}});
 return {open,runtime,capture,checks,calls,drift:()=>{drift=true;},hold:()=>{holding=true;},release:gate,get acquired(){return acquires;},get closed(){return closed;},get spawns(){return spawns;}};
}
await a.rejects(localPhaseOpener({capture:()=>id})(boundaries.local,id),/unavailable/);pass('missing provider denies');
{const f=fixture();await a.rejects(f.open({...boundaries.local,extra:true},id),/Unexpected/);f.drift();await a.rejects(f.open(boundaries.local,id),/changed/);a.equal(f.acquired,0);pass('invalid contract and source drift before acquisition deny with zero acquisition');}
{const f=fixture();f.runtime.assertNativeAdmission=true;await a.rejects(f.open(boundaries.local,id),/verifiers/);a.equal(f.closed,1);a.equal(f.spawns,0);pass('boolean admission rejected and acquired ownership cleaned once');}
for(const type of ['native','provenance','owned']){
 const f=fixture({deny:(t,n)=>t===type&&n===1});await a.rejects(f.open(boundaries.local,id),new RegExp(type+'464'));a.equal(f.closed,1);a.equal(f.spawns,0);pass(`admission ${type} denial cleans acquired owner before any child`);
 const g=fixture({deny:(t,n)=>t===type&&n===2});const s=await g.open(boundaries.local,id);await a.rejects(s.run(clone(steps[2])),new RegExp(type+'464'));await Promise.all([s.close(),s.close()]);a.equal(g.closed,1);a.equal(g.spawns,0);pass(`per-stage ${type} revocation denies before child; concurrent close once`);
}
{const f=fixture({cleanupFail:true,deny:t=>t==='native'});const err=await f.open(boundaries.local,id).catch(e=>e);a.match(err.message,/cleanup464/);a.match(err.admissionFailure.message,/native464/);a.equal(f.closed,1);pass('admission plus cleanup failure both preserved');}
{const f=fixture();const s=await f.open(boundaries.local,id);f.hold();const running=s.run(clone(steps[2]));await a.rejects(s.run(clone(steps[2])),/noncanonical/);await a.rejects(s.close(),/active/);a.equal(f.closed,0);f.drift();f.release();await a.rejects(running,/changed/);a.equal(f.spawns,0);await Promise.all([s.close(),s.close()]);a.equal(f.closed,1);pass('held admission denies overlapping run/close; post-await drift zero child, later cleanup once');}
{const f=fixture({spawnFail:true});const s=await f.open(boundaries.local,id);const r=await s.run(clone(steps[2]));a.equal(r.status,-1);a.equal(r.error,'spawn464');await a.rejects(s.run(clone(steps[3])),/noncanonical/);await s.close();a.equal(f.closed,1);pass('spawn throw mapped, subsequent command denied, cleanup once');}
{const f=fixture({cleanupFail:true});const s=await f.open(boundaries.local,id);const r=await Promise.allSettled([s.close(),s.close(),s.close()]);a.ok(r.every(x=>x.status==='rejected'));a.equal(f.closed,1);await a.rejects(s.run(clone(steps[2])),/noncanonical/);pass('rejected concurrent cleanup is retained and cannot restart stages');}
{const f=fixture();const s=await f.open(boundaries.local,id);await a.rejects(s.run({...clone(steps[2]),command:'unexpected'}),/noncanonical/);for(const step of steps.slice(2))await s.run(clone(step));a.equal(f.spawns,10);a.deepEqual(f.calls.map(c=>[c.command,c.args]),steps.slice(2).map(c=>[c.command,c.args]));a.deepEqual(f.checks,{native:11,provenance:11,owned:11});await s.close();pass('all exact ten canonical commands and each of three verifiers repeated at every stage');}
{const f=fixture();let auditClosed=0,stored;const manifest=await compose({capture:f.capture,versions:{node:'stub',npm:'stub'},openAudit:async contract=>({contract,run:async()=>({status:0,stdout:'a',stderr:''}),close:async()=>{auditClosed++;}}),openLocal:f.open,persist:async m=>{stored=m;return{committed:true,durabilityConfirmed:true};}});a.equal(stored.receipts.length,12);a.equal(auditClosed,1);a.equal(f.closed,1);a.equal(manifest.qualification,'SOURCE_CORE_COMPLETED_NOT_QUALIFIED');pass('compose uses bridge across exact12 and reports not qualified');}
console.log(`TOTAL ${checks} independent offline checks PASS; stubs only, no subprocess/application/socket/service`);
