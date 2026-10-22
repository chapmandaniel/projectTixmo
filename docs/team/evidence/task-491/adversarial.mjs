import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const load=async p=>import(`data:text/javascript;base64,${Buffer.from(read(p)).toString('base64')}`);
const {commitSalesPause,isSalesPausedError}=await load('tdash/src/lib/salesPause.js');
const {checkoutTicketState}=await load('tdash/src/lib/checkoutEligibility.js');
const src=read('tdash/src/features/EventSalesControl.jsx');
// Extract ONLY submit function, with inert ports. No React/application module imported.
const body=src.split('const submit = async (paused) => {')[1].split('\n    };')[0];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const makeSubmit=(ports)=>new AsyncFunction(...Object.keys(ports),'paused',body).bind(null,...Object.values(ports));
const request={paused:true,reason:'incident',requestId:'key'};
const ack={data:{eventId:'e',requestId:'key',salesPaused:true}};
let gets=0;
for(const field of ['eventId','requestId','salesPaused']){
 await assert.rejects(commitSalesPause({post:async()=>({data:{...ack.data,[field]:null}}),get:async()=>{gets++;}},'e',request),/not acknowledged/);
}
assert.equal(gets,0); console.log('PASS group1 malformed acknowledgement never refreshes');
const apiSource=read('tdash/src/lib/api.js');
const normalize=new Function('body',apiSource.split('const normalizeResponse = (body) => {')[1].split('\n};')[0]);
assert.equal((await commitSalesPause({post:async()=>normalize({success:true,data:ack.data}),get:async()=>normalize({success:true,data:{id:'e',salesPaused:false}})},'e',request)).salesPaused,false);
console.log('PASS group2 actual extracted normalizeResponse shape + historical replay');
for(const payload of [{code:'SALES_PAUSED'},{errors:{code:'sales_paused'}},{errors:{code:'SALES_PAUSE_REQUEST_CONFLICT'}},null])assert.equal(isSalesPausedError({response:{data:payload}}),false);
console.log('PASS group3 strict error negatives');
const ticket={status:'ACTIVE',tierInventoryStatus:'READY',quantityAvailable:5};
for(const status of ['PUBLISHED','ON_SALE'])for(const extra of [{deletedAt:'x'},{salesEnd:'1970-01-01T00:00:00Z'},{startDatetime:'1970-01-01T00:00:00Z'}])assert.equal(checkoutTicketState({status,...extra},ticket,1).max,0);
console.log('PASS group4 lifecycle/deleted/expiry precedence eligibility');
let saved, message, busy;const ref={current:null}, flight={current:false};
const ports={inFlight:flight,request:ref,reason:'incident',event:{id:'e'},api:{},crypto:{randomUUID:()=> 'fixed'},setBusy:x=>busy=x,setMessage:x=>message=x,setCurrent:x=>saved=x,setReason:()=>{},commitSalesPause:async()=>{throw Object.assign(Error('conflict'),{response:{data:{message:'conflict'}}});}};
const submit=makeSubmit(ports);await submit(true);const first=ref.current;await submit(false);
assert.equal(ref.current,first);assert.equal(ref.current.paused,true);assert.equal(message,'conflict');assert.equal(busy,false);
assert(src.includes('disabled={busy || Boolean(request.current)}'));
console.log('REPRO group5 definitive conflict leaves immutable request/reason lock, no abandon action');
let release;let writesAfterUnmount=0;let mounted=true;
const late=makeSubmit({...ports,request:{current:null},inFlight:{current:false},commitSalesPause:()=>new Promise(r=>release=r),setCurrent:()=>{if(!mounted)writesAfterUnmount++;},setMessage:()=>{},setReason:()=>{},setBusy:()=>{}});
const pending=late(true);mounted=false;release({id:'e',salesPaused:true});await pending;assert.equal(writesAfterUnmount,1);
console.log('REPRO group6 late completion has no unmount invalidation (inert setter, not mounted React)');
assert(src.includes('useState(event)'));assert(!src.includes('useEffect'));assert(!src.includes('onUpdate'));
console.log('REPRO group7 same-key prop updates cannot sync local snapshot; no parent update');
