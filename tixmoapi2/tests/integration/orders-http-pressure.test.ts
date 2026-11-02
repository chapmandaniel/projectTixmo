// Synthetic mounted HTTP pressure only; no browser sessions or production capacity claim.
// Existing managed-CI setup admits and bootstraps the disposable SQL target first.
// Successful201 reservation p95 must be <=2 seconds; all-attempt latency is separate. Suite-only limiter/admission maxima4000
// keep this measurement separate from deployed rate/capacity qualification.
import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

let mockTransportCalls = 0;
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy(
    {},
    {
      get: () => () => {
        mockTransportCalls++;
        throw new Error('Pressure test forbids notification transport');
      },
    }
  ),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => {
    const forbidden: unknown = new Proxy(
      () => {
        mockTransportCalls++;
        throw new Error('Pressure test forbids payment provider transport');
      },
      { get: () => forbidden }
    );
    return forbidden;
  })
);

it('1800 authenticated HTTP attempts scheduled at30 per second for60 seconds conserve reservations', async () => {
  const ids = {
    organization: randomUUID(),
    event: randomUUID(),
    ticketType: randomUUID(),
    vip: randomUUID(),
    buyers: Array.from({ length: 1800 }, () => randomUUID()),
    foreign: {
      organization: randomUUID(),
      event: randomUUID(),
      ticketType: randomUUID(),
      buyer: randomUUID(),
    },
  };
  const events = [ids.event, ids.foreign.event];
  const organizations = [ids.organization, ids.foreign.organization];
  const users = [...ids.buyers, ids.foreign.buyer];
  const key = `pressure-${ids.event}`;
  let unsafe = false;
  const check = () => {
    if (unsafe) throw new Error('Unjoined pressure work');
  };
  const pending = new Set<Promise<unknown>>();
  const backgroundErrors: unknown[] = [];
  const track = <T>(promise: Promise<T>, reportError = true): Promise<T> => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      (error) => {
        pending.delete(promise);
        if (reportError) backgroundErrors.push(error);
      }
    );
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, milliseconds = 12000): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            unsafe = true;
            reject(new Error('Pressure work did not drain'));
          }, milliseconds);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const database = <T>(work: () => Promise<T>) => {
    check();
    return bounded(track(work()));
  };
  const spies: Array<{ mockRestore: () => void }> = [];
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let server: Server | undefined;
  const clients: Array<Promise<void>> = [];
  let leaseBaseline = 0;
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  let primary: unknown;
  let bodyWork: Promise<void> | undefined;
  let metricsRecord: Record<string, string | number | boolean> | undefined;
  const receiptPath = path.resolve(__dirname, '../../../runtime/task608-http-pressure.json');
  const body = async () => {
    expect(fs.existsSync(receiptPath)).toBe(false);
    // Setup.ts has already admitted/bootstraped the disposable database.
    // Capture real Redis before app/limiter modules initialize their stores.
    redis = await database(() => redisModule.connectRedis());
    expect(redis.isReady).toBe(true);
    for (const name of ['zRem', 'eval', 'sendCommand'] as const) {
      // Preserve redis's overloaded method contract while observing actual promises.
      const target = redis as any;
      const original = target[name].bind(redis);
      spies.push(
        jest
          .spyOn(target, name)
          .mockImplementation((...args: unknown[]) => track(original(...args)))
      );
    }
    const asyncModule = await import('../../src/utils/catchAsync');
    spies.push(
      jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn) => (req, res, next) => {
        void track(Promise.resolve(fn(req, res, next)), false).catch(next);
      })
    );
    const { config } = await import('../../src/config/environment');
    expect(config.nodeEnv).toBe('test');
    // Explicit suite-local synthetic maxima; restored after the app is drained.
    for (const name of [
      'rateLimitWriteMax',
      'rateLimitReadMax',
      'waitingRoomMaxConcurrentRequests',
    ] as const) {
      const replaced = jest.replaceProperty(config, name, 4000);
      spies.push({ mockRestore: () => replaced.restore() });
    }
    // Middleware may continue after a client deadline; observe its actual promise
    // before app/routes capture the exports. Preserve the real next() behavior.
    const auth = await import('../../src/middleware/auth');
    const waiting = await import('../../src/middleware/waitingRoom');
    const limiter = await import('../../src/middleware/rateLimiter');
    for (const [module, names] of [
      [auth, ['authenticate', 'optionalAuthenticate']],
      [waiting, ['waitingRoom']],
      [
        limiter,
        [
          'apiReadRateLimiter',
          'apiWriteRateLimiter',
          'authRateLimiter',
          'authAccountRateLimiter',
          'checkoutActorRateLimiter',
          'checkoutIpRateLimiter',
        ],
      ],
    ] as Array<[any, string[]]>) {
      for (const name of names) {
        const original = module[name];
        spies.push(
          jest
            .spyOn(module, name)
            .mockImplementation((...args: any[]) => track(Promise.resolve(original(...args))))
        );
      }
    }
    const validation = await import('../../src/middleware/validate');
    const realValidate = validation.validate;
    spies.push(
      jest.spyOn(validation, 'validate').mockImplementation((schema) => {
        const handler = realValidate(schema);
        return (...args: Parameters<typeof handler>) => track(Promise.resolve(handler(...args)));
      })
    );
    const app = (await import('../../src/app')).default;
    const { orderService } = await import('../../src/api/orders/service');
    const { generateAccessToken } = await import('../../src/utils/jwt');
    const { ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom');
    leaseBaseline = await database(() => redis!.zCard(ACTIVE_REQUESTS_KEY));
    const buyers = ids.buyers.map((id, i) => ({
      id,
      email: `${key}-${i}@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Synthetic',
      lastName: `Buyer${i}`,
      emailVerified: true,
      sessionVersion: 0,
    }));
    await database(() =>
      prisma.user.createMany({
        data: [
          ...buyers,
          { ...buyers[0], id: ids.foreign.buyer, email: `${key}-foreign@example.test` },
        ],
      })
    );
    for (const scope of [ids, ids.foreign]) {
      await database(() =>
        prisma.organization.create({
          data: {
            id: scope.organization,
            name: key,
            slug: `${key}-${scope.organization}`,
            type: 'PROMOTER',
          },
        })
      );
      await database(() =>
        prisma.event.create({
          data: {
            id: scope.event,
            organizationId: scope.organization,
            name: key,
            slug: `${key}-${scope.event}`,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        })
      );
      await database(() =>
        prisma.ticketType.create({
          data: {
            id: scope.ticketType,
            eventId: scope.event,
            name: 'Untiered GA',
            price: 10,
            quantityTotal: scope === ids ? 1800 : 10,
            quantityAvailable: scope === ids ? 1800 : 10,
            maxPerOrder: 4,
          },
        })
      );
    }
    await database(() =>
      prisma.ticketType.create({
        data: {
          id: ids.vip,
          eventId: ids.event,
          name: 'VIP',
          price: 20,
          quantityTotal: 200,
          quantityAvailable: 200,
          maxPerOrder: 4,
        },
      })
    );
    await database(() =>
      orderService.createOrder(ids.foreign.buyer, {
        items: [{ ticketTypeId: ids.foreign.ticketType, quantity: 1 }],
      })
    );
    const foreignSnapshot = async () => ({
      organization: await database(() =>
        prisma.organization.findUnique({
          where: { id: ids.foreign.organization },
        })
      ),
      event: await database(() => prisma.event.findUnique({ where: { id: ids.foreign.event } })),
      buyer: await database(() => prisma.user.findUnique({ where: { id: ids.foreign.buyer } })),
      stock: await database(() =>
        prisma.ticketType.findUnique({ where: { id: ids.foreign.ticketType } })
      ),
      orders: await database(() =>
        prisma.order.findMany({
          where: { eventId: ids.foreign.event },
          orderBy: { id: 'asc' },
        })
      ),
      tickets: await database(() =>
        prisma.ticket.findMany({
          where: { eventId: ids.foreign.event },
          orderBy: { id: 'asc' },
        })
      ),
    });
    const foreignBefore = await foreignSnapshot();
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', () => {
        server!.off('error', reject);
        resolve();
      });
    });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    type Measurement = {
      i: number;
      buyer: string;
      target: number;
      started: number;
      settled: number;
      status: number;
      soldOut: boolean;
      orderId?: string;
    };
    const measurements: Measurement[] = [];
    const tokens = buyers.map((buyer) =>
      generateAccessToken({
        userId: buyer.id,
        email: buyer.email,
        role: 'CUSTOMER',
        sessionVersion: 0,
        emailVerified: true,
      })
    );
    let active = 0,
      maxInFlight = 0;
    const start = performance.now();
    const invoke = async (i: number) => {
      const started = performance.now() - start;
      active++;
      maxInFlight = Math.max(maxInFlight, active);
      let status = 0,
        soldOut = false,
        orderId: string | undefined;
      try {
        const response = await request(url)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${tokens[i]}`)
          .set('X-Forwarded-For', '127.0.0.1')
          .send({ items: [{ ticketTypeId: ids.ticketType, quantity: 2 }] })
          .timeout({ response: 5000, deadline: 8000 });
        status = response.status;
        soldOut =
          status === 409 &&
          response.body.message === 'Not enough tickets available' &&
          response.body.errors?.code === 'SOLD_OUT';
        if (status === 201) orderId = response.body.data.id as string;
      } catch {
        /* Network/deadline failures remain explicit failures below, never cancellation proof. */
      } finally {
        active--;
        measurements.push({
          i,
          buyer: buyers[i].id,
          target: (i * 1000) / 30,
          started,
          settled: performance.now() - start,
          status,
          soldOut,
          orderId,
        });
      }
    };
    for (let i = 0; i < 1800; i++) {
      check();
      const target = start + (i * 1000) / 30;
      while (performance.now() < target)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(1, target - performance.now()))
        );
      check();
      clients.push(track(invoke(i), false));
    }
    const remainingWindow = start + 60000 - performance.now();
    if (remainingWindow > 0) await new Promise((resolve) => setTimeout(resolve, remainingWindow));
    await Promise.all(clients);
    await bounded(drain());
    const { percentile } = require('../../../scripts/http-pressure-receipt.cjs') as {
      percentile: (values: number[], fraction: number) => number;
    };
    const latency = measurements.map((row) => row.settled - row.started);
    const lateness = measurements.map((row) => Math.max(0, row.started - row.target));
    const successes = measurements.filter((row) => row.status === 201);
    const orders = await database(() => prisma.order.findMany({ where: { eventId: ids.event } }));
    const tickets = await database(() => prisma.ticket.findMany({ where: { eventId: ids.event } }));
    const ga = await database(() =>
      prisma.ticketType.findUniqueOrThrow({ where: { id: ids.ticketType } })
    );
    const vip = await database(() =>
      prisma.ticketType.findUniqueOrThrow({ where: { id: ids.vip } })
    );
    const attempts = await database(() =>
      prisma.paymentAttempt.count({ where: { orderId: { in: orders.map((row) => row.id) } } })
    );
    const metrics = {
      scope: 'task608-http-reservation-pressure',
      syntheticMaxima: 4000,
      limitsQualified: false,
      testAssertionsPassed: false,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
      sourceSha: process.env.TIXMO_PRESSURE_SOURCE_SHA || 'local-synthetic',
      runId: process.env.TIXMO_PRESSURE_RUN_ID || 'local-synthetic',
      scheduledAttempts: 1800,
      startedAttempts: clients.length,
      completedAttempts: measurements.length,
      windowMs: 60000,
      elapsedMs: Math.max(0, ...measurements.map((row) => row.settled)),
      maxInFlight,
      remainingActive: active,
      http201: successes.length,
      soldOut409: measurements.filter((row) => row.soldOut).length,
      http429: measurements.filter((row) => row.status === 429).length,
      http503: measurements.filter((row) => row.status === 503).length,
      otherStatus: measurements.filter(
        (row) =>
          row.status !== 0 &&
          row.status !== 201 &&
          !row.soldOut &&
          row.status !== 429 &&
          row.status !== 503
      ).length,
      networkErrors: measurements.filter((row) => row.status === 0).length,
      allAttemptP50Ms: percentile(latency, 0.5),
      allAttemptP95Ms: percentile(latency, 0.95),
      reservationP95Ms: percentile(
        successes.map((row) => row.settled - row.started),
        0.95
      ),
      allAttemptP99Ms: percentile(latency, 0.99),
      allAttemptMaxMs: Math.max(0, ...latency),
      latenessP95Ms: percentile(lateness, 0.95),
      latenessMaxMs: Math.max(0, ...lateness),
      lateStarts: measurements.filter((row) => row.started - row.target > 100).length,
      firstStartMs: Math.min(...measurements.map((row) => row.started)),
      lastStartMs: Math.max(0, ...measurements.map((row) => row.started)),
      finishAfterWindowMs: Math.max(0, Math.max(...measurements.map((row) => row.settled)) - 60000),
      gaAvailable: ga.quantityAvailable,
      gaHeld: ga.quantityHeld,
      gaSold: ga.quantitySold,
      vipAvailable: vip.quantityAvailable,
      vipHeld: vip.quantityHeld,
      vipSold: vip.quantitySold,
      orders: orders.length,
      tickets: tickets.length,
      paymentAttempts: attempts,
      leaseDelta: (await database(() => redis!.zCard(ACTIVE_REQUESTS_KEY))) - leaseBaseline,
    };
    metricsRecord = metrics;
    check();
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(metrics) + '\n', { flag: 'wx', mode: 0o600 });
    expect(clients).toHaveLength(1800);
    expect(measurements).toHaveLength(1800);
    expect(new Set(measurements.map((row) => row.i)).size).toBe(1800);
    expect(active).toBe(0);
    expect(backgroundErrors).toEqual([]);
    expect(mockTransportCalls).toBe(0);
    expect(metrics.leaseDelta).toBe(0);
    expect(metrics.firstStartMs).toBeGreaterThanOrEqual(0);
    expect(metrics.lastStartMs).toBeGreaterThanOrEqual(59000);
    expect(metrics.lastStartMs).toBeLessThan(65000);
    expect(metrics.latenessMaxMs).toBeLessThan(1000);
    expect(metrics.elapsedMs).toBeLessThan(90000);
    expect(metrics.allAttemptP95Ms).toBeLessThanOrEqual(2000);
    expect(metrics.reservationP95Ms).toBeLessThanOrEqual(2000);
    expect(metrics.http201).toBe(900);
    expect(metrics.soldOut409).toBe(900);
    expect(metrics.networkErrors + metrics.otherStatus + metrics.http429 + metrics.http503).toBe(0);
    expect(ga).toMatchObject({
      quantityTotal: 1800,
      quantityAvailable: 0,
      quantityHeld: 1800,
      quantitySold: 0,
    });
    expect(vip).toMatchObject({
      quantityTotal: 200,
      quantityAvailable: 200,
      quantityHeld: 0,
      quantitySold: 0,
    });
    expect(orders).toHaveLength(900);
    expect(tickets).toHaveLength(1800);
    expect(attempts).toBe(0);
    for (const field of ['id', 'orderNumber', 'userId'] as const)
      expect(new Set(orders.map((row) => row[field])).size).toBe(900);
    for (const field of ['id', 'barcode'] as const)
      expect(new Set(tickets.map((row) => row[field])).size).toBe(1800);
    expect(new Set(successes.map((row) => row.orderId))).toEqual(
      new Set(orders.map((row) => row.id))
    );
    expect(new Set(tickets.map((row) => row.orderId))).toEqual(
      new Set(orders.map((row) => row.id))
    );
    for (const order of orders) {
      expect(order).toMatchObject({ status: 'PENDING', currency: 'cad', paymentIntentId: null });
      expect(order.paymentStatus).not.toBe('SUCCEEDED');
      expect(successes.find((row) => row.orderId === order.id)?.buyer).toBe(order.userId);
      const ownedTickets = tickets.filter((ticket) => ticket.orderId === order.id);
      expect(ownedTickets).toHaveLength(2);
      expect(ownedTickets.every((ticket) => ticket.userId === order.userId)).toBe(true);
    }
    expect(
      tickets.every(
        (ticket) => ticket.inventoryState === 'HELD' && ticket.ticketTypeId === ids.ticketType
      )
    ).toBe(true);
    expect(await foreignSnapshot()).toEqual(foreignBefore);
    metricsRecord.testAssertionsPassed = true;
  };
  try {
    bodyWork = body();
    await bounded(bodyWork, 120000);
  } catch (error) {
    primary = error;
  } finally {
    // A deadline is failure, never evidence of cancellation. Keep tracking and
    // context intact if HTTP/server/middleware/Redis work cannot be joined.
    let joined = false;
    try {
      await bounded(Promise.allSettled([...(bodyWork ? [bodyWork] : []), ...clients]));
      if (server?.listening)
        await bounded(
          new Promise<void>((resolve, reject) =>
            server!.close((error) => (error ? reject(error) : resolve()))
          )
        );
      await bounded(drain());
      joined = !unsafe;
    } catch (error) {
      primary ??= error;
    }
    if (joined) {
      const cleanup = async () => {
        // Preallocated event/user IDs cover partial setup and unreturned HTTP writes.
        await database(() => prisma.ticket.deleteMany({ where: { eventId: { in: events } } }));
        await database(() => prisma.order.deleteMany({ where: { eventId: { in: events } } }));
        await database(() => prisma.ticketType.deleteMany({ where: { eventId: { in: events } } }));
        await database(() => prisma.event.deleteMany({ where: { id: { in: events } } }));
        await database(() =>
          prisma.organization.deleteMany({ where: { id: { in: organizations } } })
        );
        await database(() => prisma.user.deleteMany({ where: { id: { in: users } } }));
        expect(
          await database(() => prisma.order.count({ where: { eventId: { in: events } } }))
        ).toBe(0);
        expect(
          await database(() => prisma.ticket.count({ where: { eventId: { in: events } } }))
        ).toBe(0);
        expect(
          await database(() => prisma.ticketType.count({ where: { eventId: { in: events } } }))
        ).toBe(0);
        expect(await database(() => prisma.event.count({ where: { id: { in: events } } }))).toBe(0);
        expect(
          await database(() => prisma.organization.count({ where: { id: { in: organizations } } }))
        ).toBe(0);
        expect(await database(() => prisma.user.count({ where: { id: { in: users } } }))).toBe(0);
        if (metricsRecord) metricsRecord.cleanupVerified = true;
      };
      try {
        await bounded(track(cleanup(), false), 30000);
      } catch (error) {
        primary ??= error;
      }
      try {
        await bounded(drain());
      } catch (error) {
        primary ??= error;
      }
      if (!unsafe) {
        for (const spy of spies.reverse()) spy.mockRestore();
        try {
          await bounded(track(redisModule.disconnectRedis()));
          if (!unsafe) await bounded(track(prisma.$disconnect()));
          if (!unsafe && metricsRecord) metricsRecord.lifetimeCleanupVerified = true;
        } catch (error) {
          primary ??= error;
        }
      }
    } else {
      console.error(
        'Unjoined pressure work: preserve fixtures/connections for managed job teardown',
        'Managed job teardown owns retained context'
      );
    }
  }
  if (metricsRecord && fs.existsSync(receiptPath)) {
    metricsRecord.testAssertionsPassed =
      metricsRecord.testAssertionsPassed === true &&
      primary === undefined &&
      backgroundErrors.length === 0 &&
      mockTransportCalls === 0 &&
      metricsRecord.cleanupVerified === true &&
      metricsRecord.lifetimeCleanupVerified === true;
    const file = fs.lstatSync(receiptPath);
    if (!file.isFile() || file.isSymbolicLink())
      throw new Error('Pressure receipt ownership changed');
    fs.writeFileSync(receiptPath, JSON.stringify(metricsRecord) + '\n', { mode: 0o600 });
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Pressure checkout failed', { cause: primary });
  expect(backgroundErrors).toEqual([]);
  expect(mockTransportCalls).toBe(0);
}, 240000);
