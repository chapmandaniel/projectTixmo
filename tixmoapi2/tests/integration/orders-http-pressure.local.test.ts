// SOURCE-ONLY task379: no runtime acceptance is implied by this test's presence.
// Setup's safety guard runs before this file; use ONLY the reviewed owned runner.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import request from 'supertest';
import prisma from '../../src/config/prisma';
import { connectRedis, disconnectRedis } from '../../src/config/redis';
import { generateAccessToken, verifyAccessToken } from '../../src/utils/jwt';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const percentiles = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y);
  return Object.fromEntries([50, 95, 99, 100].map(p => [`p${p}`, a[Math.ceil(a.length * p / 100) - 1]]));
};

// Full-suite runner supplies a native async scope; standalone379 is already strict.
const ownedScope: <T>(work: () => T) => T = (net as any)[Symbol.for('tixmo.task427.ownedScope')] || ((work: () => any) => work());
test('100 same-IP authenticated HTTP buyer pairs at 30 scheduled arrivals/sec', () => ownedScope(async () => {
  const artifact = process.env.TASK379_ARTIFACT_DIR;
  if (!artifact) throw new Error('Require task379 runtime artifact directory');
  require('../../../docs/team/evidence/task-379/runtime-path.cjs').validate(artifact);
  let redis: Awaited<ReturnType<typeof connectRedis>> | undefined;
  let server: http.Server | undefined;
  let httpPort: number | undefined;
  let revokeListener: (() => void) | undefined;
  const runId = process.env.TASK379_RUN_ID;
  if (!runId || !/^[a-f0-9]{64}$/.test(runId)) throw new Error('Missing current runtime invocation');
  const identity = { runId, runtimeRoot: artifact, pid: process.pid, ppid: process.ppid, executable: process.execPath, startStat: fs.readFileSync(`/proc/${process.pid}/stat`, 'utf8') };
  fs.writeFileSync(path.join(artifact, 'jest-identity.json'), JSON.stringify(identity, null, 2));
  let ACTIVE_REQUESTS_KEY: string | undefined;
  let failure: unknown;
  let failed = false, stopping = false, monitorFailed = false;
  let monitorError: unknown;
  const cleanupErrors: string[] = [];
  const attempt = async (name: string, work: () => unknown | Promise<unknown>) => {
    try { await work(); } catch (error) { cleanupErrors.push(`${name}: ${String(error)}`); }
  };
  const key = `http379-${crypto.randomUUID()}`;
  const samples: any[] = [], results: any[] = [], queue: any[] = [], tasks: Promise<void>[] = [];
  let monitoring = false, monitor: Promise<void> | undefined;
  let active = 0, arrived = 0, completed = 0, maxActive = 0, maxQueue = 0;
  let eventId = '', tokens: string[] = [];
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  try {
    redis = await connectRedis(); // MUST precede app/limiter import.
    const { default: app } = await import('../../src/app'); // Never import bootstrap.
    ({ ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom'));
    server = http.createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', () => { server!.off('error', reject); resolve(); });
    });
    const address = server.address() as import('net').AddressInfo;
    httpPort = address.port;
    fs.writeFileSync(path.join(artifact, 'http-listener.json'), JSON.stringify({ ...identity, address }, null, 2));
    const register = (net as any)[Symbol.for('tixmo.task379.registerListener')];
    if (typeof register !== 'function') throw new Error('Require native task379 network guard');
    revokeListener = register(server);
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
        const req = route === 'read' ? request(server!).get(`/api/v1/events/public/${event.slug}`) : request(server!).post('/api/v1/orders').send({ items: [{ ticketTypeId: ga.id, quantity: 1 }] });
        const res = await req.set('Authorization', `Bearer ${tokens[i]}`).set('X-Forwarded-For', '127.0.0.1').timeout({ response: 5000, deadline: 8000 });
        results.push({ i, route, status: res.status, message: res.body.message, id: res.body.data?.id, ms: performance.now() - at });
      } catch (error) { results.push({ i, route, status: 0, error: String(error), ms: performance.now() - at }); }
    };
    const pump = () => {
      while (!stopping && active < 30 && queue.length) {
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
        samples.push({ ms: performance.now() - measuredStart, arrived, completed, active, backlog: arrived - completed, queue: queue.length, oldestQueueMs: queue.length ? performance.now() - measuredStart - queue[0].arrivalMs : 0, ...rows[0], ...locks[0], rss: process.memoryUsage().rss, cpu: process.cpuUsage(cpuStart), keys: await redis!.keys('*'), leases: await redis!.zCard(ACTIVE_REQUESTS_KEY!) });
        await sleep(50);
      }
    })().catch(error => {
      monitorFailed = true; monitorError = error; monitoring = false; stopping = true;
      samples.push({ monitorError: String(error) });
    }); // Handler attached immediately, never an unattended rejection.
    for (let i = 0; i < 100; i++) {
      const targetMs = i * 1000 / 30;
      await sleep(Math.max(0, measuredStart + targetMs - performance.now()));
      if (monitorFailed) throw monitorError;
      arrived++; queue.push({ i, targetMs, arrivalMs: performance.now() - measuredStart });
      maxQueue = Math.max(maxQueue, queue.length); pump();
    }
    while (completed < 100) {
      if (monitorFailed) throw monitorError;
      if (performance.now() - measuredStart > 45000) throw new Error('Bounded HTTP completion deadline exceeded');
      await sleep(10);
    }
    await Promise.all(tasks);
    monitoring = false; await monitor;
    if (monitorFailed) throw monitorError;
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
  } catch (error) {
    failed = true; failure = error;
  } finally {
    stopping = true; monitoring = false;
    await attempt('monitor', async () => { if (monitor) await monitor; });
    await attempt('drain requests', async () => {
      const drained = await Promise.allSettled(tasks);
      for (const result of drained) if (result.status === 'rejected') cleanupErrors.push(`request: ${String(result.reason)}`);
    });
    await attempt('partial artifact', () => fs.writeFileSync(path.join(artifact, 'partial.json'), JSON.stringify({ results, samples, arrived, completed, active, failure: failed ? String(failure) : undefined, elapsedMs: performance.now() - start }, null, 2)));
    await attempt('cancel inventory', async () => {
      if (eventId) {
        const orders = await prisma.order.findMany({ where: { eventId, status: 'PENDING' } });
        const { OrderService } = await import('../../src/api/orders/service');
        for (const order of orders) await attempt(`cancel ${order.id}`, () => new OrderService().cancelOrder(order.id, order.userId));
        expect(await prisma.ticketType.findMany({ where: { eventId } })).toEqual([expect.objectContaining({ quantityAvailable: 100, quantityHeld: 0, quantitySold: 0 })]);
      }
    });
    await attempt('lease cleanup', async () => {
      if (redis && ACTIVE_REQUESTS_KEY) {
        for (let i = 0; i < 100 && await redis.zCard(ACTIVE_REQUESTS_KEY); i++) await sleep(10);
        expect(await redis.zCard(ACTIVE_REQUESTS_KEY)).toBe(0);
      }
    });
    await attempt('server close', async () => {
      if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    });
    await attempt('listener revoke', () => { revokeListener?.(); });
    await attempt('Redis disconnect', () => disconnectRedis());
    await attempt('Prisma disconnect', () => prisma.$disconnect());
    await attempt('cleanup artifact', () => fs.writeFileSync(path.join(artifact, 'cleanup.json'), JSON.stringify({ identity, httpPort, serverListening: server?.listening ?? false, cleanupErrors, monitorError: monitorFailed ? String(monitorError) : undefined }, null, 2)));
  }
  // Cleanup diagnostics cannot replace the original measurement/setup failure.
  if (cleanupErrors.length) console.error('Task379 cleanup failures', cleanupErrors);
  if (failed) throw failure;
  if (monitorFailed) throw monitorError;
  if (cleanupErrors.length) throw new Error(cleanupErrors.join('\n'));
}), 90000);
