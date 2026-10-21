// Full mounted app, actual SQL/password/JWT/session/ownership. No auth mocks.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('stripe', () => jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() }, refunds: { create: jest.fn(), list: jest.fn() } })));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import { createServer as createNetServer } from 'net';
import { config } from '../../src/config/environment';
import jwt from 'jsonwebtoken';
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
test('HTTP password login A wallet/QR, B isolation, session revocation and re-login are read-only', async () => {
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
  const a = await prisma.user.create({ data: { email: `${key}-a@example.test`, firstName: 'A', lastName: 'Fixture', passwordHash } });
  const b = await prisma.user.create({ data: { email: `${key}-b@example.test`, firstName: 'B', lastName: 'Fixture', passwordHash } });
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now()+86400000) } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 1, quantityAvailable: 0, quantitySold: 1 } });
  const order = await prisma.order.create({ data: { orderNumber: `ORDER-${key}`, userId: a.id, eventId: event.id, status: 'PAID', paymentStatus: 'SUCCEEDED', totalAmount: 10 } });
  const ticket = await prisma.ticket.create({ data: { orderId: order.id, eventId: event.id, ticketTypeId: type.id, userId: a.id, barcode: key, pricePaid: 10, inventoryState: 'SOLD' } });
  const login = async (email: string) => { const r = await request(server).post('/api/v1/auth/login').send({ email, password }); expect(r.status).toBe(200); expect(r.body.data.accessToken).toBeTruthy(); return r.body.data.accessToken; };
  const read = (path: string, token: string) => request(server).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const ta = await login(a.email), tb = await login(b.email);
  const payload = jwt.decode(ta) as Record<string, unknown>;
  const expired = jwt.sign({ ...payload, exp: 1 }, process.env.JWT_SECRET!);
  expect((await read('/tickets/mine', expired)).status).toBe(401);
  expect((await request(server).post('/api/v1/auth/login').send({ email: a.email, password: 'wrong-fixture-password' })).status).toBe(401);
  const state = async () => ({ order: await prisma.order.findUnique({ where: { id: order.id } }), tickets: await prisma.ticket.count(), attempts: await prisma.paymentAttempt.count(), refunds: await prisma.paymentRefund.count() });
  const before = await state();
  const wallet = await read('/tickets/mine', ta); expect(wallet.status).toBe(200); expect(JSON.stringify(wallet.body)).toContain(ticket.id);
  const qr = await read(`/tickets/${ticket.id}/qr`, ta); expect(qr.status).toBe(200); expect(qr.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
  for (const path of [`/tickets/${ticket.id}`, `/tickets/${ticket.id}/qr`, `/orders/${order.id}`]) { const r = await read(path,tb); expect([403,404]).toContain(r.status); expect(JSON.stringify(r.body)).not.toContain(ticket.barcode); }
  const bw = await read('/tickets/mine',tb); expect(bw.status).toBe(200); expect(JSON.stringify(bw.body)).not.toContain(ticket.id);
  await prisma.user.update({ where: { id: a.id }, data: { sessionVersion: { increment: 1 } } });
  expect((await read('/tickets/mine',ta)).status).toBe(401);
  const fresh = await login(a.email);
  expect((await read(`/orders/${order.id}`,fresh)).status).toBe(200);
  expect((await read('/tickets/mine',fresh)).status).toBe(200);
  expect(await state()).toEqual(before);
  const port = (server.address() as any).port;
  await new Promise<void>((resolve,reject) => {
    const child=spawn(process.execPath,[path.resolve(__dirname,'../../../scripts/browser/task-294-real-wallet.mjs')],{stdio:['ignore','inherit','inherit','ipc'], env:{ HOME:'/home/daniel',PATH:process.env.PATH!,NODE_ENV:'test',TIXMO_BROWSER_PATH:'/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium',TASK294_FRONTEND_PORT:String(frontendPort),TASK294_RUN:process.env.TMPDIR!,TASK294_API_ORIGIN:`http://127.0.0.1:${port}`,TASK294_FIXTURE:JSON.stringify({a:a.email,b:b.email,password,orderNumber:order.orderNumber})}});
    child.on('message',async (m:any)=>{if(m.revoke){try{await prisma.user.update({where:{id:a.id},data:{sessionVersion:{increment:1}}});child.send({ok:true});}catch(e){child.send({ok:false,error:String(e)});}}});
    child.on('error',reject);child.on('exit',(code)=>code===0?resolve():reject(Error(`Browser exit ${code}`)));
  });
  expect(await state()).toEqual(before);
  for (const result of (Stripe as unknown as jest.Mock).mock.results) {
    for (const group of Object.values(result.value) as any[])
      for (const fn of Object.values(group) as jest.Mock[]) expect(fn).not.toHaveBeenCalled();
  }
  console.log('TASK294_ASSERTIONS real login/wallet/png QR/B denial/expired JWT401/wrong password401/session revocation/relogin/no financial mutation/no provider calls PASS');
}, 85000);
