// Full mounted app, actual SQL/password/JWT/session/ownership. No auth mocks.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('stripe', () => jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() }, refunds: { create: jest.fn(), list: jest.fn() } })));
jest.unmock('../../src/utils/notificationService');
jest.mock('../../src/config/email', () => ({emailFrom:{name:'Synthetic local',address:'sender@synthetic.test'},transporter:{sendMail:jest.fn(async()=>({messageId:'inert-local-capture'}))}}));
import request from 'supertest';
import { transporter } from '../../src/config/email';
import { writeFileSync } from 'fs';
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
  console.log('TASK294_API_CLOSED');
});
test('native elapsed server JWT expiry refresh reauthentication and real receipt local transport capture', async () => {
  await connectRedis();
  console.log('TASK294_REDIS_CLIENT',getRedisClient().options?.database);
  expect(getRedisClient().options?.database).toBe(1);
  const probe=createNetServer();
  await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const frontendPort=(probe.address() as any).port;
  await new Promise<void>(resolve=>probe.close(()=>resolve()));
  Object.assign(config,{clientUrl:`http://127.0.0.1:${frontendPort}`});
  const app = require('../../src/app').default;
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  console.log('TASK294_API_LISTENER', process.pid, server.address());
  const key = `local294-${Date.now()}`;
  const password = 'Synthetic294-Only!';
  const passwordHash = await hashPassword(password);
  const a = await prisma.user.create({ data: { email: `${key}-a@synthetic.test`, firstName: '<script>A&' , lastName: 'Fixture', passwordHash } });
  const b = await prisma.user.create({ data: { email: `${key}-b@synthetic.test`, firstName: 'B', lastName: 'Fixture', passwordHash } });
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: '<img src=x onerror=bad>& event', slug: key, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now()+86400000) } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 1, quantityAvailable: 0, quantitySold: 1 } });
  const order = await prisma.order.create({ data: { orderNumber: `ORDER-${key}`, userId: a.id, eventId: event.id, status: 'PAID', paymentStatus: 'SUCCEEDED', totalAmount: 10 } });
  await prisma.ticket.create({ data: { orderId: order.id, eventId: event.id, ticketTypeId: type.id, userId: a.id, barcode: key, pricePaid: 10, inventoryState: 'SOLD' } });
  const state = async () => ({ order: await prisma.order.findUnique({ where: { id: order.id } }), tickets: await prisma.ticket.count(), attempts: await prisma.paymentAttempt.count(), refunds: await prisma.paymentRefund.count() });
  const before = await state();
  const port = (server.address() as any).port;
  await new Promise<void>((resolve,reject) => {
    const child=spawn(process.execPath,[path.resolve(__dirname,'../../../scripts/browser/task-316-elapsed.mjs')],{stdio:['ignore','inherit','inherit','ipc'], env:{ HOME:'/home/daniel',PATH:process.env.PATH!,NODE_ENV:'test',TIXMO_BROWSER_PATH:'/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium',TASK294_FRONTEND_PORT:String(frontendPort),TASK294_RUN:process.env.TMPDIR!,TASK294_API_ORIGIN:`http://127.0.0.1:${port}`,TASK294_FIXTURE:JSON.stringify({a:a.email,b:b.email,password,orderNumber:order.orderNumber,orderId:order.id,slug:event.slug})}});
    child.on('error',reject);child.on('exit',(code)=>code===0?resolve():reject(Error(`Browser exit ${code}`)));
  });
  expect(await state()).toEqual(before);
  for (const result of (Stripe as unknown as jest.Mock).mock.results) {
    for (const group of Object.values(result.value) as any[])
      for (const fn of Object.values(group) as jest.Mock[]) expect(fn).not.toHaveBeenCalled();
  }
  // Receipt changes only receipt-delivery metadata, never payment/inventory state.
  const unpaid=await prisma.order.create({data:{orderNumber:`UNPAID-${key}`,userId:a.id,eventId:event.id,status:'PENDING',paymentStatus:'PENDING',totalAmount:10}});
  const financial=async()=>({orders:await prisma.order.findMany({orderBy:{id:'asc'},select:{id:true,status:true,paymentStatus:true,totalAmount:true}}),tickets:await prisma.ticket.findMany({orderBy:{id:'asc'}}),attempts:await prisma.paymentAttempt.count(),refunds:await prisma.paymentRefund.count()});
  const financialBefore=await financial();
  const login=async(email:string)=>{const r=await request(server).post('/api/v1/auth/login').send({email,password});expect(r.status).toBe(200);return r.body.data.accessToken;};
  const ta=await login(a.email),tb=await login(b.email);
  const post=(id:string,token:string)=>request(server).post(`/api/v1/orders/${id}/receipt`).set('Authorization',`Bearer ${token}`);
  const denied=await post(order.id,tb);expect([403,404]).toContain(denied.status);expect(transporter.sendMail).not.toHaveBeenCalled();
  const blocked=await post(unpaid.id,ta);expect(blocked.status).toBe(400);expect(transporter.sendMail).not.toHaveBeenCalled();
  const allowed=await post(order.id,ta);expect(allowed.status).toBe(200);expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  const mail=(transporter.sendMail as jest.Mock).mock.calls[0][0];
  expect(mail.to).toBe(a.email);expect(mail.to).toMatch(/@synthetic\.test$/);
  expect(mail.html).toContain(`href="http://127.0.0.1:${frontendPort}/wallet"`);expect(mail.text).toContain(`http://127.0.0.1:${frontendPort}/wallet`);
  expect(mail.html).toContain('&lt;script&gt;A&amp;');expect(mail.html).toContain('&lt;img src=x onerror=bad&gt;&amp; event');expect(mail.html).not.toContain('<script>A&');expect(mail.html).not.toContain('<img src=x');
  expect((await prisma.order.findUnique({where:{id:order.id}}))?.receiptStatus).toBe('SENT');
  expect(await financial()).toEqual(financialBefore);
  for(const result of (Stripe as unknown as jest.Mock).mock.results)for(const group of Object.values(result.value) as any[])for(const fn of Object.values(group) as jest.Mock[])expect(fn).not.toHaveBeenCalled();
  writeFileSync(path.resolve(__dirname,'../../../docs/team/evidence/task-316-BC/receipt-capture.json'),JSON.stringify({scope:'inert local transport capture ONLY not inbox/provider acceptance',statuses:{A:allowed.status,B:denied.status,unpaid:blocked.status},mail,sendCount:1,financialBefore,financialAfter:await financial()},null,2));
  console.log('TASK314_B_C_PASS real elapsed expiry and actual NotificationService/template transport-only receipt capture; no financial mutation/provider calls');
}, 85000);
