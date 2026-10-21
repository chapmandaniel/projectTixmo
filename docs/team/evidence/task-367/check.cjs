require('./network-guard.cjs');
// Transport-only synthetic provider, durable disk ledger; real SQL and financial handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process');
require('../../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
assert.equal(process.env.TASK364_SCRUBBED,'1'); assert.equal(process.env.NODE_ENV,'test');
const root=path.resolve(__dirname,'../../../..'),ledgerPath=process.env.TASK364_LEDGER;
assert(ledgerPath.startsWith('/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task367/'));
require(root+'/tixmoapi2/node_modules/ts-node').register({transpileOnly:true,project:root+'/tixmoapi2/tsconfig.json'});
const {PrismaClient}=require(root+'/tixmoapi2/node_modules/@prisma/client'),db=new PrismaClient(),children=new Set();
process.once('exit',()=>{for(const c of children)c.kill('SIGKILL');});
process.once('SIGTERM',()=>process.exit(143));process.once('SIGINT',()=>process.exit(130));
const ledger=()=>JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
function durableWrite(value){const fd=fs.openSync(ledgerPath,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}const dir=fs.openSync(path.dirname(ledgerPath),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
async function worker(){
 const calls=[],Module=require('node:module'),original=Module._load;
 const provider={paymentIntents:{retrieve:async id=>{calls.push(['intent',id]);return{id,status:'succeeded',amount_received:1000,currency:'usd'};}},refunds:{
 list:async args=>{calls.push(['list',args]);if(args.payment_intent==='unknown')throw Error('Synthetic ledger unavailable (immediate rejection, not timed timeout)');return{data:ledger().effects.map(x=>x.response).filter(x=>x.payment_intent===args.payment_intent)};},
 create:async(args,options)=>{calls.push(['create',args,options]);const l=ledger();assert(!l.effects.some(x=>x.idempotencyKey===options.idempotencyKey),'No second synthetic create permitted');const response={id:'re_364',status:'succeeded',amount:args.amount,currency:'usd',payment_intent:args.payment_intent,metadata:args.metadata};l.effects.push({idempotencyKey:options.idempotencyKey,args,response});durableWrite(l);process.send({type:'provider-durable-before-return',pid:process.pid,calls});await new Promise(()=>{});}
 }};
 Module._load=function(request,parent,isMain){if(request==='stripe')return class{constructor(){return provider;}};if(request.endsWith('/notificationService'))return{notificationService:new Proxy({},{get(){throw Error('Forbidden notification boundary');}})};if(request.endsWith('/logger'))return{logger:{error(){},info(){},warn(){},debug(){}}};return original.call(this,request,parent,isMain);};
 const {PaymentService}=require(root+'/tixmoapi2/src/api/payments/service.ts');await new PaymentService().recoverRefunds();process.send({type:'complete',pid:process.pid,calls});await new Promise(()=>{});
}
async function start(expected){
 const c=fork(__filename,['worker'],{env:{...process.env},stdio:['ignore','inherit','inherit','ipc']});children.add(c);c.once('exit',()=>children.delete(c));
 const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{c.kill('SIGKILL');reject(Error('owned child deadline'));},15000);c.once('error',e=>{clearTimeout(timer);reject(e);});c.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error(`early exit ${code} ${signal}`));});c.once('message',m=>{clearTimeout(timer);resolve(m);});});assert.equal(result.type,expected);assert.equal(result.pid,c.pid);return{c,result};
}
async function kill({c,result}){const exited=new Promise(resolve=>c.once('exit',(code,signal)=>resolve({code,signal})));c.kill('SIGKILL');assert.equal((await exited).signal,'SIGKILL');console.log('OWNED_CHILD_SIGKILL',JSON.stringify(result));}
async function snapshot(){return{refund:await db.paymentRefund.findUnique({where:{id:'healthy'},include:{order:{include:{tickets:true}}}}),inventory:await db.ticketType.findFirst()};}
async function main(){
 durableWrite({effects:[]});const org=await db.organization.create({data:{name:'task364',slug:'task364',type:'PROMOTER'}}),user=await db.user.create({data:{email:'task364@example.test',passwordHash:'synthetic',firstName:'Test',lastName:'Fixture'}}),event=await db.event.create({data:{name:'task364',slug:'task364',organizationId:org.id,tags:[]}}),tier=await db.ticketType.create({data:{name:'task364',eventId:event.id,price:10,quantityTotal:1,quantityAvailable:0,quantityHeld:0,quantitySold:1}});
 const old=new Date(Date.now()-120000);
 for(const [i,id]of['healthy','aged','unknown','manual'].entries()){const order=await db.order.create({data:{orderNumber:'task364-'+id,userId:user.id,eventId:event.id,totalAmount:10,status:'PAID',paymentStatus:'SUCCEEDED',paymentIntentId:id,refundStatus:'PROCESSING'}});if(id==='healthy')await db.ticket.create({data:{orderId:order.id,userId:user.id,eventId:event.id,ticketTypeId:tier.id,barcode:'task364',pricePaid:10,inventoryState:'SOLD'}});await db.paymentRefund.create({data:{id,orderId:order.id,paymentIntentId:id,amount:1000,currency:'usd',reason:id==='manual'?'LATE_PAYMENT':'ORDER_REFUND',updatedAt:new Date(old.getTime()+i),createdAt:id==='aged'?new Date(Date.now()-23*3600000-1000):old}});}
 const manualBefore=await db.paymentRefund.findUnique({where:{id:'manual'}}),before=await snapshot();
 const first=await start('provider-durable-before-return');const inGap=await snapshot();assert.deepEqual(inGap,before);assert.equal(inGap.refund.status,'REQUESTED');assert.equal(inGap.refund.stripeRefundId,null);assert.equal(inGap.refund.order.status,'PAID');assert.equal(inGap.refund.order.tickets[0].inventoryState,'SOLD');assert.equal(ledger().effects.length,1);assert.equal(ledger().effects[0].idempotencyKey,'refund-healthy');assert.deepEqual(ledger().effects[0].args.metadata,{refundId:'healthy',orderId:inGap.refund.orderId});console.log('IN_GAP_SQL_AND_LEDGER',JSON.stringify({inGap,ledger:ledger()}));await kill(first);
 // Same durable matching refund, aged only AFTER the owned worker was reaped.
 const agedAt=new Date(Date.now()-24*3600000);
 await db.$executeRaw`UPDATE payment_refunds SET "created_at"=${agedAt} WHERE id='healthy'`;
 const agedGap=await snapshot();assert.deepEqual({...agedGap.refund,createdAt:inGap.refund.createdAt},inGap.refund);assert.deepEqual(agedGap.inventory,inGap.inventory);assert(Date.now()-agedGap.refund.createdAt.getTime()>23*3600000);assert.equal(ledger().effects[0].response.metadata.refundId,agedGap.refund.id);console.log('POST_KILL_SAME_MATCHING_SQL_AGED_GT23H',JSON.stringify(agedGap));
 const second=await start('complete');assert.notEqual(second.c.pid,first.c.pid);assert.equal(second.result.calls.filter(c=>c[0]==='create').length,0);assert(second.result.calls.some(c=>c[0]==='list'&&c[1].payment_intent==='healthy'));await kill(second);
 const after=await snapshot();assert.equal(after.refund.status,'SUCCEEDED');assert.equal(after.refund.stripeRefundId,'re_364');assert.equal(after.refund.order.status,'REFUNDED');assert.equal(after.refund.order.tickets[0].inventoryState,'RELEASED');assert.deepEqual([after.inventory.quantityAvailable,after.inventory.quantityHeld,after.inventory.quantitySold],[1,0,0]);assert.equal(ledger().effects.length,1);
 const exceptions=await db.paymentRefund.findMany({where:{id:{in:['aged','unknown']}}});assert.equal(exceptions.length,2);for(const r of exceptions){assert.equal(r.status,'REQUESTED');assert.equal(r.stripeRefundId,null);assert(r.errorMessage.includes('owner=tixmo-backend'));assert(r.updatedAt>old);}
 const third=await start('complete');assert.deepEqual(third.result.calls,[]);await kill(third);assert.deepEqual(await snapshot(),after);assert.deepEqual(await db.paymentRefund.findUnique({where:{id:'manual'}}),manualBefore);assert.equal(ledger().effects.length,1);
 // Explicit SQL aging, NOT elapsed cooldown: retry unavailable ledger in another real process.
 await db.paymentRefund.update({where:{id:'unknown'},data:{updatedAt:old}});const fourth=await start('complete');assert.deepEqual(fourth.result.calls.map(c=>c[0]),['intent','list']);await kill(fourth);const unknownRetry=await db.paymentRefund.findUnique({where:{id:'unknown'}});assert(unknownRetry.updatedAt>old);assert(unknownRetry.errorMessage.includes('owner=tixmo-backend'));assert.equal(unknownRetry.stripeRefundId,null);assert.equal(unknownRetry.status,'REQUESTED');assert.deepEqual(await snapshot(),after);assert.equal(ledger().effects.length,1);
 console.log('FINAL_SQL_LEDGER',JSON.stringify({after,exceptions,unknownRetry,manualBefore,ledger:ledger()}));console.log('PASS old-window SAME matching refund SQL-aged >23h after true in-flight SIGKILL after fsync provider effect before create returns; same DB/disk ledger new process discovers/reuses; stock release once; replay unchanged; old23h/unknown failclosed; manual73 untouched; SQL-aged unknown retry explicitly not elapsed cooldown');await db.$disconnect();
}
(process.argv[2]==='worker'?worker():main()).catch(async e=>{console.error(e);await db.$disconnect();process.exit(1);});
