// Real PostgreSQL service/HTTP acceptance. Synthetic provider boundary only.
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { retrieve: jest.fn(), create: jest.fn() },
  refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
})));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import request from 'supertest';
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
      quantityTotal: 30,
      quantityAvailable: 30,
      maxPerOrder: 2,
    },
  });
  server = await new Promise<Server>((resolve) => {
    const local = app.listen(0, '127.0.0.1', () => resolve(local));
  });
  console.log('TASK279_HTTP_LISTENER', server.address());
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
    data: { salesStart: later(-60000), salesEnd: later(60000) },
  });
  await prisma.ticketType.update({
    where: { id: type.id },
    data: { salesStart: later(-60000), salesEnd: later(60000) },
  });
});
test.each(['eventEarly', 'eventClosed', 'ticketEarly', 'ticketClosed'])(
  '%s rejects without inventory/order mutation',
  async (kind) => {
    if (kind.startsWith('event'))
      await prisma.event.update({
        where: { id: event.id },
        data: kind.endsWith('Early') ? { salesStart: later(60000) } : { salesEnd: later(-1) },
      });
    else
      await prisma.ticketType.update({
        where: { id: type.id },
        data: kind.endsWith('Early') ? { salesStart: later(60000) } : { salesEnd: later(-1) },
      });
    const before = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    const count = await prisma.order.count();
    const res = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ ticketTypeId: type.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(count);
    const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect([after.quantityAvailable, after.quantityHeld]).toEqual([
      before.quantityAvailable,
      before.quantityHeld,
    ]);
  }
);
test('open intersection HTTP order, aggregate cap, buyer isolation', async () => {
  const response = await request(server)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ ticketTypeId: type.id, quantity: 1 }] });
  expect(response.status).toBe(201);
  expect(response.body.data.status).toBe('PENDING');
  expect(await service.getOrderById(response.body.data.id, undefined, other.id)).toBeNull();
  await expect(
    service.createOrder(buyer.id, {
      items: [
        { ticketTypeId: type.id, quantity: 2 },
        { ticketTypeId: type.id, quantity: 1 },
      ],
    })
  ).rejects.toThrow('Maximum 2');
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
  for (const id of [firstId, firstId, `${firstId}-replay`]) {
    await (payments as any).processEvent({ id, type: 'payment_intent.succeeded', data: { object: intent } });
  }
  const record = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: intentId } });
  expect(record).toMatchObject({ orderId: order.id, reason: 'LATE_PAYMENT', status: 'REQUESTED',
    stripeRefundId: null, errorMessage: expect.stringContaining('Manual reconciliation') });
  expect(await prisma.paymentRefund.count({ where: { paymentIntentId: intentId } })).toBe(1);
  await (payments as any).reconcileRefund(record.id);
  await payments.recoverRefunds();
  expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { id: record.id } })).toEqual(record);
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
