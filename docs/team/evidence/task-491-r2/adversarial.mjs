import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('tdash/src/features/EventSalesControl.jsx','utf8');
const h=await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('tdash/src/lib/salesPause.js')).toString('base64')}`);
const body=source.split('const submit = async (paused) => {')[1].split('\n    };')[0];
const resetBody=source.split('// A newer authoritative snapshot invalidates completion of an older request.')[1].split('\n    }, [event, user]);')[0];
const discardBody=source.split('onClick={() => {\n            ')[1].split('\n        }}>Discard')[0];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function make(commit){
 const event={id:'e',salesPaused:false},user={id:'u',role:'OWNER'};
 const state={writes:0,updates:[],discard:false};
 const p={event,user,latest:{current:{event,user}},mounted:{current:true},request:{current:null},inFlight:{current:false},reason:' incident ',api:{},crypto:{randomUUID:()=>`key${++state.keys}`},...h,commitSalesPause:commit,setBusy:x=>{state.busy=x;state.writes++},setMessage:x=>{state.message=x;state.writes++},setCanDiscard:x=>{state.discard=x;state.writes++},setReason:x=>{state.reason=x;state.writes++},onUpdate:x=>state.updates.push(x)};
 state.keys=0;
 return {p,state,submit:()=>new AsyncFunction(...Object.keys(p),'paused',body)(...Object.values(p),true),reset:()=>new Function(...Object.keys(p),resetBody)(...Object.values(p)),discard:()=>new Function(...Object.keys(p),discardBody)(...Object.values(p))};
}
const http=status=>Object.assign(Error('failure'),{response:{status}});
for(const status of [400,401,403,404,409,422]){
 let calls=0;const x=make(async()=>{calls++;throw http(status)});await x.submit();assert(x.state.discard);const first=x.p.request.current;x.discard();assert.equal(calls,1);assert.equal(x.p.request.current,null);assert.equal(x.state.updates.length,0);await x.submit();assert.notEqual(x.p.request.current.requestId,first.requestId);
}console.log('PASS 1 all definitive codes explicit discard is local-only, new explicit action new key');
for(const error of [Error('network'),http(408),http(429),http(500),http(503)]){
 const seen=[];const x=make(async(a,id,r)=>{seen.push(r);throw error});await x.submit();await x.submit();assert.equal(seen[0],seen[1]);assert.equal(seen[0].reason,'incident');assert(!x.state.discard);
}console.log('PASS 2 ambiguous transport/timeout/rate-limit/server failures retain same identity');
let posts=0;const x=make((a,id,r)=>h.commitSalesPause({post:async()=>{posts++;return {data:{eventId:id,requestId:r.requestId,salesPaused:r.paused}}},get:async()=>{throw http(403)}},id,r));
await x.submit();assert(!x.state.discard);assert.match(x.state.message,/acknowledged.*refreshed/);assert.equal(x.state.updates.length,0);const retained=x.p.request.current;await x.submit();assert.equal(x.p.request.current,retained);assert.equal(posts,2);
console.log('PASS 3 post-commit GET403 remains ambiguous; no discard or false current success');
for(const invalidation of ['event','user','unmount']){
 let reject;const y=make(()=>new Promise((r,j)=>reject=j));const wait=y.submit();const before=y.state.writes;if(invalidation==='unmount')y.p.mounted.current=false;else y.p.latest.current={...y.p.latest.current,[invalidation]:{...y.p.latest.current[invalidation]}};reject(http(409));await wait;assert.equal(y.state.writes,before);assert(!y.state.discard);assert.equal(y.state.updates.length,0);
}console.log('PASS 4 stale rejection suppressed for same-id snapshot/user replacement and unmount');
let completeA,completeB;let n=0;const race=make(()=>new Promise(r=>{if(++n===1)completeA=r;else completeB=r}));
const a=race.submit();const key=race.p.request.current;race.p.latest.current={...race.p.latest.current,event:{id:'e',salesPaused:true}};race.reset();const b=race.submit();assert.equal(race.p.request.current,key);completeA({id:'e',salesPaused:false});await a;assert(race.p.inFlight.current);assert.equal(race.state.updates.length,0);completeB({id:'e',salesPaused:true});await b;assert.equal(race.state.updates.length,1);assert.equal(race.state.updates[0].salesPaused,true);assert(!race.state.busy);
console.log('PASS 5 overlapping same-key retry: older completion cannot unlock newer or propagate stale state');
let resolve;let calls=0;const locked=make(()=>{calls++;return new Promise(r=>resolve=r)});const pending=locked.submit();await locked.submit();assert.equal(calls,1);resolve({id:'e',salesPaused:true});await pending;assert.equal(locked.p.request.current,null);
console.log('PASS 6 synchronous in-flight guard prevents duplicate dispatch');
const fresh={id:'e',salesPaused:false};const ok=make(async()=>fresh);await ok.submit();assert.equal(ok.state.updates[0],fresh);assert.match(ok.state.message,/not paused/);assert.equal(ok.state.keys,1);assert.equal(ok.p.request.current,null);
console.log('PASS 7 current refreshed snapshot identity propagated, not desired historical pause');
assert(source.includes('const current = event;'));assert(!source.includes('useState(event)'));const ecc=fs.readFileSync('tdash/src/features/EventCommandCenter.jsx','utf8');assert(ecc.includes('key={`${event.id}:${user?.id}:${user?.role}`}'));assert(ecc.includes('onUpdate={onUpdate}'));
console.log('PASS 8 authoritative props/actor key/parent callback static wiring');
