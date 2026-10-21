// Local-only synthetic provider transport; no Prisma/recovery/finalizer mocks.
const assert = require('node:assert/strict');
const path = require('node:path');
const {fork} = require('node:child_process');
require('../../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
assert.equal(process.env.TASK308_SCRUBBED,'1');
assert.equal(process.env.NODE_ENV,'test');
const root=path.resolve(__dirname,'../../../..');
require(root+'/tixmoapi2/node_modules/ts-node').register({transpileOnly:true,project:root+'/tixmoapi2/tsconfig.json'});
const {PrismaClient}=require(root+'/tixmoapi2/node_modules/@prisma/client');
const db=new PrismaClient();
const ownedChildren=new Set();
process.once('SIGTERM',()=>process.exit(143));
process.once('SIGINT',()=>process.exit(130));
process.once('exit',()=>{for(const child of ownedChildren) child.kill('SIGKILL');});
async function worker(){
 const Module=require('node:module'), original=Module._load;
 const calls=[];
 const provider={paymentIntents:{retrieve:async id=>{
   calls.push(['intent',id]);
   if(id.startsWith('poison')) { const e=new Error('Synthetic bounded transport timeout'); e.code='ETIMEDOUT'; throw e; }
   return {id,status:'succeeded',amount_received:1000,currency:'usd'};
 }},refunds:{list:async ()=>({data:[]}),create:async args=>{
   calls.push(['create',args.payment_intent]);
   return {id:'re_308',status:'succeeded',amount:1000,currency:'usd',payment_intent:args.payment_intent};
 }}};
 Module._load=function(request,parent,isMain){
   if(request==='stripe') return class {constructor(){return provider;}};
   if(request.endsWith('/notificationService')) return {notificationService:new Proxy({}, {get(){throw Error('Forbidden notification boundary');}})};
   if(request.endsWith('/logger')) return {logger:{error(){},info(){},warn(){},debug(){}}};
   return original.call(this,request,parent,isMain);
 };
 const {PaymentService}=require(root+'/tixmoapi2/src/api/payments/service.ts');
 await new PaymentService().recoverRefunds();
 process.send({type:'complete',pid:process.pid,calls});
 // Deliberately stay alive; parent SIGKILLs this exact owned child after DB commit.
 await new Promise(()=>{});
}
async function runChild(){
 const c=fork(__filename,['worker'],{env:{...process.env},stdio:['ignore','inherit','inherit','ipc']});
 ownedChildren.add(c);
 c.once('exit',()=>ownedChildren.delete(c));
 const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('child deadline'));},15000);
   c.once('error',reject); c.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error(`early child exit ${code} ${signal}`));});
   c.once('message',msg=>{clearTimeout(timer);resolve(msg);});
 });
 const exited=new Promise(resolve=>c.once('exit',(code,signal)=>resolve({code,signal})));
 c.kill('SIGKILL'); assert.equal((await exited).signal,'SIGKILL');
 console.log('OWNED_CHILD_KILLED',JSON.stringify(result));
 return result;
}
async function main(){
 const org=await db.organization.create({data:{name:'task308',slug:'task308',type:'PROMOTER'}});
 const user=await db.user.create({data:{email:'task308@example.test',passwordHash:'synthetic',firstName:'Test',lastName:'Fixture'}});
 const event=await db.event.create({data:{name:'task308',slug:'task308',organizationId:org.id,tags:[]}});
 const tier=await db.ticketType.create({data:{name:'task308',eventId:event.id,price:10,quantityTotal:1,quantityAvailable:0,quantityHeld:0,quantitySold:1}});
 const old=new Date(Date.now()-120000);
 for(let i=0;i<53;i++){
   const id=i<50?`poison${i}`:i===50?'healthy':i===51?'aged':'manual';
   const order=await db.order.create({data:{orderNumber:'task308-'+id,userId:user.id,eventId:event.id,totalAmount:10,status:'PAID',paymentStatus:'SUCCEEDED',paymentIntentId:id,refundStatus:'PROCESSING'}});
   if(id==='healthy') await db.ticket.create({data:{orderId:order.id,userId:user.id,eventId:event.id,ticketTypeId:tier.id,barcode:'task308',pricePaid:10,inventoryState:'SOLD'}});
   await db.paymentRefund.create({data:{id,orderId:order.id,paymentIntentId:id,amount:1000,currency:'usd',reason:id==='manual'?'LATE_PAYMENT':'ORDER_REFUND',updatedAt:new Date(old.getTime()+i),createdAt:id==='aged'?new Date(Date.now()-23*3600000-1000):old}});
 }
 const manualBefore=await db.paymentRefund.findUnique({where:{id:'manual'}});
 const first=await runChild(); assert.equal(first.calls.length,50);
 const poisons=await db.paymentRefund.findMany({where:{id:{startsWith:'poison'}}});
 assert.equal(poisons.length,50); assert(poisons.every(r=>r.status==='REQUESTED'&&r.updatedAt>old&&r.errorMessage.includes('owner=tixmo-backend')));
 const second=await runChild(); assert.equal(second.calls.filter(c=>c[0]==='create').length,1); assert.deepEqual(second.calls.filter(c=>c[0]==='create')[0],['create','healthy']);
 const healthy=await db.paymentRefund.findUnique({where:{id:'healthy'},include:{order:{include:{tickets:true}}}});
 assert.equal(healthy.status,'SUCCEEDED');assert.equal(healthy.order.status,'REFUNDED');assert.equal(healthy.order.tickets[0].inventoryState,'RELEASED');
 const inventory=await db.ticketType.findUnique({where:{id:tier.id}});assert.deepEqual([inventory.quantityAvailable,inventory.quantityHeld,inventory.quantitySold],[1,0,0]);
 const aged=await db.paymentRefund.findUnique({where:{id:'aged'}});assert.equal(aged.status,'REQUESTED');assert.equal(aged.stripeRefundId,null);assert(aged.errorMessage.includes('owner=tixmo-backend'));
 const snapshot=async()=>({refunds:await db.paymentRefund.findMany({orderBy:{id:'asc'}}),orders:await db.order.findMany({orderBy:{id:'asc'}}),tickets:await db.ticket.findMany({orderBy:{id:'asc'}}),tiers:await db.ticketType.findMany({orderBy:{id:'asc'}})});
 const beforeReplay=await snapshot();
 const third=await runChild(); assert.deepEqual(third.calls,[]);
 assert.deepEqual(await snapshot(),beforeReplay);
 console.log('FULL_SQL_REPLAY_UNCHANGED refunds/orders/tickets/ticketTypes');
 assert.deepEqual(await db.paymentRefund.findUnique({where:{id:'manual'}}),manualBefore);
 assert.deepEqual(await db.ticketType.findUnique({where:{id:tier.id}}),inventory);
 assert.deepEqual(await db.paymentRefund.findUnique({where:{id:'healthy'},include:{order:{include:{tickets:true}}}}),healthy);
 console.log('SQL_SNAPSHOT',JSON.stringify({poisonCount:poisons.length,poisonSample:poisons[0],healthy,inventory,aged,manualBefore,refundRows:await db.paymentRefund.count(),ticketRows:await db.ticket.count()}));
 console.log('PASS realSQL 50 poison + healthy51; 3 owned child SIGKILLs/reconnect same DB; real reconcile/finalize one stock release; old23h no create; manual73 unchanged; replay no effects');
 await db.$disconnect();
}
(process.argv[2]==='worker'?worker():main()).catch(async e=>{console.error(e);await db.$disconnect();process.exit(1);});
