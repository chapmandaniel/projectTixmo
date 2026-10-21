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
  await prisma.ticket.create({ data: { orderId: order.id, eventId: event.id, ticketTypeId: type.id, userId: a.id, barcode: key, pricePaid: 10, inventoryState: 'SOLD' } });
  const state = async () => ({ order: await prisma.order.findUnique({ where: { id: order.id } }), tickets: await prisma.ticket.count(), attempts: await prisma.paymentAttempt.count(), refunds: await prisma.paymentRefund.count() });
  const before = await state();
  const port = (server.address() as any).port;
  await new Promise<void>((resolve,reject) => {
    const child=spawn(process.execPath,[path.resolve(__dirname,'../../../scripts/browser/task-316-reopen.mjs')],{stdio:['ignore','inherit','inherit','ipc'], env:{ HOME:'/home/daniel',PATH:process.env.PATH!,NODE_ENV:'test',TIXMO_BROWSER_PATH:'/home/daniel/projects/projectTixmo/worktrees/task-288/scripts/runtime/task-288-chromium',TASK294_FRONTEND_PORT:String(frontendPort),TASK294_RUN:process.env.TMPDIR!,TASK294_API_ORIGIN:`http://127.0.0.1:${port}`,TASK294_FIXTURE:JSON.stringify({a:a.email,b:b.email,password,orderNumber:order.orderNumber,orderId:order.id,slug:event.slug})}});
    child.on('error',reject);child.on('exit',(code)=>code===0?resolve():reject(Error(`Browser exit ${code}`)));
  });
  expect(await state()).toEqual(before);
  for (const result of (Stripe as unknown as jest.Mock).mock.results) {
    for (const group of Object.values(result.value) as any[])
      for (const fn of Object.values(group) as jest.Mock[]) expect(fn).not.toHaveBeenCalled();
  }
  console.log('TASK314_TARGET_A SQL order/ticket/attempt/refund unchanged; zero provider calls PASS');
}, 85000);
