// Real PostgreSQL service/HTTP acceptance. Synthetic provider boundary only.
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { retrieve: jest.fn(), create: jest.fn() },
  refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
})));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import request from 'supertest';
import { readFileSync, writeFileSync } from 'fs';
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { Server } from 'http';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
import { generateAccessToken } from '../../src/utils/jwt';
const service = new OrderService();
let server: Server;
let buyer: any, other: any, event: any, type: any, token: string;
const later = (ms: number) => new Date(Date.now() + ms);
const purchase = () =>
  service.createOrder(buyer.id, { items: [{ ticketTypeId: type.id, quantity: 1 }] });
beforeAll(async () => {
  const key = `local279-${Date.now()}`;
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  buyer = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Local',
      lastName: 'Buyer',
    },
  });
  other = await prisma.user.create({
    data: {
      email: `${key}-other@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Other',
      lastName: 'Buyer',
    },
  });
  event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: key,
      slug: key,
      tags: [],
      status: 'PUBLISHED',
      startDatetime: later(86400000),
    },
  });
  type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 100,
      quantityAvailable: 100,
      maxPerOrder: 2,
    },
  });
  server = await new Promise<Server>((resolve) => {
    const local = app.listen(0, '127.0.0.1', () => resolve(local));
  });
  const apiPort = (server.address() as any).port;
  writeFileSync(`${process.env.TMPDIR}/api-owner`, `${process.pid} ${apiPort} ${readFileSync(`/proc/${process.pid}/stat`, 'utf8').split(' ')[21]}\n`);
  console.log('TASK302_HTTP_LISTENER', process.pid, server.address());
  token = generateAccessToken({ userId: buyer.id, email: buyer.email, role: buyer.role });
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await prisma.$disconnect();
});
beforeEach(async () => {
  await prisma.event.update({
    where: { id: event.id },
    data: { salesStart: later(-60000), salesEnd: later(60000), status: 'PUBLISHED', deletedAt: null, startDatetime: later(86400000) },
  });
  await prisma.ticketType.update({
    where: { id: type.id },
    data: { salesStart: later(-60000), salesEnd: later(60000), status: 'ACTIVE' },
  });
});
// Date-only control: no Jest fake timers, no changes to performance/hrtime or PG clocks.
// Constructors with arguments preserve real date parsing/SQL instants. Always restore.
async function atAdmissionTime<T>(instant: number, run: () => Promise<T>): Promise<T> {
  const NativeDate = global.Date;
  const nativeTimeout = global.setTimeout;
  const ControlledDate = function(this: any, ...args: any[]) {
    if (!new.target) return new NativeDate(instant).toString();
    return Reflect.construct(NativeDate, args.length ? args : [instant], new.target);
  };
  Object.setPrototypeOf(ControlledDate, NativeDate);
  ControlledDate.prototype = NativeDate.prototype;
  Object.defineProperty(ControlledDate, 'now', { value: () => instant });
  global.Date = ControlledDate as unknown as DateConstructor;
  try {
    expect(new Date().getTime()).toBe(instant);
    expect(global.setTimeout).toBe(nativeTimeout);
    return await run();
  } finally { global.Date = NativeDate; }
}
const anchor = Date.now();
type WindowCase = { name: string; e: [number|null, number|null]; t: [number|null, number|null]; at: number; admit: boolean; event?: any; ticket?: any };
const cases: WindowCase[] = [];
for (const scope of ['event', 'ticket'] as const) {
  for (const boundary of ['start', 'end'] as const) {
    for (const delta of [-1, 0, 1]) {
      // Ticket window is narrower when it supplies the tested boundary.
      const e: [number,number] = scope === 'event' ? [0,10000] : [-10000,20000];
      const t: [number,number] = scope === 'event' ? [-10000,20000] : [0,10000];
      cases.push({ name: `${scope}-${boundary}${delta >= 0 ? '+' : ''}${delta}ms`, e,t,
        at: (boundary === 'start' ? 0 : 10000) + delta,
        admit: boundary === 'start' ? delta >= 0 : delta < 0 });
    }
  }
}
cases.push(
  {name:'all-null',e:[null,null],t:[null,null],at:0,admit:true},
  {name:'null-event-narrow-ticket-start',e:[null,null],t:[0,10000],at:0,admit:true},
  {name:'null-ticket-event-start',e:[0,10000],t:[null,null],at:0,admit:true},
  {name:'one-sided-null-start',e:[null,10000],t:[0,null],at:0,admit:true},
  {name:'one-sided-null-close',e:[null,10000],t:[0,null],at:10000,admit:false},
  {name:'empty-touching-intersection',e:[0,10000],t:[10000,20000],at:10000,admit:false},
  {name:'disjoint-intersection',e:[0,10000],t:[20000,30000],at:15000,admit:false},
  {name:'empty-event',e:[0,0],t:[null,null],at:0,admit:false},
  {name:'empty-ticket',e:[null,null],t:[0,0],at:0,admit:false},
  {name:'inverted-event',e:[10000,0],t:[null,null],at:5000,admit:false},
  {name:'inverted-ticket',e:[null,null],t:[10000,0],at:5000,admit:false},
  ...['DRAFT','CANCELLED','COMPLETED','DELETED','SOLD_OUT'].map(status =>
    ({name:`event-${status}`,e:[null,null],t:[null,null],at:0,admit:false,event:{status}} as WindowCase)),
  {name:'soft-deleted-published',e:[null,null],t:[null,null],at:0,admit:false,event:{deletedAt:new Date(anchor-1)}},
  {name:'event-started-closed',e:[null,null],t:[null,null],at:0,admit:false,event:{startDatetime:new Date(anchor)}},
  {name:'ticket-hidden',e:[null,null],t:[null,null],at:0,admit:false,ticket:{status:'HIDDEN'}},
  {name:'ticket-sold-out',e:[null,null],t:[null,null],at:0,admit:false,ticket:{status:'SOLD_OUT'}}
);
const sqlState = async () => ({
  orders: await prisma.order.count(), tickets: await prisma.ticket.count(),
  inventory: await prisma.ticketType.findUniqueOrThrow({where:{id:type.id},select:{quantityAvailable:true,quantityHeld:true,quantitySold:true}}),
});
for (const route of ['service', 'HTTP'] as const) {
  test.each(cases)(`Date-only ${route}: $name`, async c => {
    const date = (n:number|null) => n === null ? null : new Date(anchor+n);
    const eventWindow = {salesStart:date(c.e[0]),salesEnd:date(c.e[1])};
    const ticketWindow = {salesStart:date(c.t[0]),salesEnd:date(c.t[1])};
    await prisma.event.update({where:{id:event.id},data:{...eventWindow,...c.event}});
    await prisma.ticketType.update({where:{id:type.id},data:{...ticketWindow,status:'ACTIVE',...c.ticket}});
    // Round-trip exact timestamp instants through real PostgreSQL, not JS-only fixtures.
    expect(await prisma.event.findUniqueOrThrow({where:{id:event.id},select:{salesStart:true,salesEnd:true}})).toEqual(eventWindow);
    expect(await prisma.ticketType.findUniqueOrThrow({where:{id:type.id},select:{salesStart:true,salesEnd:true}})).toEqual(ticketWindow);
    const before = await sqlState();
    let id: string | undefined;
    await atAdmissionTime(anchor+c.at, async () => {
      if (route === 'HTTP') {
        const response = await request(server).post('/api/v1/orders').set('Authorization', `Bearer ${token}`)
          .send({items:[{ticketTypeId:type.id,quantity:1}]});
        expect(response.status).toBe(c.admit ? 201 : 400);
        id = response.body.data?.id;
      } else if (c.admit) id = (await purchase()).id;
      else await expect(purchase()).rejects.toThrow();
    });
    const after = await sqlState();
    if (!c.admit) expect(after).toEqual(before);
    else {
      expect(after).toEqual({orders:before.orders+1,tickets:before.tickets+1,inventory:{
        quantityAvailable:before.inventory.quantityAvailable-1,
        quantityHeld:before.inventory.quantityHeld+1,quantitySold:before.inventory.quantitySold}});
      expect(await prisma.order.findUniqueOrThrow({where:{id},select:{status:true,userId:true,eventId:true}}))
        .toEqual({status:'PENDING',userId:buyer.id,eventId:event.id});
      const reserved = await prisma.ticket.findMany({where:{orderId:id}});
      expect(reserved).toHaveLength(1);
      expect(reserved[0]).toMatchObject({ticketTypeId:type.id,inventoryState:'HELD'});
    }
    console.log('TASK302_BOUNDARY',route,c.name,'controlledDate',new Date(anchor+c.at).toISOString(),c.admit?'single-reservation':'zero-mutation');
  });
}
test('open intersection HTTP order, aggregate cap, buyer isolation', async () => {
  const response = await request(server)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ ticketTypeId: type.id, quantity: 1 }] });
  expect(response.status).toBe(201);
  expect(response.body.data.status).toBe('PENDING');
  const beforeIsolation = await sqlState();
  expect(await service.getOrderById(response.body.data.id, undefined, other.id)).toBeNull();
  expect(await sqlState()).toEqual(beforeIsolation);
  const beforeCap = await sqlState();
  await expect(
    service.createOrder(buyer.id, {
      items: [
        { ticketTypeId: type.id, quantity: 2 },
        { ticketTypeId: type.id, quantity: 1 },
      ],
    })
  ).rejects.toThrow('Maximum 2');
  expect(await sqlState()).toEqual(beforeCap);
});
test('actual event row lock wait crosses close before server clock sampling', async () => {
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const ready = new Promise<void>((r) => (locked = r));
  const end = later(1600);
  await prisma.event.update({ where: { id: event.id }, data: { salesEnd: end } });
  const holder = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`;
      locked();
      await gate;
    },
    { timeout: 10000 }
  );
  await ready;
  const count = await prisma.order.count();
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect(Date.now()).toBeLessThan(end.getTime());
  const outcome = purchase().then(
    () => ({ ok: true, error: '' }),
    (e) => ({ ok: false, error: e.message })
  );
  try {
    const deadline = Date.now() + 1200;
    let waiting = false;
    while (Date.now() < deadline) {
      const rows: any[] =
        await prisma.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM events%'`;
      if (rows.length) {
        waiting = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(waiting).toBe(true);
    await new Promise((r) => setTimeout(r, Math.max(0, end.getTime() - Date.now() + 100)));
  } finally {
    release();
    await holder;
  }
  const result = await outcome;
  expect(result).toEqual({ ok: false, error: 'Event is not available for purchase' });
  expect(await prisma.order.count()).toBe(count);
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([after.quantityAvailable, after.quantityHeld]).toEqual([
    inventory.quantityAvailable,
    inventory.quantityHeld,
  ]);
  console.log('TASK279_REAL_LOCK_WAIT_CLOSE_REJECTED', end.toISOString());
}, 15000);


test('expired paid webhook persists one manual exception across replay with no provider or fulfillment', async () => {
  const before = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  const order = await purchase();
  const intentId = `pi-synthetic-279-${order.id}`;
  await prisma.order.update({ where: { id: order.id }, data: {
    expiresAt: new Date(0), paymentIntentId: intentId, paymentStatus: 'PROCESSING',
  } });
  const payments = new PaymentService();
  const provider = (Stripe as unknown as jest.Mock).mock.results.slice(-1)[0].value;
  const intent = { id: intentId, metadata: { orderId: order.id }, status: 'succeeded',
    amount: Math.round(Number(order.totalAmount.toString()) * 100),
    amount_received: Math.round(Number(order.totalAmount.toString()) * 100), currency: order.currency };
  const firstId = `evt-synthetic-279-${order.id}`;
  const deliver = (id: string) => (payments as any).processEvent({ id,
    type: 'payment_intent.succeeded', data: { object: intent } });
  const state = async () => ({
    order: await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: {
      status: true, paymentStatus: true, refundStatus: true, paymentClosedAt: true,
    } }),
    tickets: await prisma.ticket.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } }),
    inventory: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id }, select: {
      quantityAvailable: true, quantityHeld: true, quantitySold: true,
    } }),
  });
  await deliver(firstId);
  const baseline = await state();
  expect(baseline.order).toEqual({ status: 'CANCELLED', paymentStatus: 'PROCESSING',
    refundStatus: 'NONE', paymentClosedAt: null });
  for (const id of [firstId, `${firstId}-replay`]) {
    await deliver(id);
    expect(await state()).toEqual(baseline);
  }
  const record = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: intentId } });
  expect(record).toMatchObject({ orderId: order.id, reason: 'LATE_PAYMENT', status: 'REQUESTED',
    stripeRefundId: null, errorMessage: expect.stringContaining('Manual reconciliation') });
  expect(await prisma.paymentRefund.count({ where: { paymentIntentId: intentId } })).toBe(1);
  // Prove this is eligible by generic status/time rules, not protected by youth/backoff.
  const aged = await prisma.paymentRefund.update({ where: { id: record.id }, data: {
    updatedAt: new Date(Date.now() - 120_000),
  } });
  const genericEligibility = { id: record.id, status: 'REQUESTED',
    updatedAt: { lte: new Date(Date.now() - 60_000) } };
  expect(await prisma.paymentRefund.count({ where: genericEligibility })).toBe(1);
  expect(await prisma.paymentRefund.count({ where: {
    ...genericEligibility, reason: { not: 'LATE_PAYMENT' },
  } })).toBe(0);
  await (payments as any).reconcileRefund(record.id);
  expect(await state()).toEqual(baseline);
  expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { id: record.id } })).toEqual(aged);
  await payments.recoverRefunds();
  expect(await state()).toEqual(baseline);
  expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { id: record.id } })).toEqual(aged);
  const afterOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  expect(afterOrder.status).toBe('CANCELLED');
  expect(afterOrder.paymentStatus).not.toBe('SUCCEEDED');
  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
  expect(tickets.length).toBe(1);
  expect(tickets.every(t => t.status === 'CANCELLED' && t.inventoryState === 'RELEASED')).toBe(true);
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([after.quantityAvailable, after.quantityHeld, after.quantitySold]).toEqual(
    [before.quantityAvailable, before.quantityHeld, before.quantitySold]);
  expect(await prisma.paymentWebhookEvent.count({ where: { orderId: order.id, status: 'PROCESSED' } })).toBe(2);
  for (const method of [...Object.values(provider.paymentIntents), ...Object.values(provider.refunds)])
    expect(method).not.toHaveBeenCalled();
  console.log('TASK279_DURABLE_MANUAL_LATE_PAYMENT', record.id);
});
