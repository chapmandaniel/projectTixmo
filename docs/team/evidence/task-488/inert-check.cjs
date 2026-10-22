// No application imports: execute exact method body with inert dependency mocks.
const fs=require('node:fs'), assert=require('node:assert/strict');
const source=fs.readFileSync('tixmoapi2/src/api/events/service.ts','utf8');
const section=source.slice(source.indexOf('  async setSalesPause('),source.indexOf('  async updateEvent('));
const body=section.slice(section.indexOf('    if ('),section.lastIndexOf('  }'));
const ApiError=Object.fromEntries(['forbidden','notFound','badRequest','conflict'].map(k=>[k,(message,errors)=>Object.assign(new Error(message||k),{kind:k,errors})]));
let event,audits,trace,fail;
const tx={
 $queryRaw:async()=>trace.push('lock'),
 event:{findUnique:async()=>{trace.push('read');return {...event}},update:async({data})=>{trace.push('update');if(fail==='update')throw Error('update failed');Object.assign(event,data)}},
 eventSalesControl:{findUnique:async({where})=>audits.find(a=>a.requestId===where.eventId_requestId.requestId),create:async({data})=>{trace.push('audit');if(fail==='audit')throw Error('audit failed');const a={...data,id:'audit-'+audits.length};audits.push(a);return a}}
};
const prisma={$transaction:async fn=>{const snapshot=structuredClone({event,audits});try{const r=await fn(tx);if(fail==='commit')throw Error('commit failed');return r}catch(e){event=snapshot.event;audits=snapshot.audits;throw e}}};
const scope=(actor,tenant)=>{trace.push('scope');if(actor.organizationId!==tenant)throw ApiError.forbidden()};
const run=new Function('prisma','ApiError','assertOrganizationAccess','return async function(id,input,actor){'+body+'}')(prisma,ApiError,scope);
const actor={role:'OWNER',userId:'u',organizationId:'org'};
const input={paused:true,reason:'incident',requestId:'a'};
function reset(){event={id:'e',organizationId:'org',salesPaused:false,deletedAt:null};audits=[];trace=[];fail=null}
(async()=>{
reset();let r=await run('e',input,actor);assert.equal(r.changed,true);assert.equal(event.salesPaused,true);assert.equal(audits[0].actorId,'u');assert.deepEqual(trace,['lock','read','scope','audit','update']);
r=await run('e',input,actor);assert.equal(r.replayed,true);assert.equal(audits.length,1);
await assert.rejects(run('e',{...input,paused:false},actor),e=>e.kind==='conflict'&&e.errors.code==='SALES_PAUSE_REQUEST_CONFLICT');
r=await run('e',{...input,requestId:'b'},actor);assert.equal(r.changed,false);assert.equal(audits.length,2);assert.equal(audits[1].beforePaused,true);
await run('e',{...input,paused:false,requestId:'c'},actor);r=await run('e',input,actor);assert.equal(r.salesPaused,true);assert.equal(event.salesPaused,false);assert.equal(audits.length,3); // historical replay, no mutation
reset();await assert.rejects(run('e',input,{...actor,role:'CUSTOMER'}));assert.equal(trace.length,0);
reset();await assert.rejects(run('e',input,{...actor,organizationId:'other'}));assert.equal(audits.length,0);assert.equal(event.salesPaused,false);
for(const failure of ['audit','update','commit']){reset();fail=failure;await assert.rejects(run('e',input,actor));assert.equal(event.salesPaused,false);assert.equal(audits.length,0)}
console.log('PASS: transition, replay, conflict, no-op, historical replay, role/tenant denial, and three failure propagation cases. Transaction rollback is simulated, not database proof.');
})().catch(e=>{console.error(e);process.exitCode=1});
