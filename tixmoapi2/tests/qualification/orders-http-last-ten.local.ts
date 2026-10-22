// Task499 SOURCE ONLY. Non-test suffix excludes normal Jest collection.
// Additive adaptation of379 HTTP source and426 exact510824df instrumentation.
// No runner is supplied or authorized by this file. An independently reviewed
// process guard must establish disposable DB/Redis and provider/network denial.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({ notificationService: new Proxy({}, { get() { return () => { throw new Error('Task499 notifications forbidden'); }; } }) }));

test('100 authenticated barrier buyers compete for the last ten untiered units', async () => {
  // Fail BEFORE product imports/resources, not merely before the first request.
  const net = require('node:net');
  const guard = net[Symbol.for('tixmo.task499.admitDisposable')];
  if (typeof guard !== 'function') throw new Error('STOP: reviewed task499 process admission is absent');
  await guard(__filename); // Must verify source binding, sole targets and deny providers.
  const register = net[Symbol.for('tixmo.task379.registerListener')];
  if (typeof register !== 'function') throw new Error('STOP: owned listener guard absent');
  const crypto = require('node:crypto');
  const http = require('node:http');
  const request = require('supertest');
  const { checkoutOwnership, promiseMiddleware, preallocateCheckout, criticalCall } = require('./task499/ownership.cjs');
  const ids = preallocateCheckout(() => crypto.randomUUID());
  const work = checkoutOwnership(ids, 8000);
  const spies: Array<Pick<jest.SpyInstance, 'mockRestore'>> = [];
  // Type queries are erased: product evaluation remains behind process admission.
  let redis!: Awaited<ReturnType<typeof import('../../src/config/redis').connectRedis>>;
  let prisma!: typeof import('../../src/config/prisma').default;
  let disconnectRedis: typeof import('../../src/config/redis').disconnectRedis | undefined;
  let server: any, revoke: any;
  let primary: unknown, admitting = true;
  let active = 0, maxInFlight = 0;
  const measurements: Array<{ i: number; started: number; settled: number }> = [];
  const key = `lastten499-${ids.event}`;
  // No timer/interval observer is created. Snapshot observations are raw tracked
  // operations and are finished before stopping admission and terminal drainage.
  try {
    const redisModule: typeof import('../../src/config/redis') = require('../../src/config/redis');
    disconnectRedis = redisModule.disconnectRedis;
    redis = await work.critical(() => redisModule.connectRedis()); // before app capture
    const prismaModule: typeof import('../../src/config/prisma') = require('../../src/config/prisma');
    prisma = prismaModule.default;
    const asyncModule: typeof import('../../src/utils/catchAsync') = require('../../src/utils/catchAsync');
    spies.push(jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn) =>
      (req, res, next) => { void work.run(() => fn(req, res, next)).catch(next); }));
    const auth: typeof import('../../src/middleware/auth') = require('../../src/middleware/auth');
    const waitingRoom: typeof import('../../src/middleware/waitingRoom') = require('../../src/middleware/waitingRoom');
    const realAuthenticate = auth.authenticate;
    spies.push(jest.spyOn(auth, 'authenticate').mockImplementation(promiseMiddleware(realAuthenticate, work)));
    const realOptionalAuthenticate = auth.optionalAuthenticate;
    spies.push(jest.spyOn(auth, 'optionalAuthenticate').mockImplementation(promiseMiddleware(realOptionalAuthenticate, work)));
    const realWaitingRoom = waitingRoom.waitingRoom;
    spies.push(jest.spyOn(waitingRoom, 'waitingRoom').mockImplementation(promiseMiddleware(realWaitingRoom, work)));
    const validation: typeof import('../../src/middleware/validate') = require('../../src/middleware/validate');
    const realValidate = validation.validate;
    spies.push(jest.spyOn(validation, 'validate').mockImplementation((schema) => {
      const handler = realValidate(schema);
      return (...args: Parameters<typeof handler>) => work.run(() => handler(...args));
    }));
    //426 detached actual Redis promises, not only client or middleware wrappers.
    for (const name of ['zRem', 'eval', 'sendCommand'] as const) {
      const original = redis[name].bind(redis);
      spies.push(jest.spyOn(redis, name).mockImplementation(criticalCall(original, work)));
    }
    const limiter: typeof import('../../src/middleware/rateLimiter') = require('../../src/middleware/rateLimiter');
    for (const name of ['apiReadRateLimiter', 'apiWriteRateLimiter', 'authRateLimiter'] as const) {
      const original = limiter[name];
      spies.push(jest.spyOn(limiter, name).mockImplementation(promiseMiddleware(original, work)));
    }
    const app = (await work.critical(() => import('../../src/app'))).default; // NOT bootstrap/jobs
    const { orderService }: typeof import('../../src/api/orders/service') = require('../../src/api/orders/service');
    const { generateAccessToken }: typeof import('../../src/utils/jwt') = require('../../src/utils/jwt');
    await work.critical(async () => { expect(await redis.dbSize()).toBe(0); });
    const buyers = ids.buyers.map((id: string, i: number) => ({ id, email: `${key}-${i}@example.test`, passwordHash: 'synthetic', firstName: 'Synthetic', lastName: `Buyer${i}`, emailVerified: true, sessionVersion: 0 }));
    await work.critical(async () => {
      await prisma.user.createMany({ data: [...buyers, { ...buyers[0], id: ids.foreign.buyer, email: `${key}-foreign@example.test` }] });
      for (const scope of [{ organization: ids.organization, event: ids.event, ticketType: ids.ticketType }, ids.foreign]) {
        await prisma.organization.create({ data: { id: scope.organization, name: key, slug: `${key}-${scope.organization}`, type: 'PROMOTER' } });
        await prisma.event.create({ data: { id: scope.event, organizationId: scope.organization, name: key, slug: `${key}-${scope.event}`, tags: [], status: 'PUBLISHED', startDatetime: new Date(Date.now() + 86400000) } });
        await prisma.ticketType.create({ data: { id: scope.ticketType, eventId: scope.event, name: 'Untiered GA', price: 10, quantityTotal: 10, quantityAvailable: 10, maxPerOrder: 1 } });
      }
      await orderService.createOrder(ids.foreign.buyer, { items: [{ ticketTypeId: ids.foreign.ticketType, quantity: 1 }] });
    });
    const foreignSnapshot = () => work.critical(async () => ({
      organization: await prisma.organization.findUnique({ where: { id: ids.foreign.organization } }),
      event: await prisma.event.findUnique({ where: { id: ids.foreign.event } }),
      buyer: await prisma.user.findUnique({ where: { id: ids.foreign.buyer } }),
      stock: await prisma.ticketType.findUnique({ where: { id: ids.foreign.ticketType } }),
      orders: await prisma.order.findMany({ where: { eventId: ids.foreign.event }, orderBy: { id: 'asc' } }),
      tickets: await prisma.ticket.findMany({ where: { eventId: ids.foreign.event }, orderBy: { id: 'asc' } }),
    }));
    const foreignBefore = await foreignSnapshot();
    await work.critical(() => {
      server = http.createServer((req: any, res: any) => {
        if (!admitting) { res.statusCode = 503; res.end(); return; }
        app(req, res);
      });
      return new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
    });
    revoke = register(server);
    const url = `http://127.0.0.1:${server.address().port}`;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    let ready = 0;
    const clients = buyers.map((buyer: any, i: number) => work.run(async () => {
      ready++; await barrier; work.admit();
      const started = performance.now(); active++; maxInFlight = Math.max(maxInFlight, active);
      try {
        const token = generateAccessToken({ userId: buyer.id, email: buyer.email, role: 'CUSTOMER', sessionVersion: 0, emailVerified: true });
        const response = await request(url).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).set('X-Forwarded-For', '127.0.0.1').send({ items: [{ ticketTypeId: ids.ticketType, quantity: 1 }] }).timeout({ response: 5000, deadline: 8000 });
        return { buyer: buyer.id, response };
      } finally { active--; measurements.push({ i, started, settled: performance.now() }); }
    }));
    await Promise.resolve(); expect(ready).toBe(100); release();
    const settled = await Promise.allSettled(clients); await work.join();
    expect(settled.every(r => r.status === 'fulfilled')).toBe(true);
    const results = settled.map((r: any) => r.value);
    const successes = results.filter((r: any) => r.response.status === 201);
    const soldOut = results.filter((r: any) => r.response.status === 400 && r.response.body.message === 'Not enough tickets available');
    expect(successes).toHaveLength(10); expect(soldOut).toHaveLength(90);
    expect(successes.length + soldOut.length).toBe(100);
    expect(maxInFlight).toBe(100); expect(active).toBe(0); expect(measurements).toHaveLength(100);
    console.info('task499 actual client start-to-settlement measurements', { maxInFlight, measurements });
    await work.critical(async () => {
      const { ACTIVE_REQUESTS_KEY }: typeof import('../../src/middleware/waitingRoom') = require('../../src/middleware/waitingRoom');
      expect(await redis.zCard(ACTIVE_REQUESTS_KEY)).toBe(0);
    });
    await work.critical(async () => {
      const orders = await prisma.order.findMany({ where: { eventId: ids.event } });
      const tickets = await prisma.ticket.findMany({ where: { eventId: ids.event } });
      expect(orders).toHaveLength(10); expect(tickets).toHaveLength(10);
      for (const field of ['id', 'orderNumber', 'userId']) expect(new Set(orders.map((o: any) => o[field])).size).toBe(10);
      for (const field of ['id', 'barcode', 'orderId']) expect(new Set(tickets.map((t: any) => t[field])).size).toBe(10);
      expect(new Set(successes.map((r: any) => r.response.body.data.id))).toEqual(new Set(orders.map((o: any) => o.id)));
      for (const result of successes) {
        expect(result.response.body.data).toMatchObject({ status: 'PENDING', paymentIntentId: null });
        expect(orders.find((o: any) => o.id === result.response.body.data.id)).toMatchObject({ userId: result.buyer, status: 'PENDING', paymentIntentId: null });
      }
      expect(new Set(tickets.map((t: any) => t.orderId))).toEqual(new Set(orders.map((o: any) => o.id)));
      expect(tickets.every((t: any) => t.inventoryState === 'HELD' && t.ticketTypeId === ids.ticketType)).toBe(true);
      expect(await prisma.ticketType.findUnique({ where: { id: ids.ticketType } })).toMatchObject({ quantityAvailable: 0, quantityHeld: 10, quantitySold: 0 });
    });
    expect(await foreignSnapshot()).toEqual(foreignBefore);
    await work.critical(async () => {
      const orders = await prisma.order.findMany({ where: { eventId: ids.event, status: 'PENDING' } });
      for (const order of orders) await orderService.cancelOrder(order.id, order.userId);
      expect(await prisma.ticketType.findUnique({ where: { id: ids.ticketType } })).toMatchObject({ quantityAvailable: 10, quantityHeld: 0, quantitySold: 0 });
    });
    expect(await foreignSnapshot()).toEqual(foreignBefore);
  } catch (error) { primary = error; }
  finally {
    admitting = false; work.stop(); // no observers/new external admission after this point
    try {
      // Track actual close callback BEFORE terminal join. Keep continuation spies
      // installed until close AND all already-admitted raw work have settled.
      if (server?.listening) void work.run(() => new Promise<void>((resolve, reject) => server.close((error: any) => {
        if (!error) { resolve(); return; }
        try { work.preserve(error); } catch (preserved) { reject(preserved); }
      }))).catch((error: any) => { try { work.preserve(error); } catch {} });
      await work.teardown([
        // Fixtures deliberately retained for owned-process disposable-target teardown;
        // never delete globals or assume HTTP-returned IDs exhaust partial writes.
        () => { revoke?.(); },
        () => disconnectRedis?.(),
        () => prisma?.$disconnect(),
        () => { for (const spy of spies.reverse()) spy.mockRestore(); },
      ]);
    } catch (error) { if (!primary) primary = error; }
  }
  if (primary) throw primary;
}, 90000);
