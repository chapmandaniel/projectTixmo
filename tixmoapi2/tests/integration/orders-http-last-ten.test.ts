// Retains task499 last-ten assertions in the standard managed-CI Jest lifecycle.
// This synthetic stock race does not qualify production rate or capacity limits.
import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';

jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('Last-ten test forbids notification transport');
      },
    }
  ),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => {
    const forbidden: unknown = new Proxy(
      () => {
        throw new Error('Last-ten test forbids payment provider transport');
      },
      { get: () => forbidden }
    );
    return forbidden;
  })
);

it('100 authenticated same-IP buyers compete concurrently for the last ten units', async () => {
  const ids = {
    organization: randomUUID(),
    event: randomUUID(),
    ticketType: randomUUID(),
    buyers: Array.from({ length: 100 }, () => randomUUID()),
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
  const key = `lastten-${ids.event}`;
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
  const bounded = async <T>(promise: Promise<T>): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Last-ten work did not drain')), 8000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const spies: Array<{ mockRestore: () => void }> = [];
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let server: Server | undefined;
  let clients: Array<Promise<{ buyer: string; response: request.Response }>> = [];
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  let primary: unknown;
  try {
    // Setup.ts has already admitted/bootstraped the disposable database.
    // Capture real Redis before app/limiter modules initialize their stores.
    redis = await redisModule.connectRedis();
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
      const replaced = jest.replaceProperty(config, name, 1000);
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
    const leaseBaseline = await redis.zCard(ACTIVE_REQUESTS_KEY);
    const buyers = ids.buyers.map((id, i) => ({
      id,
      email: `${key}-${i}@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Synthetic',
      lastName: `Buyer${i}`,
      emailVerified: true,
      sessionVersion: 0,
    }));
    await prisma.user.createMany({
      data: [
        ...buyers,
        { ...buyers[0], id: ids.foreign.buyer, email: `${key}-foreign@example.test` },
      ],
    });
    for (const scope of [ids, ids.foreign]) {
      await prisma.organization.create({
        data: {
          id: scope.organization,
          name: key,
          slug: `${key}-${scope.organization}`,
          type: 'PROMOTER',
        },
      });
      await prisma.event.create({
        data: {
          id: scope.event,
          organizationId: scope.organization,
          name: key,
          slug: `${key}-${scope.event}`,
          tags: [],
          status: 'PUBLISHED',
          startDatetime: new Date(Date.now() + 86400000),
        },
      });
      await prisma.ticketType.create({
        data: {
          id: scope.ticketType,
          eventId: scope.event,
          name: 'Untiered GA',
          price: 10,
          quantityTotal: 10,
          quantityAvailable: 10,
          maxPerOrder: 1,
        },
      });
    }
    await orderService.createOrder(ids.foreign.buyer, {
      items: [{ ticketTypeId: ids.foreign.ticketType, quantity: 1 }],
    });
    const foreignSnapshot = async () => ({
      organization: await prisma.organization.findUnique({
        where: { id: ids.foreign.organization },
      }),
      event: await prisma.event.findUnique({ where: { id: ids.foreign.event } }),
      buyer: await prisma.user.findUnique({ where: { id: ids.foreign.buyer } }),
      stock: await prisma.ticketType.findUnique({ where: { id: ids.foreign.ticketType } }),
      orders: await prisma.order.findMany({
        where: { eventId: ids.foreign.event },
        orderBy: { id: 'asc' },
      }),
      tickets: await prisma.ticket.findMany({
        where: { eventId: ids.foreign.event },
        orderBy: { id: 'asc' },
      }),
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
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready = 0,
      active = 0,
      maxInFlight = 0;
    const measurements: Array<{ i: number; started: number; settled: number }> = [];
    clients = buyers.map(async (buyer, i) => {
      const token = generateAccessToken({
        userId: buyer.id,
        email: buyer.email,
        role: 'CUSTOMER',
        sessionVersion: 0,
        emailVerified: true,
      });
      ready++;
      await barrier;
      const started = performance.now();
      active++;
      maxInFlight = Math.max(maxInFlight, active);
      try {
        const response = await request(url)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '127.0.0.1')
          .send({ items: [{ ticketTypeId: ids.ticketType, quantity: 1 }] })
          .timeout({ response: 5000, deadline: 8000 });
        return { buyer: buyer.id, response };
      } finally {
        active--;
        measurements.push({ i, started, settled: performance.now() });
      }
    });
    // All 100 clients reach the barrier before any request is admitted.
    const allReady = ready === 100;
    release();
    const settled = await Promise.allSettled(clients);
    await bounded(drain());
    expect(allReady).toBe(true);
    expect(maxInFlight).toBe(100);
    expect(active).toBe(0);
    expect(measurements).toHaveLength(100);
    expect(new Set(measurements.map((item) => item.i)).size).toBe(100);
    expect(measurements.every((item) => item.settled >= item.started)).toBe(true);
    console.info('task499 actual client start-to-settlement measurements', {
      maxInFlight,
      measurements,
    });
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
    const results = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    );
    const successes = results.filter((result) => result.response.status === 201);
    const soldOut = results.filter(
      (result) =>
        result.response.status === 409 &&
        result.response.body.message === 'Not enough tickets available' &&
        result.response.body.errors?.code === 'SOLD_OUT'
    );
    expect(successes).toHaveLength(10);
    expect(soldOut).toHaveLength(90);
    expect(successes.length + soldOut.length).toBe(100);
    expect(await redis.zCard(ACTIVE_REQUESTS_KEY)).toBe(leaseBaseline);
    expect(backgroundErrors).toEqual([]);
    const orders = await prisma.order.findMany({ where: { eventId: ids.event } });
    const tickets = await prisma.ticket.findMany({ where: { eventId: ids.event } });
    expect(orders).toHaveLength(10);
    expect(tickets).toHaveLength(10);
    for (const field of ['id', 'orderNumber', 'userId'] as const)
      expect(new Set(orders.map((order) => order[field])).size).toBe(10);
    for (const field of ['id', 'barcode', 'orderId'] as const)
      expect(new Set(tickets.map((ticket) => ticket[field])).size).toBe(10);
    expect(new Set(successes.map((result) => result.response.body.data.id))).toEqual(
      new Set(orders.map((order) => order.id))
    );
    for (const result of successes) {
      expect(result.response.body.data).toMatchObject({ status: 'PENDING', paymentIntentId: null });
      expect(orders.find((order) => order.id === result.response.body.data.id)).toMatchObject({
        userId: result.buyer,
        status: 'PENDING',
        paymentIntentId: null,
      });
    }
    expect(new Set(tickets.map((ticket) => ticket.orderId))).toEqual(
      new Set(orders.map((order) => order.id))
    );
    expect(
      tickets.every(
        (ticket) => ticket.inventoryState === 'HELD' && ticket.ticketTypeId === ids.ticketType
      )
    ).toBe(true);
    expect(
      await prisma.paymentAttempt.count({
        where: { orderId: { in: orders.map((order) => order.id) } },
      })
    ).toBe(0);
    expect(await prisma.ticketType.findUnique({ where: { id: ids.ticketType } })).toMatchObject({
      quantityAvailable: 0,
      quantityHeld: 10,
      quantitySold: 0,
    });
    expect(await foreignSnapshot()).toEqual(foreignBefore);
    for (const order of orders) await orderService.cancelOrder(order.id, order.userId);
    expect(await prisma.ticketType.findUnique({ where: { id: ids.ticketType } })).toMatchObject({
      quantityAvailable: 10,
      quantityHeld: 0,
      quantitySold: 0,
    });
    expect(await foreignSnapshot()).toEqual(foreignBefore);
  } catch (error) {
    primary = error;
  } finally {
    // A deadline is failure, never evidence of cancellation. Keep tracking and
    // context intact if HTTP/server/middleware/Redis work cannot be joined.
    let joined = false;
    try {
      await bounded(Promise.allSettled(clients));
      if (server?.listening)
        await bounded(
          new Promise<void>((resolve, reject) =>
            server!.close((error) => (error ? reject(error) : resolve()))
          )
        );
      await bounded(drain());
      joined = true;
    } catch (error) {
      primary ??= error;
    }
    if (joined) {
      try {
        // Preallocated event/user IDs cover partial setup and unreturned HTTP writes.
        await prisma.ticket.deleteMany({ where: { eventId: { in: events } } });
        await prisma.order.deleteMany({ where: { eventId: { in: events } } });
        await prisma.ticketType.deleteMany({ where: { eventId: { in: events } } });
        await prisma.event.deleteMany({ where: { id: { in: events } } });
        await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      } finally {
        for (const spy of spies.reverse()) spy.mockRestore();
        try {
          await redisModule.disconnectRedis();
        } finally {
          await prisma.$disconnect();
        }
      }
    } else {
      console.error(
        'Unjoined last-ten work: preserve fixtures/connections for managed job teardown',
        ids
      );
    }
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Last-ten checkout failed', { cause: primary });
  expect(backgroundErrors).toEqual([]);
}, 120000);
