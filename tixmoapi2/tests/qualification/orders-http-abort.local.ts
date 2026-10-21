// Task426 SOURCE CHECKPOINT: requires a task426-owned safe runner adaptation.
// Opt-in non-test suffix intentionally excludes this checkpoint from the full gate.
// Never run with inherited DB/Redis targets. Existing setup guard runs first.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
// Must execute before any product/dependency imports; runner supplies immutable identity.
const preimportProvenance = require('../../../docs/team/evidence/task-426/provenance.cjs').verify(__filename, process.env);
import request from 'supertest';
import prisma from '../../src/config/prisma';
import { connectRedis, disconnectRedis } from '../../src/config/redis';
import { generateAccessToken } from '../../src/utils/jwt';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
const bounded = async (check: () => Promise<boolean>) => {
  const deadline = performance.now() + 3000;
  while (!(await check())) {
    if (performance.now() >= deadline) throw new Error('Abort settle deadline');
    await sleep(10);
  }
};
const ownedScope: <T>(work: () => T) => T = (net as any)[Symbol.for('tixmo.task427.ownedScope')] || ((work: () => any) => work());

test('real authenticated checkout socket aborts release each admission lease once', () => ownedScope(async () => {
  const artifact = process.env.TASK426_ARTIFACT_DIR;
  // Intentionally fail closed until a reviewed task426 runner supplies this path.
  if (!artifact) throw new Error('Require owned TASK426_ARTIFACT_DIR and reviewed runner');
  require('../../../docs/team/evidence/task-426/runtime-path.cjs').validate(artifact);
  const register = (net as any)[Symbol.for('tixmo.task379.registerListener')];
  if (typeof register !== 'function') throw new Error('Require native owned-listener guard');
  let redis: Awaited<ReturnType<typeof connectRedis>> | undefined;
  let server: http.Server | undefined;
  const ownedSockets = new Set<net.Socket>();
  let removal: jest.SpyInstance | undefined;
  const terminalAcks = new Map<string, ReturnType<typeof deferred>>();
  let revoke: (() => void) | undefined;
  let gate: ReturnType<typeof deferred> | undefined;
  let socket: http.ClientRequest | undefined;
  let evalLayer: any, controllerSpy: jest.SpyInstance | undefined;

  const { tracker, finalize } = require('../../../docs/team/evidence/task-426/lifecycle.cjs');
  const work = tracker();
  const instrumentation: jest.SpyInstance[] = [];
  const invocation = crypto.randomUUID();
  let provenance: any = { invocation, sourceSHA: null, sourceDigest: null };
  let primary: unknown;
  let joined = false;
  const rows: any[] = [];
  const started = performance.now();
  let requested = 0, aborted = 0, settled = 0;
  const snapshot = async () => ({
    leases: await redis!.zRangeWithScores('tixmo:active-request-leases:v1', 0, -1),
    inventory: await prisma.ticketType.findMany({ orderBy: { id: 'asc' } }),
    orders: await prisma.order.findMany({ orderBy: { id: 'asc' } }),
    tickets: await prisma.ticket.findMany({ orderBy: { id: 'asc' } }),
  });
  try {
    provenance = { invocation, ...preimportProvenance };
    redis = await connectRedis();
    // Instrument before app/routes capture exports. catchAsync otherwise hides its promise.
    const asyncModule = await import('../../src/utils/catchAsync');
    instrumentation.push(jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn: any) => ((req: any, res: any, next: any) => { void work.run(() => fn(req, res, next)).catch(next); }) as any));
    const auth = await import('../../src/middleware/auth');
    const waiting = await import('../../src/middleware/waitingRoom');
    for (const [module, name] of [[auth, 'authenticate'], [auth, 'optionalAuthenticate'], [waiting, 'waitingRoom']] as const) {
      const original = (module as any)[name];
      instrumentation.push(jest.spyOn(module as any, name).mockImplementation((...args: any[]) => work.run(() => original(...args))));
    }
    const validation = await import('../../src/middleware/validate');
    const realValidate = validation.validate;
    instrumentation.push(jest.spyOn(validation, 'validate').mockImplementation((schema: any) => {
      const handler = realValidate(schema);
      return ((...args: any[]) => work.run(() => (handler as any)(...args))) as any;
    }));
    // Lease release is deliberately detached from middleware; track its actual Redis promise too.
    const { trackedSpy } = require('../../../docs/team/evidence/task-426/tracked-spy.cjs');
    const removalLayer = trackedSpy(jest, redis, 'zRem', work);
    removal = removalLayer.spy;
    evalLayer = trackedSpy(jest, redis, 'eval', work);
    const commandLayer = trackedSpy(jest, redis, 'sendCommand', work);
    instrumentation.push(removalLayer.spy, evalLayer.spy, commandLayer.spy);
    // The installed limiter returns a promise encompassing store waits AND next().
    // Join that continuation, not merely sendCommand (which settles before next).
    const { promiseMiddleware } = require('../../../docs/team/evidence/task-426/middleware-lifetime.cjs');
    const limiter = await import('../../src/middleware/rateLimiter');
    for (const name of ['apiReadRateLimiter', 'apiWriteRateLimiter', 'authRateLimiter'] as const) {
      const original = limiter[name];
      instrumentation.push(jest.spyOn(limiter, name).mockImplementation(promiseMiddleware(original, work)));
    }
    const { default: app } = await import('../../src/app');
    const { ACTIVE_REQUESTS_KEY, ACQUIRE_REQUEST_LEASE } = await import('../../src/middleware/waitingRoom');
    const { orderService } = await import('../../src/api/orders/service');
    server = http.createServer(app);
    server.on('connection', connection => { ownedSockets.add(connection); connection.once('close', () => ownedSockets.delete(connection)); });
    server.prependListener('request', (req, res) => {
      const ack = terminalAcks.get(String(req.headers['x-task426-phase']));
      if (ack) { req.once('aborted', ack.resolve); res.once('close', ack.resolve); }
    });
    expect(await redis.dbSize()).toBe(0);
    await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve); });
    revoke = register(server!);
    const port = (server!.address() as net.AddressInfo).port;
    const key = `abort426-${crypto.randomUUID()}`;
    const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
    const buyers = await Promise.all([0, 1].map(i => prisma.user.create({ data: { email: `${key}-${i}@example.test`, passwordHash: 'synthetic', firstName: 'Synthetic', lastName: 'Abort', emailVerified: true } })));
    const tokens = buyers.map(b => generateAccessToken({ userId: b.id, email: b.email, role: 'CUSTOMER', sessionVersion: b.sessionVersion, emailVerified: true }));
    const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now() + 86400000) } });
    const ga = await prisma.ticketType.create({ data: { eventId: event.id, name: 'GA', price: 10, quantityTotal: 2, quantityAvailable: 2, maxPerOrder: 2 } });
    // Foreign buyer owns a genuine pending reservation, untouched by aborts.
    const foreign = await orderService.createOrder(buyers[1].id, { items: [{ ticketTypeId: ga.id, quantity: 1 }] });
    const baseline = await snapshot();
    expect(baseline.leases).toEqual([]);
    const body = JSON.stringify({ items: [{ ticketTypeId: ga.id, quantity: 1 }] });
    for (const point of ['before-acquire', 'after-acquire', 'controller'] as const) {
      const phase: any = { point, status: 'STARTED', requested, aborted, settled }; rows.push(phase);
      const reached = deferred(); gate = deferred();
      const terminal = deferred(); terminalAcks.set(point, terminal);
      const released = gate;
      let token: string | undefined;
      evalLayer.setPhase(async (realEval: any, script: string, options: any) => {
        if (script !== ACQUIRE_REQUEST_LEASE) return realEval(script, options);
        token = options.arguments[0];
        if (point === 'before-acquire') { reached.resolve(); await released.promise; }
        const result = await realEval(script, options);
        if (point === 'after-acquire') { reached.resolve(); await released.promise; }
        return result;
      });
      if (point === 'controller') controllerSpy = jest.spyOn(orderService, 'createOrder').mockImplementation(async () => {
        reached.resolve(); await released.promise;
        throw new Error('Task426 deliberate post-abort test-only controller termination');
      });
      requested++;
      socket = http.request({ host: '127.0.0.1', port, path: '/api/v1/orders', method: 'POST', agent: false, headers: { Authorization: `Bearer ${tokens[0]}`, 'X-Task426-Phase': point, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
      const closed = new Promise<void>(resolve => socket!.once('close', resolve));
      socket.on('error', () => {});
      socket.on('response', res => { res.resume(); });
      socket.end(body);
      await Promise.race([reached.promise, sleep(3000).then(() => { throw new Error(`Did not reach ${point}`); })]);
      const inflight = await snapshot(); phase.inflight = inflight;
      expect(inflight.leases).toHaveLength(point === 'before-acquire' ? 0 : 1);
      socket.destroy(); aborted++; await closed;
      // Local close is insufficient: observe server terminal before unblocking Lua.
      await Promise.race([terminal.promise, sleep(3000).then(() => { throw new Error('Server terminal ACK deadline'); })]);
      gate.resolve();
      await bounded(async () => (await redis.zCard(ACTIVE_REQUESTS_KEY)) === 0 && removal!.mock.calls.filter(call => call[1] === token).length === 1);
      await sleep(50); // Allow finish/close/aborted duplicate terminal events.
      const after = await snapshot();
      expect(after).toEqual(baseline);
      expect(removal!.mock.calls.filter(call => call[1] === token)).toHaveLength(1);
      await work.join();
      settled++; phase.status = 'SETTLED';
      rows.push({ point, requested, aborted, settled, token, inflight, after, ms: performance.now() - started });
      evalLayer.resetPhase();
      controllerSpy?.mockRestore(); controllerSpy = undefined;
    }
    const healthy = await request(server!).post('/api/v1/orders').set('Authorization', `Bearer ${tokens[0]}`).send(JSON.parse(body)).timeout({ response: 3000, deadline: 5000 });
    requested++;
    expect(healthy.status).toBe(201);
    expect(healthy.body.data.paymentIntentId).toBeNull();
    await bounded(async () => (await redis.zCard(ACTIVE_REQUESTS_KEY)) === 0);
    expect(await prisma.order.findUnique({ where: { id: foreign.id } })).toEqual(baseline.orders.find(o => o.id === foreign.id));
    await orderService.cancelOrder(healthy.body.data.id, buyers[0].id);
    const stable = (row: any) => { const { updatedAt: _volatile, ...business } = row; return business; };
    expect(stable(await prisma.ticketType.findUnique({ where: { id: ga.id } }))).toEqual(stable(baseline.inventory.find(t => t.id === ga.id)));
    rows.push({ healthyStatus: healthy.status, requested, aborted, settled, final: await snapshot(), ms: performance.now() - started });
    expect({ requested, aborted, settled }).toEqual({ requested: 4, aborted: 3, settled: 3 });
  } catch (error) { primary = error; } finally {
    await finalize({ primary, steps: [
      ['unblock', () => { gate?.resolve(); socket?.destroy(); }],
      ['drain owned sockets', async () => {
        for (const connection of ownedSockets) connection.destroy();
        if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
      }],
      ['join admitted mutable work', async () => { await work.join(); joined = true; }],
      ['restore instrumentation', () => { if (!joined) throw new Error('SKIPPED: unjoined work retains instrumentation'); evalLayer?.resetPhase(); controllerSpy?.mockRestore(); for (const spy of instrumentation.reverse()) spy.mockRestore(); }],
      ['revoke listener', () => revoke?.()],
      ['Redis disconnect', () => { if (!joined) throw new Error('SKIPPED: mutable work pending; runner must terminate owned process before service teardown'); return disconnectRedis(); }],
      ['Prisma disconnect', () => { if (!joined) throw new Error('SKIPPED: mutable work pending; runner must terminate owned process before service teardown'); return prisma.$disconnect(); }],
    ], receipt: () => ({ ...provenance, rows, requested, aborted, settled, pendingMutableWork: work.size, joined, elapsedMs: performance.now() - started }),
      // Exclusive invocation/source-bound publication AFTER cleanup; first failure wins.
      publish: (receipt: any) => fs.writeFileSync(path.join(artifact, `abort426-${invocation}.json`), JSON.stringify(receipt, null, 2), { flag: 'wx' }),
    });
  }
}), 45000);
