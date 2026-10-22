// No app imports: execute exact extracted method body with in-memory ports only.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('tixmoapi2/src/api/events/service.ts', 'utf8');
const method = source.slice(source.indexOf('  async setSalesPause('), source.indexOf('  async updateEvent('));
const body = method.slice(method.indexOf("    if (!['OWNER'"), method.lastIndexOf('\n  }'));
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const errors = Object.fromEntries(['forbidden','notFound','badRequest','conflict'].map(name => [name, (message=name, detail) => Object.assign(new Error(message), {kind:name, errors:detail})]));
const scopeSource = fs.readFileSync('tixmoapi2/src/utils/tenantScope.ts','utf8');
const scopeBody = scopeSource.slice(scopeSource.indexOf('export const assertOrganizationAccess'), scopeSource.indexOf('export const assertEventAccess'));
assert(scopeBody.includes('if (isGlobalAdmin(actor))'));
// The small scope port mirrors the inspected existing helper; mounted auth is NOT tested.
const scope = (actor, tenant) => { if(actor.role==='ADMIN' && actor.isPlatformAdmin===true && !actor.organizationId) return; if(!actor.organizationId || actor.organizationId!==tenant) throw errors.forbidden(); };
const runBody = new AsyncFunction('id','input','actor','prisma','ApiError','assertOrganizationAccess',body);
const actor = {userId:'actor1',role:'OWNER',organizationId:'tenant1'};
function fixture(){
 const state={event:{id:'event1',organizationId:'tenant1',salesPaused:false,deletedAt:null}, audits:[], calls:[], failAudit:false,failUpdate:false,failCommit:false};
 const tx={
  $queryRaw:async()=>state.calls.push('lock'),
  event:{findUnique:async()=>{state.calls.push('read');return {...state.event}},update:async({data})=>{state.calls.push('update');if(state.failUpdate)throw Error('update failed');Object.assign(state.event,data)}},
  eventSalesControl:{findUnique:async({where})=>state.audits.find(a=>a.requestId===where.eventId_requestId.requestId),create:async({data})=>{state.calls.push('audit');if(state.failAudit)throw Error('audit failed');const a={...data,id:`audit${state.audits.length}`};state.audits.push(a);return a;}}
 };
 const prisma={$transaction:async fn=>{const snapshot=structuredClone({event:state.event,audits:state.audits});try{const result=await fn(tx);if(state.failCommit)throw Error('commit failed');return result}catch(e){Object.assign(state,snapshot);throw e}}};
 return {state,call:(input,a=actor)=>runBody('event1',input,a,prisma,errors,scope)};
}
(async()=>{
 let n=0;const pass=label=>{n++;console.log('PASS '+label)};
 const f=fixture(), input={paused:true,reason:'incident',requestId:'request1'};
 let r=await f.call(input);assert.equal(r.changed,true);assert.equal(f.state.event.salesPaused,true);assert.equal(f.state.audits[0].actorId,'actor1');assert.equal(f.state.audits[0].organizationId,'tenant1');assert.deepEqual(f.state.calls.slice(0,2),['lock','read']);pass('pause uses lock before read; actor/tenant evidence');
 r=await f.call(input);assert.equal(r.replayed,true);assert.equal(f.state.audits.length,1);pass('same request replays without extra audit');
 await assert.rejects(f.call({...input,reason:'different'}),e=>e.errors.code==='SALES_PAUSE_REQUEST_CONFLICT');pass('conflicting key denied');
 r=await f.call({...input,requestId:'request2'});assert.equal(r.changed,false);assert.equal(f.state.audits[1].beforePaused,true);assert.equal(f.state.audits[1].afterPaused,true);pass('new-key no-op is explicitly no-op evidence');
 await f.call({...input,paused:false,requestId:'request3'});r=await f.call(input);assert.equal(r.salesPaused,true);assert.equal(f.state.event.salesPaused,false);pass('historical replay does not re-pause after resume');
 for(const a of [{...actor,organizationId:'other'},{...actor,role:'CUSTOMER'},{...actor,organizationId:null}]){const d=fixture();await assert.rejects(d.call(input,a),e=>e.kind==='forbidden');assert.equal(d.state.audits.length,0);assert.equal(d.state.event.salesPaused,false)}pass('scope/role denials leave inert state unchanged');
 for(const flag of ['failAudit','failUpdate','failCommit']){const d=fixture();d.state[flag]=true;await assert.rejects(d.call(input));assert.equal(d.state.event.salesPaused,false);assert.equal(d.state.audits.length,0)}pass('audit/update/commit failures propagate through mock transaction rollback');
 const orderSource=fs.readFileSync('tixmoapi2/src/api/orders/service.ts','utf8');
 const guard=orderSource.slice(orderSource.indexOf('        const now = new Date();'),orderSource.indexOf('        let subtotal'));
 const check=new Function('event','ApiError',guard);
 for(const status of ['PUBLISHED','ON_SALE']){assert.throws(()=>check({status,salesPaused:true},errors),e=>e.errors.code==='SALES_PAUSED');check({status,salesPaused:false},errors)}
 assert.throws(()=>check({status:'CANCELLED',salesPaused:true},errors),e=>e.kind==='badRequest');pass('exact order guard covers both eligible statuses and lifecycle precedence');
 console.log(`${n} inert probe groups PASS; not mounted-route/DB/concurrency proof`);
})().catch(e=>{console.error(e);process.exitCode=1});
