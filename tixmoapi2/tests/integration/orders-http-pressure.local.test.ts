// SOURCE-ONLY task379: no runtime acceptance is implied by this test's presence.
// Setup's safety guard runs before this file; use ONLY the reviewed owned runner.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import http from 'http';
import request from 'supertest';
import prisma from '../../src/config/prisma';
import { connectRedis, disconnectRedis } from '../../src/config/redis';
import { generateAccessToken, verifyAccessToken } from '../../src/utils/jwt';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const percentiles = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y);
  return Object.fromEntries([50, 95, 99, 100].map(p => [`p${p}`, a[Math.ceil(a.length * p / 100) - 1]]));
};

test('100 same-IP authenticated HTTP buyer pairs at 30 scheduled arrivals/sec', async () => {
  const artifact = process.env.TASK379_ARTIFACT_DIR;
  const root = '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/';
  if (!artifact || !path.resolve(artifact).startsWith(root) || (fs.statSync(artifact).mode & 0o077)) {
    throw new Error('Require owned private task379 runtime artifact directory');
  }
  const redis = await connectRedis(); // MUST precede app/limiter import.
  const { default: app } = await import('../../src/app'); // Never import src/index/bootstrap.
  const { ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom');
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as import('net').AddressInfo;
  process.env.TASK379_ALLOWED_PORTS += `,${address.port}`;
  const key = `http379-${crypto.randomUUID()}`;
  const samples: any[] = [], results: any[] = [], queue: any[] = [], tasks: Promise<void>[] = [];
  let monitoring = false, monitor: Promise<void> | undefined;
  let active = 0, arrived = 0, completed = 0, maxActive = 0, maxQueue = 0;
  let eventId = '', tokens: string[] = [];
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  try {
    expect(await redis.dbSize()).toBe(0); // Sole owned DB; no inherited limiter/lease state.
    const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
    const buyers = Array.from({ length: 100 }, (_, i) => ({ id: crypto.randomUUID(), email: `${key}-${i}@example.test`, passwordHash: 'synthetic', firstName: 'Synthetic', lastName: `Buyer${i}`, disabledAt: null, sessionVersion: 0, emailVerified: true }));
    await prisma.user.createMany({ data: buyers });
    tokens = buyers.map(b => generateAccessToken({ userId: b.id, email: b.email, role: 'CUSTOMER', sessionVersion: b.sessionVersion, emailVerified: true }));
    tokens.forEach((token, i) => expect(verifyAccessToken(token)).toMatchObject({ userId: buyers[i].id, sessionVersion: 0 }));
    const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now() + 86400000) } });
    eventId = event.id;
    const ga = await prisma.ticketType.create({ data: { eventId, name: 'GA', price: 10, quantityTotal: 100, quantityAvailable: 100, maxPerOrder: 4 } });
    const measuredStart = performance.now();
    const invoke = async (i: number, route: 'read' | 'order') => {
      const at = performance.now();
      try {
        const req = route === 'read' ? request(server).get(`/api/v1/events/public/${event.slug}`) : request(server).post('/api/v1/orders').send({ items: [{ ticketTypeId: ga.id, quantity: 1 }] });
        const res = await req.set('Authorization', `Bearer ${tokens[i]}`).set('X-Forwarded-For', '127.0.0.1').timeout({ response: 5000, deadline: 8000 });
        results.push({ i, route, status: res.status, message: res.body.message, id: res.body.data?.id, ms: performance.now() - at });
      } catch (error) { results.push({ i, route, status: 0, error: String(error), ms: performance.now() - at }); }
    };
    const pump = () => {
      while (active < 30 && queue.length) {
        const item = queue.shift(); active++; maxActive = Math.max(maxActive, active);
        const work = (async () => {
          item.invokedMs = performance.now() - measuredStart;
          try { await invoke(item.i, 'read'); await invoke(item.i, 'order'); }
          finally { item.completedMs = performance.now() - measuredStart; samples.push({ arrival: item }); active--; completed++; pump(); }
        })(); tasks.push(work);
      }
    };
    monitoring = true;
    monitor = (async () => {
      while (monitoring) {
        const rows: any[] = await prisma.$queryRaw`SELECT count(*)::int AS connections, count(*) FILTER (WHERE wait_event_type='Lock')::int AS lock_waiters FROM pg_stat_activity WHERE datname=current_database()`;
        const locks: any[] = await prisma.$queryRaw`SELECT count(*) FILTER (WHERE NOT granted)::int AS ungranted FROM pg_locks WHERE database=(SELECT oid FROM pg_database WHERE datname=current_database())`;
        samples.push({ ms: performance.now() - measuredStart, arrived, completed, active, backlog: arrived - completed, queue: queue.length, oldestQueueMs: queue.length ? performance.now() - measuredStart - queue[0].arrivalMs : 0, ...rows[0], ...locks[0], rss: process.memoryUsage().rss, cpu: process.cpuUsage(cpuStart), keys: await redis.keys('*'), leases: await redis.zCard(ACTIVE_REQUESTS_KEY) });
        await sleep(50);
      }
    })();
    for (let i = 0; i < 100; i++) {
      const targetMs = i * 1000 / 30;
      await sleep(Math.max(0, measuredStart + targetMs - performance.now()));
      arrived++; queue.push({ i, targetMs, arrivalMs: performance.now() - measuredStart });
      maxQueue = Math.max(maxQueue, queue.length); pump();
    }
    while (completed < 100) {
      if (performance.now() - measuredStart > 45000) throw new Error('Bounded HTTP completion deadline exceeded');
      await sleep(10);
    }
    await Promise.all(tasks);
    monitoring = false; await monitor;
    const routeStats = Object.fromEntries(['read', 'order'].map(route => [route, percentiles(results.filter(r => r.route === route).map(r => r.ms))]));
    fs.writeFileSync(path.join(artifact, 'measurement.json'), JSON.stringify({ results, samples, routeStats, arrived, completed, maxActive, maxQueue, elapsedMs: performance.now() - measuredStart }, null, 2));
    expect(results.filter(r => r.route === 'read' && r.status === 200)).toHaveLength(100);
    expect(results.filter(r => r.route === 'order' && r.status === 201)).toHaveLength(100);
    expect(results).toHaveLength(200); expect(maxActive).toBeLessThanOrEqual(30);
    expect(arrived - completed).toBe(0);
    const orders = await prisma.order.findMany({ where: { eventId } });
    const tickets = await prisma.ticket.findMany({ where: { eventId } });
    expect(orders).toHaveLength(100); expect(new Set(orders.map(o => o.id)).size).toBe(100);
    expect(new Set(orders.map(o => o.orderNumber)).size).toBe(100);
    expect(new Set(orders.map(o => o.userId)).size).toBe(100);
    expect(orders.every(o => o.status === 'PENDING' && o.paymentIntentId === null)).toBe(true);
    expect(tickets).toHaveLength(100); expect(new Set(tickets.map(t => t.barcode)).size).toBe(100);
    expect(new Set(tickets.map(t => t.orderId))).toEqual(new Set(orders.map(o => o.id)));
    expect(tickets.every(t => t.inventoryState === 'HELD' && t.ticketTypeId === ga.id)).toBe(true);
    expect(await prisma.ticketType.findUnique({ where: { id: ga.id } })).toMatchObject({ quantityAvailable: 0, quantityHeld: 100, quantitySold: 0 });
    // Local observations only, never a production SLA claim.
    expect(routeStats.read.p95).toBeLessThanOrEqual(500);
    expect(routeStats.order.p95).toBeLessThanOrEqual(2000);
  } finally {
    monitoring = false;
    if (monitor) await monitor.catch(error => samples.push({ monitorError: String(error) }));
    await Promise.allSettled(tasks);
    // Preserve partial/failing evidence, including cancellation failures.
    fs.writeFileSync(path.join(artifact, 'partial.json'), JSON.stringify({ results, samples, arrived, completed, active, elapsedMs: performance.now() - start }, null, 2));
    try {
      if (eventId) {
        const orders = await prisma.order.findMany({ where: { eventId, status: 'PENDING' } });
        const { OrderService } = await import('../../src/api/orders/service');
        for (const order of orders) await new OrderService().cancelOrder(order.id, order.userId);
        expect(await prisma.ticketType.findMany({ where: { eventId } })).toEqual([expect.objectContaining({ quantityAvailable: 100, quantityHeld: 0, quantitySold: 0 })]);
      }
      for (let i = 0; i < 100 && await redis.zCard(ACTIVE_REQUESTS_KEY); i++) await sleep(10);
      expect(await redis.zCard(ACTIVE_REQUESTS_KEY)).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await disconnectRedis(); await prisma.$disconnect();
    }
  }
}, 90000);
