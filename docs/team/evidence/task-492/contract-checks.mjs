import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = p => fs.readFileSync(p, 'utf8');
const load = async p => import(`data:text/javascript;base64,${Buffer.from(read(p)).toString('base64')}`);
const { commitSalesPause, isSalesPausedError, SALES_PAUSED_MESSAGE } = await load('tdash/src/lib/salesPause.js');
const { checkoutTicketState } = await load('tdash/src/lib/checkoutEligibility.js');
// Extract only the existing pure normalizer; do not import axios/application/session.
const apiSource = read('tdash/src/lib/api.js');
const normalize = new Function('body', apiSource.split('const normalizeResponse = (body) => {')[1].split('\n};')[0]);
const request = { paused: false, reason: 'explicit incident review', requestId: 'uuid-retry' };
let bodies = [], reads = 0;
const api = {
 post: async (url, body) => { assert.equal(url, '/events/event-id/sales-pause'); bodies.push(body); return normalize({success:true, data:{eventId:'event-id', requestId:body.requestId, salesPaused:false, replayed:true}}); },
 get: async url => { assert.equal(url,'/events/event-id'); reads++; return normalize({success:true,data:{id:'event-id',salesPaused:true}}); },
};
assert.equal((await commitSalesPause(api,'event-id',request)).salesPaused,true);
await commitSalesPause(api,'event-id',request);
assert.equal(bodies[0], bodies[1]); assert.equal(reads,2);
for (const evidence of [{eventId:'other',requestId:request.requestId,salesPaused:false},{eventId:'event-id',requestId:'other',salesPaused:false},{eventId:'event-id',requestId:request.requestId,salesPaused:true}]) {
 let got=false; await assert.rejects(commitSalesPause({post:async()=>({data:evidence}),get:async()=>{got=true;}},'event-id',request),/not acknowledged/); assert.equal(got,false);
}
console.log('PASS group1 actual response normalizer, explicit resume replay/current distinction, identical retry and malformed acknowledgements');
const checkout = read('tdash/src/pages/CheckoutPage.jsx');
const catchBody = checkout.split('} catch (requestError) {\n            if (!order && isSalesPausedError(requestError)) {')[1].split('\n        } finally')[0];
const applyError = new Function('order','requestError','isSalesPausedError','setEvent','setError','SALES_PAUSED_MESSAGE', 'if (!order && isSalesPausedError(requestError)) {' + catchBody);
for (const [order,error,paused] of [[null,{response:{data:{errors:{code:'SALES_PAUSED'}}}},true],[{status:'PENDING'},{response:{data:{errors:{code:'SALES_PAUSED'},message:'reservation expired'}}},false],[null,{response:{data:{code:'SALES_PAUSED',message:'cancelled'}}},false],[null,{response:{data:{errors:{code:'OTHER'},message:'access denied'}}},false]]) {
 let event={salesPaused:false}, message;
 applyError(order,error,isSalesPausedError,fn=>event=fn(event),value=>message=value,SALES_PAUSED_MESSAGE);
 assert.equal(event.salesPaused,paused); assert.equal(message,paused?SALES_PAUSED_MESSAGE:error.response.data.message);
}
console.log('PASS group2 actual checkout catch: exact nested code only, existing-order and other error precedence');
const ticket={status:'ACTIVE',tierInventoryStatus:'READY',quantityAvailable:4};
for (const status of ['PUBLISHED','ON_SALE']) {
 const base={status,startDatetime:'2030-01-02',salesEnd:'2030-01-01',salesPaused:true};
 const now=Date.parse('2029-01-01');
 assert.equal(checkoutTicketState(base,ticket,now).max,0);
 assert.equal(checkoutTicketState({...base,salesPaused:false},ticket,now).max,4);
 for (const changes of [{status:'CANCELLED'},{deletedAt:'y'},{salesEnd:'2028-01-01'},{startDatetime:'2028-01-01'}]) assert.equal(checkoutTicketState({...base,...changes,salesPaused:false},ticket,now).max,0);
}
assert(checkout.includes("order?.status === 'PENDING' ? { data: order } : await api.post('/orders'"));
assert(checkout.includes('!order && !error && event.salesPaused && ticketTypes.some'));
console.log('PASS group3 paused both lifecycles, resume cannot bypass cancellation/deletion/expiry/start; pending/new source separation');
const routes=read('tixmoapi2/src/api/events/routes.ts');
const control=read('tdash/src/features/EventSalesControl.jsx');
assert(routes.includes("authorize('OWNER', 'ADMIN', 'MANAGER', 'PROMOTER')"));
assert(control.includes("['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER'].includes(user?.role)"));
const service=read('tixmoapi2/src/api/events/service.ts');
assert(service.includes('assertOrganizationAccess(actor, event.organizationId)'));
const orders=read('tixmoapi2/src/api/orders/service.ts');
assert(orders.indexOf("Event is not available for purchase") < orders.indexOf('if (event.salesPaused)'));
assert(control.includes('onUpdate?.(refreshed)'));
assert(control.includes('latest.current = { event, user }'));
assert(control.includes('mounted.current = false'));
console.log('PASS group4 static route-role equality/server tenant guard/backend lifecycle precedence/parent and stale-result wiring (not runtime proof)');
