// Disposable PostgreSQL reservation proof only; no payment or app bootstrap.
// Real Prisma client, test-only bounded pool; guarded base target remains unchanged.
jest.mock('../../src/config/prisma', () => {
  const { PrismaClient } = jest.requireActual('@prisma/client');
  return { __esModule: true, default: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + '?connection_limit=105&pool_timeout=5' } } }) };
});
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import crypto from 'crypto';
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
const service = new OrderService();
afterAll(async () => { await prisma.$disconnect(); });
test('100 simultaneous buyers reserve exactly last ten; cap and rollback preserve stock', async () => {
  const key = `local284-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const buyers = Array.from({ length: 100 }, (_, i) => ({ id: crypto.randomUUID(), email: `${key}-${i}@example.test`, passwordHash: 'synthetic', firstName: 'Synthetic', lastName: `Buyer${i}` }));
  await prisma.user.createMany({ data: buyers });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now() + 86400000) } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 10, maxPerOrder: 2 } });
  const state = async () => ({ stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id }, select: { quantityAvailable: true, quantityHeld: true, quantitySold: true } }), orders: await prisma.order.count({ where: { eventId: event.id } }), tickets: await prisma.ticket.count({ where: { eventId: event.id } }) });
  const initial = await state();
  await expect(service.createOrder(buyers[0].id, { items: [{ ticketTypeId: type.id, quantity: 2 }, { ticketTypeId: type.id, quantity: 1 }] })).rejects.toThrow('Maximum 2');
  expect(await state()).toEqual(initial);
  // Promo validation follows stock decrement inside actual transaction: rollback must undo it.
  await expect(service.createOrder(buyers[0].id, { items: [{ ticketTypeId: type.id, quantity: 1 }], promoCode: 'SYNTHETIC-NONEXISTENT' })).rejects.toThrow('Promo code is unavailable');
  expect(await state()).toEqual(initial);
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const ready = new Promise<void>(r => { locked = r; });
  const holder = prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`; locked(); await gate; }, { timeout: 10000 });
  await ready;
  const started = performance.now();
  const attempts = buyers.map(async buyer => {
    const start = performance.now();
    try { const order = await service.createOrder(buyer.id, { items: [{ ticketTypeId: type.id, quantity: 1 }] }); return { ok: true, id: order.id, buyer: buyer.id, error: '', ms: performance.now() - start }; }
    catch (e: any) { return { ok: false, id: '', buyer: buyer.id, error: e.message, ms: performance.now() - start }; }
  });
  let observedWaiters = 0;
  try {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const rows: any[] = await prisma.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM events%'`;
      observedWaiters = Math.max(observedWaiters, rows.length);
      if (observedWaiters >= 10) break;
      await new Promise(r => setTimeout(r, 10));
    }
  } finally { release(); await holder; }
  const results = await Promise.all(attempts);
  const elapsedMs = performance.now() - started;
  const successes = results.filter(r => r.ok), failures = results.filter(r => !r.ok);
  const final = await state();
  const tickets = await prisma.ticket.findMany({ where: { eventId: event.id } });
  const orders = await prisma.order.findMany({ where: { eventId: event.id } });
  const latencies = results.map(r => r.ms).sort((a,b) => a-b);
  console.log('TASK284_RESULT', JSON.stringify({ attempts: results.length, successes: successes.length, failures: failures.length, errors: failures.reduce((a: Record<string,number>, r) => { a[r.error] = (a[r.error] || 0) + 1; return a; }, {}), observedWaiters, elapsedMs, latencyMs: { min: latencies[0], p50: latencies[49], p95: latencies[94], p99: latencies[98], max: latencies[99] }, final, results }));
  expect(observedWaiters).toBeGreaterThanOrEqual(10);
  expect(successes).toHaveLength(10); expect(failures).toHaveLength(90);
  expect(failures.every(r => r.error === 'Not enough tickets available')).toBe(true);
  expect(final).toEqual({ stock: { quantityAvailable: 0, quantityHeld: 10, quantitySold: 0 }, orders: 10, tickets: 10 });
  expect(new Set(tickets.map(t => t.barcode)).size).toBe(10);
  expect(new Set(tickets.map(t => t.orderId)).size).toBe(10);
  expect(new Set(tickets.map(t => t.userId)).size).toBe(10);
  expect(new Set(successes.map(s => s.id))).toEqual(new Set(tickets.map(t => t.orderId)));
  expect(tickets.every(t => t.inventoryState === 'HELD' && t.ticketTypeId === type.id)).toBe(true);
  expect(orders.every(o => o.status === 'PENDING' && o.paymentIntentId === null && o.paymentStatus !== 'SUCCEEDED')).toBe(true);
}, 30000);
