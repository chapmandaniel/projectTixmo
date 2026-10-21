const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient,Prisma}=require('../../../../tixmoapi2/node_modules/@prisma/client');
const {paidSalesSource}=require('../../../../tixmoapi2/src/services/paid-sales-query.ts');
const db=new PrismaClient();
(async()=>{for(const timezone of ['UTC','America/St_Johns']){
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT set_config('TimeZone',${timezone},true)`;
  const key=randomUUID();const org=await tx.organization.create({data:{name:key,slug:key,type:'PROMOTER'}});
  const user=await tx.user.create({data:{email:key+'@example.test',passwordHash:'inert',firstName:'Null',lastName:'Bounds'}});
  const events=[];for(const suffix of ['a','b'])events.push(await tx.event.create({data:{name:key+suffix,slug:key+suffix,organizationId:org.id,tags:[]}}));
  const orders=[];for(const [i,event] of events.entries())orders.push(await tx.order.create({data:{orderNumber:key+i,userId:user.id,eventId:event.id,totalAmount:10,currency:'cad',status:'PAID',createdAt:new Date('2026-11-01T04:00:00Z')}}));
  async function ids(params){const q=paidSalesSource(params);return(await tx.$queryRaw(Prisma.sql`${q} SELECT id FROM scoped ORDER BY id`)).map(r=>r.id).sort()}
  const scope={organizationId:org.id,currency:'cad'};
  const both=orders.map(o=>o.id).sort();
  assert.deepEqual(await ids(scope),both);
  assert.deepEqual(await ids({...scope,startDate:null,endDate:null}),both);
  assert.deepEqual(await ids({...scope,startDate:null,endDate:new Date('2026-11-01T04:00:00Z')}),both);
  assert.deepEqual(await ids({...scope,startDate:new Date('2026-11-01T04:00:00Z'),endDate:null}),both);
  assert.deepEqual(await ids({...scope,eventId:events[0].id,startDate:null,endDate:null}),[orders[0].id]);
  console.log(JSON.stringify({timezone,checks:5,nullAndOmittedBounds:'PASS',sameTenantEventExclusion:'PASS'}));
 });
}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
