// Full mounted app, actual SQL/password/JWT/session/ownership. No auth mocks.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('stripe', () => jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() }, refunds: { create: jest.fn(), list: jest.fn() } })));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { spawn } from 'child_process';
import path from 'path';
import { createServer as createNetServer } from 'net';
import { config } from '../../src/config/environment';
import Stripe from 'stripe';
import { Server } from 'http';
import prisma from '../../src/config/prisma';
import { hashPassword } from '../../src/utils/password';
import { connectRedis, disconnectRedis, getRedisClient } from '../../src/config/redis';
let server: Server;
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await disconnectRedis(); await prisma.$disconnect();
  console.log('TASK305_API_CLOSED');
});
test('real Studio unchanged saves preserve SQL instants and inventory in three browser timezones', async()=>{
 await connectRedis();expect(getRedisClient().options?.database).toBe(1);
 const probe=createNetServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const frontendPort=(probe.address() as any).port;await new Promise<void>(r=>probe.close(()=>r()));
 Object.assign(config,{clientUrl:`http://127.0.0.1:${frontendPort}`});
 const app=require('../../src/app').default;server=await new Promise<Server>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});console.log('TASK305_API_LISTENER',process.pid,server.address());
 const key=`local305-${Date.now()}`;const password='Synthetic305-Only!';
 const org=await prisma.organization.create({data:{name:key,slug:key,type:'PROMOTER'}});
 const user=await prisma.user.create({data:{email:`${key}@example.test`,firstName:'Local',lastName:'Owner',organizationId:org.id,role:'OWNER',passwordHash:await hashPassword(password)}});
 const cases:any[]=[];
 const snapshot=async(id:string)=>{const e=await prisma.event.findUniqueOrThrow({where:{id},include:{ticketTypes:{include:{tiers:true}}}});return {start:e.startDatetime,end:e.endDatetime,salesStart:e.salesStart,salesEnd:e.salesEnd,types:e.ticketTypes.map(t=>({id:t.id,total:t.quantityTotal,available:t.quantityAvailable,sold:t.quantitySold,held:t.quantityHeld,salesStart:t.salesStart,salesEnd:t.salesEnd,tiers:t.tiers.map(x=>({id:x.id,startsAt:x.startsAt,endsAt:x.endsAt,sold:x.quantitySold,held:x.quantityHeld,limit:x.quantityLimit}))}))};};
 for(const zone of ['America/St_Johns','UTC','America/Los_Angeles'])for(const opening of ['2026-11-09T15:30:27.123Z','2026-11-01T04:00:27.123Z','2026-11-01T05:00:27.123Z']){
 const event=await prisma.event.create({data:{organizationId:org.id,name:`${key}-${cases.length}`,slug:`${key}-${cases.length}`,tags:[],status:'DRAFT',timezone:'America/St_Johns',startDatetime:new Date(opening),endDatetime:new Date('2026-11-10T21:00:00Z'),salesStart:new Date(opening),salesEnd:new Date('2026-11-10T20:00:00Z')}});
 const type=await prisma.ticketType.create({data:{eventId:event.id,name:'Admission',price:10,quantityTotal:100,quantityAvailable:63,quantitySold:30,quantityHeld:7,salesStart:new Date(opening),salesEnd:new Date('2026-11-10T20:00:00Z'),tiers:{create:{name:'Early',price:8,quantityLimit:50,quantitySold:3,quantityHeld:1,startsAt:new Date(opening),endsAt:new Date('2026-11-10T20:00:00Z')}}}});
 cases.push({event,zone,typeId:type.id,before:await snapshot(event.id)});
 }
 await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve(__dirname,'../../../scripts/browser/task-305-studio.mjs')],{stdio:['ignore','inherit','inherit'],env:{HOME:'/home/daniel',PATH:process.env.PATH!,NODE_ENV:'test',TIXMO_BROWSER_PATH:'/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium',TASK305_FRONTEND_PORT:String(frontendPort),TASK305_RUN:process.env.TMPDIR!,TASK305_API_ORIGIN:`http://127.0.0.1:${(server.address() as any).port}`,TASK305_FIXTURE:JSON.stringify({email:user.email,password,organizationId:org.id,cases})}});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error(`Browser exit ${c}`)));});
 const proof=[];for(const item of cases){const after=await snapshot(item.event.id);proof.push({zone:item.zone,before:item.before,after});expect(after).toEqual(item.before);}
 require('fs').writeFileSync(path.resolve(__dirname,'../../../docs/team/evidence/task-305-r2/sql-proof.json'),JSON.stringify(proof,null,2));
 for(const result of (Stripe as unknown as jest.Mock).mock.results)for(const group of Object.values(result.value) as any[])for(const fn of Object.values(group) as jest.Mock[])expect(fn).not.toHaveBeenCalled();
},85000);
