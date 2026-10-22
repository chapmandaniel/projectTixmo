// Managed-CI integration acceptance: actual app/auth/SQL/Redis, synthetic transport only.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('stripe', () =>
  jest.fn(() => {
    throw new Error('Unexpected provider transport');
  })
);
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('Unexpected notification transport');
      },
    }
  ),
}));
import http from 'http';
import net from 'net';
import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { connectRedis, disconnectRedis } from '../../src/config/redis';
import { config } from '../../src/config/environment';
import { generateAccessToken } from '../../src/utils/jwt';

function gate<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('HTTP abort qualification deadline')), 8000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

test('socket abort after Redis acquire and after service admission releases each lease once', async () => {
  const started = performance.now();
  const ids = {
    org: randomUUID(),
    event: randomUUID(),
    type: randomUUID(),
    buyer: randomUUID(),
    foreign: randomUUID(),
  };
  const pending = new Set<Promise<unknown>>();
  const failures: unknown[] = [];
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      (error) => {
        failures.push(error);
        pending.delete(promise);
      }
    );
    return promise;
  };
  const join = async () => {
    // A tracked continuation may enqueue further tracked work before it settles.
    while (pending.size) await bounded(Promise.allSettled([...pending]));
  };
  const spies: jest.SpyInstance[] = [];
  const sockets = new Set<net.Socket>();
  const clients: http.ClientRequest[] = [];
  const clientClosed: Promise<void>[] = [];
  const releases: Array<() => void> = [];
  const saved = {
    stripeSecretKey: config.stripeSecretKey,
    rateLimitWriteMax: config.rateLimitWriteMax,
    waitingRoomMaxConcurrentRequests: config.waitingRoomMaxConcurrentRequests,
  };
  let redis: Awaited<ReturnType<typeof connectRedis>> | undefined;
  let server: http.Server | undefined;
  let primary: unknown;
  let joined = false;
  const removals: Array<{ token: string; ack: Promise<number> }> = [];
  const tokens: string[] = [];
  let phase:
    | {
        kind: string;
        reached: ReturnType<typeof gate>;
        resume: ReturnType<typeof gate>;
        terminal: ReturnType<typeof gate>;
        removed: ReturnType<typeof gate<Promise<number>>>;
      }
    | undefined;
  try {
    config.stripeSecretKey = ''; // Constructor cannot instantiate even synthetic provider transport.
    config.rateLimitWriteMax = 10000;
    config.waitingRoomMaxConcurrentRequests = 10;
    redis = await connectRedis(); // Before app/limiter module initialization.
    const asyncModule = await import('../../src/utils/catchAsync');
    spies.push(
      jest.spyOn(asyncModule, 'catchAsync').mockImplementation(
        (fn: any) =>
          ((req: any, res: any, next: any) => {
            void track(Promise.resolve().then(() => fn(req, res, next))).catch(next);
          }) as any
      )
    );
    const auth = await import('../../src/middleware/auth');
    const waiting = await import('../../src/middleware/waitingRoom');
    const limiter = await import('../../src/middleware/rateLimiter');
    // Preserve all middleware behavior while exposing their asynchronous lifetimes.
    for (const [module, names] of [
      [auth, ['authenticate', 'optionalAuthenticate']],
      [waiting, ['waitingRoom']],
      [limiter, ['apiReadRateLimiter', 'apiWriteRateLimiter', 'authRateLimiter']],
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
      jest.spyOn(validation, 'validate').mockImplementation((schema: any) => {
        const handler = realValidate(schema);
        return ((...args: any[]) => track(Promise.resolve((handler as any)(...args)))) as any;
      })
    );
    const realEval = redis.eval.bind(redis);
    spies.push(
      jest.spyOn(redis, 'eval').mockImplementation(((script: string, options: any) =>
        track(
          (async () => {
            const result = await realEval(script, options);
            if (script === waiting.ACQUIRE_REQUEST_LEASE) {
              const token = options.arguments[0];
              tokens.push(token);
              if (phase?.kind === 'acquire') {
                expect(Number(result)).toBe(1);
                phase.reached.resolve();
                await phase.resume.promise; // Real ZADD committed; middleware has not received ACK.
              }
            }
            return result;
          })()
        )) as any)
    );
    const realRemove = redis.zRem.bind(redis);
    spies.push(
      jest.spyOn(redis, 'zRem').mockImplementation(((key: string, token: string) => {
        const ack = track(realRemove(key, token));
        removals.push({ token, ack });
        phase?.removed.resolve(ack);
        return ack;
      }) as any)
    );
    const realCommand = redis.sendCommand.bind(redis);
    spies.push(
      jest
        .spyOn(redis, 'sendCommand')
        .mockImplementation(((...args: any[]) => track((realCommand as any)(...args))) as any)
    );
    const { orderService } = await import('../../src/api/orders/service');
    const realCreate = orderService.createOrder.bind(orderService);
    spies.push(
      jest.spyOn(orderService, 'createOrder').mockImplementation(((
        ...args: Parameters<typeof realCreate>
      ) =>
        track(
          (async () => {
            if (phase?.kind === 'service') {
              phase.reached.resolve();
              await phase.resume.promise;
            }
            return realCreate(...args); // A committed pending reservation legitimately survives socket abort.
          })()
        )) as any)
    );
    const { default: app } = await import('../../src/app');
    const baselineLeases = await redis.zRangeWithScores(waiting.ACTIVE_REQUESTS_KEY, 0, -1);
    server = http.createServer(app);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    server.prependListener('request', (req, res) => {
      const current = phase;
      if (current) {
        req.once('aborted', () => current.terminal.resolve());
        res.once('close', () => current.terminal.resolve());
      }
    });
    await bounded(
      new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(0, '127.0.0.1', resolve);
      })
    );
    const port = (server.address() as net.AddressInfo).port;
    await prisma.organization.create({
      data: { id: ids.org, name: ids.org, slug: ids.org, type: 'PROMOTER' },
    });
    const buyers = [];
    for (const id of [ids.buyer, ids.foreign]) {
      buyers.push(
        await prisma.user.create({
          data: {
            id,
            email: `${id}@example.test`,
            passwordHash: 'synthetic',
            firstName: 'Synthetic',
            lastName: 'Abort',
            emailVerified: true,
          },
        })
      );
    }
    await prisma.event.create({
      data: {
        id: ids.event,
        organizationId: ids.org,
        name: ids.event,
        slug: ids.event,
        tags: [],
        status: 'PUBLISHED',
        startDatetime: new Date(Date.now() + 86400000),
      },
    });
    await prisma.ticketType.create({
      data: {
        id: ids.type,
        eventId: ids.event,
        name: 'GA',
        price: 10,
        quantityTotal: 3,
        quantityAvailable: 3,
        maxPerOrder: 3,
      },
    });
    const input = { items: [{ ticketTypeId: ids.type, quantity: 1 }] };
    const foreign = await orderService.createOrder(ids.foreign, input);
    const foreignSnapshot = () =>
      prisma.order.findUniqueOrThrow({
        where: { id: foreign.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
    const foreignBefore = await foreignSnapshot();
    const token = generateAccessToken({
      userId: buyers[0].id,
      email: buyers[0].email,
      role: 'CUSTOMER',
      sessionVersion: buyers[0].sessionVersion,
      emailVerified: true,
    });
    const send = () => {
      const body = JSON.stringify(input);
      const client = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/v1/orders',
        method: 'POST',
        agent: false,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      });
      clients.push(client);
      clientClosed.push(new Promise<void>((resolve) => client.once('close', resolve)));
      client.on('error', () => undefined);
      return { client, body };
    };
    for (const kind of ['acquire', 'service']) {
      phase = {
        kind,
        reached: gate(),
        resume: gate(),
        terminal: gate(),
        removed: gate<Promise<number>>(),
      };
      const current = phase;
      releases.push(() => current.resume.resolve());
      const start = tokens.length;
      const { client, body } = send();
      client.on('response', (res) => res.resume());
      client.end(body);
      await bounded(current.reached.promise);
      expect(tokens).toHaveLength(start + 1);
      const lease = tokens[start];
      expect(await redis.zScore(waiting.ACTIVE_REQUESTS_KEY, lease)).not.toBeNull();
      client.destroy();
      await bounded(clientClosed[clientClosed.length - 1]);
      await bounded(current.terminal.promise); // Server-side terminal ACK, not only local socket close.
      current.resume.resolve();
      await bounded(current.removed.promise); // Flattened promise waits for actual Redis ZREM ACK.
      await join();
      const ownRemovals = removals.filter((row) => row.token === lease);
      expect(ownRemovals).toHaveLength(1);
      expect(await ownRemovals[0].ack).toBe(1);
      expect(await redis.zRangeWithScores(waiting.ACTIVE_REQUESTS_KEY, 0, -1)).toEqual(
        baselineLeases
      );
      const orders = await prisma.order.findMany({
        where: { eventId: ids.event, userId: ids.buyer },
      });
      expect(orders).toHaveLength(kind === 'acquire' ? 0 : 1);
      for (const order of orders)
        expect(order).toMatchObject({ status: 'PENDING', paymentIntentId: null });
      const stock = await prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } });
      expect([stock.quantityAvailable, stock.quantityHeld, stock.quantitySold]).toEqual(
        kind === 'acquire' ? [2, 1, 0] : [1, 2, 0]
      );
      expect(await foreignSnapshot()).toEqual(foreignBefore);
      const tickets = await prisma.ticket.findMany({
        where: { eventId: ids.event, order: { userId: ids.buyer } },
      });
      expect(tickets).toHaveLength(kind === 'acquire' ? 0 : 1);
      for (const ticket of tickets) expect(ticket.inventoryState).toBe('HELD');
      console.info('task426 abort settled', {
        kind,
        lease,
        removals: ownRemovals.length,
        removalAck: await ownRemovals[0].ack,
        baselineLeases,
        leases: await redis.zRangeWithScores(waiting.ACTIVE_REQUESTS_KEY, 0, -1),
        orders: orders.map((row) => ({
          id: row.id,
          status: row.status,
          paymentIntentId: row.paymentIntentId,
        })),
        inventory: [stock.quantityAvailable, stock.quantityHeld, stock.quantitySold],
        foreignUnchanged: true,
        elapsedMs: performance.now() - started,
      });
      phase = undefined;
    }
    const healthy = send();
    const response = new Promise<{ status: number; data: any }>((resolve, reject) => {
      healthy.client.once('response', (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.once('end', () => {
          try {
            resolve({ status: res.statusCode!, data: JSON.parse(body).data });
          } catch (error) {
            reject(error);
          }
        });
      });
      healthy.client.once('error', reject);
    });
    healthy.client.end(healthy.body);
    const result = await bounded(response);
    expect(result.status).toBe(201);
    expect(result.data.paymentIntentId).toBeNull();
    await bounded(clientClosed[clientClosed.length - 1]);
    await join();
    expect(tokens).toHaveLength(3);
    expect(removals).toHaveLength(3);
    for (const lease of tokens) {
      const rows = removals.filter((row) => row.token === lease);
      expect(rows).toHaveLength(1);
      expect(await rows[0].ack).toBe(1);
    }
    expect(await redis.zRangeWithScores(waiting.ACTIVE_REQUESTS_KEY, 0, -1)).toEqual(
      baselineLeases
    );
    const ownedOrders = await prisma.order.findMany({
      where: { eventId: ids.event, userId: ids.buyer },
    });
    expect(ownedOrders).toHaveLength(2);
    for (const order of ownedOrders) await orderService.cancelOrder(order.id, ids.buyer);
    const stock = await prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } });
    expect([stock.quantityAvailable, stock.quantityHeld, stock.quantitySold]).toEqual([2, 1, 0]);
    expect(await foreignSnapshot()).toEqual(foreignBefore);
    expect(await prisma.paymentAttempt.count({ where: { order: { eventId: ids.event } } })).toBe(0);
    expect(await prisma.paymentRefund.count({ where: { order: { eventId: ids.event } } })).toBe(0);
    expect(failures).toEqual([]);
    console.info('task426 acceptance settled', {
      requested: 3,
      aborted: 2,
      settled: 2,
      healthyStatus: result.status,
      leases: await redis.zRangeWithScores(waiting.ACTIVE_REQUESTS_KEY, 0, -1),
      inventory: [stock.quantityAvailable, stock.quantityHeld, stock.quantitySold],
      foreignUnchanged: true,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    primary = error;
  } finally {
    // Release all gates, close sockets, and JOIN mutable continuations before deleting any fixture.
    for (const release of releases) release();
    for (const client of clients) client.destroy();
    for (const socket of sockets) socket.destroy();
    try {
      if (server?.listening)
        await bounded(
          new Promise<void>((resolve, reject) =>
            server!.close((error) => (error ? reject(error) : resolve()))
          )
        );
      await bounded(Promise.all(clientClosed));
      await join();
      joined = true;
    } catch (error) {
      primary ??= error;
    }
    if (joined) {
      for (const spy of spies.reverse()) spy.mockRestore();
      try {
        // Every predicate is restricted to IDs allocated before the first fixture INSERT.
        await prisma.ticket.deleteMany({ where: { eventId: ids.event } });
        await prisma.order.deleteMany({ where: { eventId: ids.event } });
        await prisma.ticketType.deleteMany({ where: { id: ids.type } });
        await prisma.event.deleteMany({ where: { id: ids.event } });
        await prisma.user.deleteMany({ where: { id: { in: [ids.buyer, ids.foreign] } } });
        await prisma.organization.deleteMany({ where: { id: ids.org } });
        if (redis) {
          // Remove only rate-limit keys for these synthetic users; never flush the shared DB.
          await redis.del([`rl:api:write:user:${ids.buyer}`, `rl:api:read:user:${ids.buyer}`]);
          for (const lease of tokens) await redis.zRem('tixmo:active-request-leases:v1', lease);
        }
      } catch (error) {
        primary ??= error;
      }
      try {
        await disconnectRedis();
      } catch (error) {
        primary ??= error;
      }
      try {
        await prisma.$disconnect();
      } catch (error) {
        primary ??= error;
      }
      Object.assign(config, saved);
    } else {
      // Deadline is failure, not cancellation. Preserve services/fixtures for managed job teardown.
      console.error('Unjoined HTTP abort work: preserve owned fixture IDs', ids);
    }
  }
  if (primary) throw primary;
}, 60000);
