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
test('actual App checkout stays mounted over native elapsed windows; browser-only Date skew cannot reserve',async()=>{
 await connectRedis();expect(getRedisClient().options?.database).toBe(1);
 const probe=createNetServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const frontendPort=(probe.address() as any).port;await new Promise<void>(r=>probe.close(()=>r()));
 Object.assign(config,{clientUrl:`http://127.0.0.1:${frontendPort}`});const app=require('../../src/app').default;server=await new Promise<Server>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});console.log('TASK305_API_LISTENER',process.pid,server.address());
 const key=`clock305-${Date.now()}`,password='Synthetic305-Only!';const org=await prisma.organization.create({data:{name:key,slug:key,type:'PROMOTER'}});const user=await prisma.user.create({data:{email:`${key}@example.test`,firstName:'Clock',lastName:'Buyer',passwordHash:await hashPassword(password)}});
 const event=await prisma.event.create({data:{organizationId:org.id,name:key,slug:key,tags:[],status:'PUBLISHED',timezone:'America/St_Johns',startDatetime:new Date(Date.now()+86400000),salesStart:new Date(Date.now()+10000),salesEnd:new Date(Date.now()+22000)}});
 const type=await prisma.ticketType.create({data:{eventId:event.id,name:'Clock Admission',price:10,quantityTotal:100,quantityAvailable:100}});
 const state=async()=>({type:await prisma.ticketType.findUnique({where:{id:type.id}}),orders:await prisma.order.findMany(),tickets:await prisma.ticket.findMany(),attempts:await prisma.paymentAttempt.findMany(),refunds:await prisma.paymentRefund.findMany()});const before=await state();
 await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve(__dirname,'../../../scripts/browser/task-305-clock.mjs')],{stdio:['ignore','inherit','inherit'],env:{HOME:'/home/daniel',PATH:process.env.PATH!,NODE_ENV:'test',TIXMO_BROWSER_PATH:'/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium',TASK305_FRONTEND_PORT:String(frontendPort),TASK305_RUN:process.env.TMPDIR!,TASK305_API_ORIGIN:`http://127.0.0.1:${(server.address() as any).port}`,TASK305_FIXTURE:JSON.stringify({email:user.email,password,cases:[{event,typeId:type.id}]})}});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error(`Browser exit ${c}`)));});
 const after=await state();require('fs').writeFileSync(path.resolve(__dirname,'../../../docs/team/evidence/task-306-B/sql-proof.json'),JSON.stringify({before,after},null,2));expect(after).toEqual(before);
 for(const result of (Stripe as unknown as jest.Mock).mock.results)for(const group of Object.values(result.value) as any[])for(const fn of Object.values(group) as jest.Mock[])expect(fn).not.toHaveBeenCalled();
},85000);
