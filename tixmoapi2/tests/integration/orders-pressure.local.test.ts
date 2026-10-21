// Direct real OrderService/SQL pressure only. No HTTP/payment/provider bootstrap.
jest.mock('../../src/config/prisma', () => {
  const { PrismaClient } = jest.requireActual('@prisma/client');
  return { __esModule: true, default: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + '?connection_limit=35&pool_timeout=5' } } }) };
});
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { monitorEventLoopDelay } from 'perf_hooks';
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
afterAll(async () => { await prisma.$disconnect(); });
test('30 scheduled arrivals/sec for 60 seconds conserve 1800 GA and 200 VIP', async () => {
  const service = new OrderService(), key = `local287-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name:key, slug:key, type:'PROMOTER' } });
  const buyers = Array.from({length:1800}, (_,i) => ({id:crypto.randomUUID(), email:`${key}-${i}@example.test`,passwordHash:'synthetic',firstName:'Synthetic',lastName:`Buyer${i}`}));
  await prisma.user.createMany({data:buyers});
  const event = await prisma.event.create({data:{organizationId:org.id,name:key,slug:key,tags:[],status:'PUBLISHED',startDatetime:new Date(Date.now()+86400000)}});
  const ga = await prisma.ticketType.create({data:{eventId:event.id,name:'GA',price:10,quantityTotal:1800,quantityAvailable:1800,maxPerOrder:4}});
  await prisma.ticketType.create({data:{eventId:event.id,name:'VIP',price:20,quantityTotal:200,quantityAvailable:200,maxPerOrder:4}});
  const delay = monitorEventLoopDelay({resolution:10}); delay.enable();
  const start=performance.now(), results:any[]=[], samples:any[]=[], queue:any[]=[];
  let active=0, completed=0, arrived=0, maxActive=0, maxQueue=0, maxBacklog=0;
  const pending:Promise<void>[]=[];
  const pump=()=>{ while(active<30 && queue.length){const item=queue.shift(); active++;maxActive=Math.max(maxActive,active);const invokedMs=performance.now()-start;
    const p=(async()=>{let id='',error='';try{id=(await service.createOrder(buyers[item.i].id,{items:[{ticketTypeId:ga.id,quantity:2}]})).id;}catch(e:any){error=e.message;}
      const completedMs=performance.now()-start; results.push({...item,invokedMs,completedMs,latencyMs:completedMs-item.arrivalMs,serviceMs:completedMs-invokedMs,id,error}); active--;completed++;pump();})(); pending.push(p);
  }};
  let monitoring=true;
  const monitor=(async()=>{while(monitoring){const rows:any[]=await prisma.$queryRaw`SELECT count(*) FILTER (WHERE wait_event_type='Lock')::int AS waiting, count(*) FILTER (WHERE state='active')::int AS active FROM pg_stat_activity WHERE datname=current_database()`;samples.push({ms:performance.now()-start,arrived,completed,active,queue:queue.length,backlog:arrived-completed,...rows[0]});await new Promise(r=>setTimeout(r,100));}})();
  try {
    for(let i=0;i<1800;i++){const targetMs=i*1000/30;const wait=start+targetMs-performance.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));
      if(performance.now()-start>85000)throw new Error('arrival deadline exceeded');
      const arrivalMs=performance.now()-start;arrived++;queue.push({i,targetMs,arrivalMs});maxQueue=Math.max(maxQueue,queue.length);maxBacklog=Math.max(maxBacklog,arrived-completed);if(queue.length>1800)throw new Error('queue bound exceeded');pump();}
    await new Promise(r=>setTimeout(r,Math.max(0,start+60000-performance.now())));
    while(completed<1800){if(performance.now()-start>90000)throw new Error('completion deadline exceeded');await new Promise(r=>setTimeout(r,10));}
    await Promise.all(pending);
  } finally {monitoring=false;await monitor;delay.disable();}
  const elapsedMs=performance.now()-start;
  const stock=await prisma.ticketType.findMany({where:{eventId:event.id},select:{name:true,quantityAvailable:true,quantityHeld:true,quantitySold:true,quantityTotal:true}});
  const tickets=await prisma.ticket.findMany({where:{eventId:event.id}}),orders=await prisma.order.findMany({where:{eventId:event.id}});
  const percentile=(a:number[])=>{a.sort((x,y)=>x-y);return{min:a[0],p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],p99:a[Math.ceil(a.length*.99)-1],max:a[a.length-1]};};
  const successes=results.filter(r=>!r.error),errors=results.filter(r=>r.error).reduce((a:any,r:any)=>{a[r.error]=(a[r.error]||0)+1;return a;},{});
  const summary={attempts:arrived,completed,successes:successes.length,errors,elapsedMs,scheduledWindowMs:60000,maxActive,maxQueue,maxBacklog,remainingBacklog:arrived-completed,latencyMs:percentile(results.map(r=>r.latencyMs)),serviceMs:percentile(results.map(r=>r.serviceMs)),arrivalLatenessMs:percentile(results.map(r=>r.arrivalMs-r.targetMs)),eventLoopMs:{p50:delay.percentile(50)/1e6,p95:delay.percentile(95)/1e6,p99:delay.percentile(99)/1e6,max:delay.max/1e6},lockSamples:samples.length,maxLockWaiters:Math.max(...samples.map(s=>s.waiting)),stock,orders:orders.length,tickets:tickets.length,uniqueBarcodes:new Set(tickets.map(t=>t.barcode)).size,uniqueOrderNumbers:new Set(orders.map(o=>o.orderNumber)).size,uniqueBuyers:new Set(orders.map(o=>o.userId)).size};
  fs.writeFileSync(path.resolve(__dirname,'../../../docs/team/evidence/task-287-local-pressure/summary.json'),JSON.stringify(summary,null,2)+'\n');
  fs.writeFileSync(path.resolve(__dirname,'../../../docs/team/evidence/task-287-local-pressure/timeline.json'),JSON.stringify({results:results.sort((a,b)=>a.i-b.i),samples},null,2)+'\n');
  console.log('TASK287_RESULT',JSON.stringify(summary));
  expect(arrived).toBe(1800);expect(completed).toBe(1800);expect(successes).toHaveLength(900);expect(errors).toEqual({'Not enough tickets available':900});
  expect(stock.find(s=>s.name==='GA')).toEqual({name:'GA',quantityAvailable:0,quantityHeld:1800,quantitySold:0,quantityTotal:1800});expect(stock.find(s=>s.name==='VIP')).toEqual({name:'VIP',quantityAvailable:200,quantityHeld:0,quantitySold:0,quantityTotal:200});
  expect(orders).toHaveLength(900);expect(tickets).toHaveLength(1800);expect(summary.uniqueBarcodes).toBe(1800);expect(summary.uniqueOrderNumbers).toBe(900);expect(summary.uniqueBuyers).toBe(900);
  expect(new Set(successes.map(r=>r.id))).toEqual(new Set(tickets.map(t=>t.orderId)));
  expect(tickets.every(t=>t.inventoryState==='HELD'&&t.ticketTypeId===ga.id)).toBe(true);
  expect(orders.every(o=>o.currency==='cad'&&o.status==='PENDING'&&o.paymentIntentId===null&&o.paymentStatus!=='SUCCEEDED')).toBe(true);
  expect(orders.every(o=>tickets.filter(t=>t.orderId===o.id).length===2)).toBe(true);
},100000);
