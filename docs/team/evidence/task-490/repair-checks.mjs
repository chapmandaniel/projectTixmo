import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync('tdash/src/features/EventSalesControl.jsx','utf8');
const helper=await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('tdash/src/lib/salesPause.js')).toString('base64')}`);
const {isDefinitiveSalesControlFailure,isCurrentSalesControlResult}=helper;
for(const status of [400,401,403,404,409,422])assert(isDefinitiveSalesControlFailure({response:{status}}));
for(const error of [{},{response:{status:500}},{response:{status:503}}])assert(!isDefinitiveSalesControlFailure(error));
const body=src.split('const submit = async (paused) => {')[1].split('\n    };')[0];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function make(commit) {
 const event={id:'e',salesPaused:false},user={id:'u'};
 const state={busy:false,message:'',discard:false,updates:[],writes:0};
 const ports={event,user,latest:{current:{event,user}},mounted:{current:true},request:{current:null},inFlight:{current:false},reason:'incident',api:{},crypto:{randomUUID:()=> 'same-uuid'},isCurrentSalesControlResult,isDefinitiveSalesControlFailure,commitSalesPause:commit,
 setBusy:x=>{state.busy=x;state.writes++},setMessage:x=>{state.message=x;state.writes++},setCanDiscard:x=>{state.discard=x;state.writes++},setReason:()=>{state.writes++},onUpdate:x=>state.updates.push(x)};
 return {ports,state,submit:new AsyncFunction(...Object.keys(ports),'paused',body).bind(null,...Object.values(ports))};
}
for(const status of [403,409]){
 const x=make(async()=>{throw Object.assign(Error('rejected'),{response:{status}})});
 await x.submit(true);assert(x.state.discard);assert.equal(x.state.updates.length,0);assert(!x.state.message.includes('acknowledged'));
 // Execute the actual discard handler, with inert state ports.
 const discard=src.split('request.current = null; setCanDiscard(false); setReason(\'\'); setMessage(\'Request discarded.')[1];assert(discard);
 const handler=src.split('onClick={() => {\n            ')[1].split('\n        }}>Discard')[0];
 new Function(...Object.keys(x.ports),handler)(...Object.values(x.ports));
 assert.equal(x.ports.request.current,null);assert(!x.state.discard);assert.equal(x.state.updates.length,0);
}
let identities=[];const ambiguous=make(async(api,id,request)=>{identities.push(request);throw Error('offline')});
await ambiguous.submit(true);await ambiguous.submit(false);assert.equal(identities[0],identities[1]);assert.equal(identities[1].paused,true);assert(!ambiguous.state.discard);
for(const invalidation of ['unmount','event','user']){
 let release;const x=make(()=>new Promise(resolve=>release=resolve));const pending=x.submit(true);const before=x.state.writes;
 if(invalidation==='unmount')x.ports.mounted.current=false;
 if(invalidation==='event')x.ports.latest.current={...x.ports.latest.current,event:{id:'e',salesPaused:true}};
 if(invalidation==='user')x.ports.latest.current={...x.ports.latest.current,user:{id:'other'}};
 release({id:'e',salesPaused:true});await pending;assert.equal(x.state.writes,before);assert.equal(x.state.updates.length,0);
}
const fresh={id:'e',salesPaused:false};const success=make(async()=>fresh);await success.submit(true);assert.equal(success.state.updates[0],fresh);assert.equal(success.ports.request.current,null);assert(!success.state.busy);
assert(src.includes('const current = event;'));assert(!src.includes('useState(event)'));
assert(fs.readFileSync('tdash/src/features/EventCommandCenter.jsx','utf8').includes('onUpdate={onUpdate}'));
console.log('PASS repair inert extracted-submit/discard: authoritative props+parent callback, 403/409 explicit reset, ambiguous same UUID/intent retry, late unmount/event/user suppression, successful current snapshot propagation');
