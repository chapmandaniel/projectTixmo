jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined), sendEmail: jest.fn().mockResolvedValue(undefined) } }));
import prisma from '../../src/config/prisma';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => {resolve=r;}); return {promise,resolve}; }
async function bounded<T>(p:Promise<T>):Promise<T> { let timer:NodeJS.Timeout|undefined; try {return await Promise.race([p,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error('admission barrier harness timeout')),5000);})]);}finally{if(timer)clearTimeout(timer);} }
afterAll(async()=>{await prisma.$disconnect();});
(process.env.TIXMO_EXPERIMENTAL_RECOVERY==='1'?test:test.skip).each([
 ['FAILED',0],['FAILED',1],['PROCESSING',0],['PROCESSING',1],
] as const)('equal sampled DB time %s contenders winner %s',async(status,winner)=>{
 const id=`evt_compete143_${status}_${winner}_${Date.now()}`;
 const before=await prisma.paymentWebhookEvent.create({data:{id,type:'unhandled.test',status,attemptGeneration:7n,processingStartedAt:new Date('2000-01-01T00:00:00Z'),errorMessage:'prior failure'}});
 // One genuine PostgreSQL clock sample is replayed ONLY at the clock seam; all reads/writes remain real.
 const sample=await prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`;
 const raw=jest.spyOn(prisma as any,'$queryRaw').mockImplementation(async(strings:any)=>{
  expect(strings.join('')).toBe('SELECT clock_timestamp() AS now');return sample;
 });
 const realRead=prisma.paymentWebhookEvent.findUnique.bind(prisma.paymentWebhookEvent);
 const realUpdate=prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
 const reached=[deferred(),deferred()],release=[deferred(),deferred()];
 const readRows:any[]=[];const updates:any[]=[];
 const reads=jest.spyOn(prisma.paymentWebhookEvent as any,'findUnique').mockImplementation(async(args:any)=>{
  const row=await realRead(args);readRows.push(row);return row;
 });
 const writes=jest.spyOn(prisma.paymentWebhookEvent as any,'updateMany').mockImplementation(async(args:any)=>{
  const index=updates.length;const observed:any={args};updates.push(observed);reached[index].resolve();
  // Await before invoking real updateMany, never inside a DB transaction/row lock.
  await bounded(release[index].promise);const result=await realUpdate(args);observed.count=result.count;return result;
 });
 const email=jest.spyOn(orderService,'sendOrderConfirmationEmail').mockResolvedValue(undefined);
 const event={id,type:'unhandled.test',data:{object:{}}};
 const runs:Promise<any>[]=[(new PaymentService() as any).beginWebhookEvent(event)];
 try{
  await bounded(reached[0].promise);
  runs.push((new PaymentService() as any).beginWebhookEvent(event));
  await bounded(Promise.all(reached.map(x=>x.promise)));
  expect(readRows).toEqual([before,before]);expect(updates.map(x=>x.args.data.processingStartedAt)).toEqual([sample[0].now,sample[0].now]);
  release[winner].resolve();expect(await bounded(runs[winner])).toEqual({eventId:id,generation:8n});
  const successor=await prisma.paymentWebhookEvent.findUniqueOrThrow({where:{id}});
  expect(successor).toMatchObject({status:'PROCESSING',attemptGeneration:8n,processingStartedAt:sample[0].now,processedAt:null,errorMessage:null});
  release[1-winner].resolve();const loser=await bounded(runs[1-winner]);
  const afterLoser=await prisma.paymentWebhookEvent.findUniqueOrThrow({where:{id}});
  console.log('TASK143_CLAIM_CAS_DURABLE',JSON.stringify({status,winner,successor,afterLoser,counts:updates.map(x=>x.count),loser},(_,v)=>typeof v==='bigint'?v.toString():v));
  expect(updates.map(x=>x.count)).toEqual(winner===0?[1,0]:[0,1]);
  expect(afterLoser).toEqual(successor);
  expect(loser).toBeNull();
  expect(await prisma.paymentWebhookEvent.count({where:{id}})).toBe(1);
  expect(email).not.toHaveBeenCalled();expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();expect(notificationService.sendEmail).not.toHaveBeenCalled();
  console.log('TASK143_COMPETING',JSON.stringify({status,winner,before,successor,updates},(_,v)=>typeof v==='bigint'?v.toString():v));
 }finally{release.forEach(x=>x.resolve());try{await bounded(Promise.allSettled(runs));}finally{raw.mockRestore();reads.mockRestore();writes.mockRestore();email.mockRestore();}}
},15000);
