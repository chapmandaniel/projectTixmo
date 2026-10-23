// Dedicated hosted-only true30-minute soak; never selected by ordinary Jest.
import { randomUUID, createHash } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { monitorEventLoopDelay } from 'perf_hooks';
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
        throw new Error('Soak test forbids notification transport');
      },
    }
  ),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => {
    const forbidden: unknown = new Proxy(
      () => {
        mockTransportCalls++;
        throw new Error('Soak test forbids payment provider transport');
      },
      { get: () => forbidden }
    );
    return forbidden;
  })
);

const receiptPath = path.resolve(__dirname, '../../../runtime/task610-http-soak.json');
let receipt: Record<string, any> | undefined;
let receiptIdentity: { dev: number; ino: number } | undefined;
const writeReceipt = () => {
  if (!receipt) return;
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  if (!receiptIdentity) {
    fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
    receiptIdentity = fs.lstatSync(receiptPath);
  } else {
    const stat = fs.lstatSync(receiptPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.dev !== receiptIdentity.dev ||
      stat.ino !== receiptIdentity.ino
    )
      throw Error('Soak receipt ownership changed');
    fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
  }
};
it('200 owned HTTP actors sustain30 actual minutes with mounted refresh and retained paid wallets', async () => {
  const {
    guard,
    plan,
    admitSlot,
    refreshDue,
    bucket,
    assertBuckets,
    percentile,
    DURATION,
    ACTORS,
  } = require('../../../scripts/http-soak.cjs');
  guard(process.env);
  const actorCount: number = ACTORS;
  const ids = {
    organization: randomUUID(),
    event: randomUUID(),
    ticketType: randomUUID(),
    vip: randomUUID(),
    paidOrders: Array.from({ length: actorCount }, () => randomUUID()),
    paidTickets: Array.from({ length: actorCount }, () => randomUUID()),
    buyers: Array.from({ length: actorCount }, () => randomUUID()),
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
  const key = `soak-${ids.event}`;
  let unsafe = false;
  const check = () => {
    if (unsafe) throw new Error('Unjoined soak work');
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

            reject(new Error('Soak work did not drain'));
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
  // Scrubbed runner supplies every config value; never read an ambient .env file.
  const dotenv = require('dotenv') as typeof import('dotenv');
  spies.push(jest.spyOn(dotenv, 'config').mockReturnValue({ parsed: {} }));
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let server: Server | undefined;
  const clients: Array<Promise<void>> = [];
  let leaseBaseline = 0;
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  let primary: unknown;
  let bodyWork: Promise<void> | undefined;
  let stopSampling: () => void = () => {};
  let joinSampling: () => Promise<unknown> = async () => {};
  let metricsRecord: Record<string, string | number | boolean> | undefined;

  const body = async () => {
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
    expect(config.redisDb).toBe(9);
    expect(config.jwtExpiresIn).toBe('15m');
    expect(config.jwtRefreshExpiresIn).toBe('45m');
    // Explicit suite-local synthetic maxima; restored after the app is drained.
    for (const name of [
      'rateLimitWriteMax',
      'rateLimitReadMax',
      'waitingRoomMaxConcurrentRequests',
    ] as const) {
      const replaced = jest.replaceProperty(
        config,
        name,
        name === 'rateLimitReadMax' ? 10000 : 4000
      );
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
      jest.spyOn(validation, 'validate').mockImplementation((schema) => {
        const handler = realValidate(schema);
        return (...args: Parameters<typeof handler>) => track(Promise.resolve(handler(...args)));
      })
    );
    const app = (await import('../../src/app')).default;
    const { orderService } = await import('../../src/api/orders/service');
    const ledger = () =>
      database(
        () =>
          prisma.$queryRaw<
            Array<{ name: string; checksum: string; finished: Date | null; rolled: Date | null }>
          >`SELECT migration_name::text AS name,checksum::text AS checksum,finished_at AS finished,rolled_back_at AS rolled FROM public._prisma_migrations ORDER BY migration_name`
      );
    const beforeLedger = await ledger();
    expect(beforeLedger).toHaveLength(33);
    for (const row of beforeLedger) {
      expect(row.finished).not.toBeNull();
      expect(row.rolled).toBeNull();
      const migration = fs.readFileSync(
        path.resolve(__dirname, '../../prisma/migrations', row.name, 'migration.sql')
      );
      expect(row.checksum).toBe(createHash('sha256').update(migration).digest('hex'));
    }

    const { ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom');
    leaseBaseline = await database(() => redis!.zCard(ACTIVE_REQUESTS_KEY));
    const { hashPassword } = await import('../../src/utils/password');
    const password = 'SyntheticSoak!610';
    const passwordHash = await hashPassword(password);
    const buyers = ids.buyers.map((id, i) => ({
      id,
      email: `${key}-${i}@example.test`,
      passwordHash,
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
            quantityTotal: scope === ids ? 600 : 10,
            quantityAvailable: scope === ids ? 400 : 10,
            quantitySold: scope === ids ? actorCount : 0,
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
      prisma.order.createMany({
        data: ids.buyers.map((buyer, i) => ({
          id: ids.paidOrders[i],
          orderNumber: `${key}-paid-${i}`,
          userId: buyer,
          eventId: ids.event,
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          currency: 'cad',
          totalAmount: 10,
          receiptStatus: 'SENT',
          receiptSentAt: new Date(),
        })),
      })
    );
    await database(() =>
      prisma.ticket.createMany({
        data: ids.buyers.map((buyer, i) => ({
          id: ids.paidTickets[i],
          orderId: ids.paidOrders[i],
          userId: buyer,
          eventId: ids.event,
          ticketTypeId: ids.ticketType,
          barcode: `${key}-paid-${i}`,
          status: 'VALID',
          inventoryState: 'SOLD',
          pricePaid: 10,
        })),
      })
    );
    const paidSnapshot = async () => ({
      orders: await database(() =>
        prisma.order.findMany({ where: { id: { in: ids.paidOrders } }, orderBy: { id: 'asc' } })
      ),
      tickets: await database(() =>
        prisma.ticket.findMany({ where: { id: { in: ids.paidTickets } }, orderBy: { id: 'asc' } })
      ),
    });
    const paidBefore = await paidSnapshot();
    const vipBefore = await database(() =>
      prisma.ticketType.findUniqueOrThrow({ where: { id: ids.vip } })
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
    type Kind = 'public' | 'wallet' | 'reservation' | 'recovery' | 'cancel' | 'refresh' | 'expired';
    type Row = {
      actor: number;
      kind: Kind;
      target: number;
      started: number;
      settled: number;
      status: number;
      valid: boolean;
      orderId?: string;
    };
    const rows: Row[] = [];
    const ip = (actor: number) => `198.19.0.${actor + 1}`;
    const decodeExpiry = (token: unknown, ttl?: number): number => {
      if (typeof token !== 'string' || token.length > 8192) throw Error('Token contract failed');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (!Number.isSafeInteger(payload.exp)) throw Error('Token expiry missing');
      if (ttl !== undefined && payload.exp - payload.iat !== ttl)
        throw Error('Synthetic token TTL mismatch');
      return payload.exp * 1000;
    };
    const sessions: Array<{ access: string; refresh: string; original: string; expires: number }> =
      [];
    // Real authentication happens before the measured window; no generated JWTs.
    for (let actor = 0; actor < actorCount; actor++) {
      check();
      const response = await track(
        request(url)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', ip(actor))
          .send({ email: buyers[actor].email, password })
          .timeout({ response: 5000, deadline: 8000 })
          .then((r) => r)
      );
      expect(response.status).toBe(200);
      const tokens = response.body.data;
      const expires = decodeExpiry(tokens?.accessToken, 900);
      expect(decodeExpiry(tokens?.refreshToken, 2700) - Date.now()).toBeGreaterThan(2600000);
      expect(expires - Date.now()).toBeGreaterThan(850000);
      sessions.push({
        access: tokens.accessToken,
        refresh: tokens.refreshToken,
        original: tokens.accessToken,
        expires,
      });
    }
    // Last-login writes are setup; all baseline financial/ticket rows must remain byte-for-byte unchanged.
    const histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
    const cpuBaseline = process.cpuUsage();
    const start = performance.now();
    let activeRequests = 0,
      maxRequests = 0,
      activeActors = 0,
      maxActors = 0,
      lastActorStart = 0,
      firstActorEnd = Infinity;
    let missedSlots = 0,
      executedActions = 0,
      maxHoldMs = 0,
      sampling = true;
    const lags: number[] = [];
    const ownedCreated: Array<{ id: string; actor: number }> = [];
    const samples: Array<{
      connections: number;
      active: number;
      lockWaiters: number;
      rss: number;
      heap: number;
      redisMemory: number;
      redisClients: number;
      queue: number;
      oldest: number;
    }> = [];
    const { numericInfo } = require('../../../scripts/http-ramp-receipt.cjs') as {
      numericInfo: (text: string, name: 'used_memory' | 'connected_clients') => number;
    };
    const wait = async (target: number) => {
      while (performance.now() < target) {
        check();
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000, Math.max(1, target - performance.now())))
        );
      }
      check();
    };
    const sampleWork = track(
      (async () => {
        while (sampling) {
          check();
          const [pg] = await database(
            () =>
              prisma.$queryRaw<
                Array<{ connections: number; active: number; lockWaiters: number }>
              >`SELECT count(*)::int AS connections,count(*) FILTER(WHERE state='active')::int AS active,count(*) FILTER(WHERE wait_event_type='Lock')::int AS "lockWaiters" FROM pg_stat_activity WHERE datname=current_database()`
          );
          // A single SQL snapshot compares committed stock counters with owned ticket state.
          const [stock] = await database(
            () =>
              prisma.$queryRaw<
                Array<{
                  available: number;
                  held: number;
                  sold: number;
                  heldTickets: number;
                  soldTickets: number;
                }>
              >`SELECT quantity_available::int AS available,quantity_held::int AS held,quantity_sold::int AS sold,(SELECT count(*)::int FROM tickets WHERE ticket_type_id=${ids.ticketType} AND inventory_state='HELD') AS "heldTickets",(SELECT count(*)::int FROM tickets WHERE ticket_type_id=${ids.ticketType} AND inventory_state='SOLD') AS "soldTickets" FROM ticket_types WHERE id=${ids.ticketType}`
          );
          expect(stock.available + stock.held + stock.sold).toBe(600);
          expect(stock.sold).toBe(200);
          expect(stock.held).toBe(stock.heldTickets);
          expect(stock.held).toBeLessThanOrEqual(200);
          expect(stock.available).toBeGreaterThanOrEqual(200);
          expect(stock.soldTickets).toBe(200);
          const memory = await database(() => redis!.info('memory'));
          const clients = await database(() => redis!.info('clients'));
          // Own unpaid workload only: these are queue observations, not running recovery jobs.
          const queued = await database(() =>
            prisma.order.findMany({
              where: { eventId: ids.event, status: 'PENDING' },
              select: { createdAt: true },
            })
          );
          const m = process.memoryUsage();
          samples.push({
            ...pg,
            rss: m.rss,
            heap: m.heapUsed,
            redisMemory: numericInfo(memory, 'used_memory'),
            redisClients: numericInfo(clients, 'connected_clients'),
            queue: queued.length,
            oldest: Math.max(0, ...queued.map((row) => Date.now() - row.createdAt.getTime())),
          });
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      })()
    );
    stopSampling = () => {
      sampling = false;
    };
    joinSampling = () => sampleWork;
    const invoke = async (actor: number, kind: Kind, target: number, orderId?: string) => {
      check();
      const begun = performance.now() - start;
      activeRequests++;
      maxRequests = Math.max(maxRequests, activeRequests);
      let status = 0,
        valid = false,
        created: string | undefined;
      try {
        const route =
          kind === 'public'
            ? `/api/v1/events/public/${key}-${ids.event}`
            : kind === 'wallet' || kind === 'expired'
              ? '/api/v1/tickets/mine?limit=100'
              : kind === 'reservation'
                ? '/api/v1/orders'
                : kind === 'refresh'
                  ? '/api/v1/auth/refresh'
                  : `/api/v1/orders/${orderId}/${kind === 'cancel' ? 'cancel' : 'recovery'}`;
        const client = ['reservation', 'cancel', 'refresh'].includes(kind)
          ? request(url).post(route)
          : request(url).get(route);
        client.set('X-Forwarded-For', ip(actor));
        if (kind !== 'refresh')
          client.set(
            'Authorization',
            `Bearer ${kind === 'expired' ? sessions[actor].original : sessions[actor].access}`
          );
        if (kind === 'reservation')
          client.send({ items: [{ ticketTypeId: ids.ticketType, quantity: 1 }] });
        if (kind === 'refresh') client.send({ refreshToken: sessions[actor].refresh });
        const response = await client.timeout({ response: 5000, deadline: 8000 });
        status = response.status;
        if (kind === 'refresh' && status === 200) {
          const tokens = response.body.data;
          const expires = decodeExpiry(tokens?.accessToken, 900);
          valid = expires > Date.now() + 850000 && typeof tokens.refreshToken === 'string';
          if (valid)
            sessions[actor] = {
              ...sessions[actor],
              access: tokens.accessToken,
              refresh: tokens.refreshToken,
              expires,
            };
        } else if (kind === 'reservation') {
          const id = response.body.data?.id;
          valid = status === 201 && typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
          if (valid) {
            created = id;
            ownedCreated.push({ id, actor });
          }
        } else if (kind === 'wallet') {
          const data = response.body.data?.tickets;
          valid =
            status === 200 &&
            Array.isArray(data) &&
            data.some(
              (t: any) =>
                t.id === ids.paidTickets[actor] &&
                t.orderId === ids.paidOrders[actor] &&
                t.status === 'VALID'
            ) &&
            data.every((t: any) => t.userId === ids.buyers[actor]);
        } else if (kind === 'expired') valid = status === 401;
        else
          valid =
            status === 200 &&
            response.body.data?.id === (kind === 'public' ? ids.event : orderId) &&
            (kind !== 'cancel' || response.body.data?.status === 'CANCELLED');
      } catch {
        /* Never retry ambiguous HTTP operations. */
      } finally {
        activeRequests--;
        rows.push({
          actor,
          kind,
          target,
          started: begun,
          settled: performance.now() - start,
          status,
          valid,
          orderId: created,
        });
      }
      return created;
    };
    try {
      for (let actor = 0; actor < actorCount; actor++) {
        const work = (async () => {
          const actions = plan(actor) as Array<{
            kind: 'browse' | 'checkout';
            target: number;
            cadence: number;
          }>;
          let probeDone = false,
            begun = false;
          try {
            for (const action of actions) {
              await wait(start + action.target);
              if (!begun) {
                begun = true;
                activeActors++;
                maxActors = Math.max(maxActors, activeActors);
                lastActorStart = Math.max(lastActorStart, performance.now() - start);
              }
              // Refresh from the ACTUAL issued exp, including time consumed during login setup.
              if (refreshDue(sessions[actor].expires, Date.now())) {
                await invoke(actor, 'refresh', performance.now() - start);
                expect(sessions[actor].expires - Date.now()).toBeGreaterThan(800000);
              }
              if (!probeDone && Date.now() > decodeExpiry(sessions[actor].original) + 1000) {
                await invoke(actor, 'expired', performance.now() - start);
                probeDone = true;
              }
              const late = performance.now() - start - action.target;
              lags.push(Math.max(0, late));
              // Skip missed slots; never catch up in a burst after a stall.
              if (!admitSlot(action, performance.now() - start)) {
                missedSlots++;
                continue;
              }
              executedActions++;
              if (action.kind === 'browse') {
                await invoke(actor, 'public', action.target);
                await invoke(actor, 'wallet', action.target);
              } else {
                const heldAt = performance.now();
                const id = await invoke(actor, 'reservation', action.target);
                if (id) {
                  await invoke(actor, 'recovery', performance.now() - start, id);
                  await invoke(actor, 'cancel', performance.now() - start, id);
                  maxHoldMs = Math.max(maxHoldMs, performance.now() - heldAt);
                }
              }
            }
            await wait(start + DURATION); // All actor lifetimes span the actual steady window.
          } finally {
            if (begun) {
              activeActors--;
              firstActorEnd = Math.min(firstActorEnd, performance.now() - start);
            }
          }
        })();
        clients.push(track(work, false));
      }
      await Promise.all(clients);
    } finally {
      sampling = false;
      try {
        await bounded(sampleWork);
      } finally {
        histogram.disable();
      }
    }
    await bounded(drain());
    const elapsed = performance.now() - start,
      cpu = process.cpuUsage(cpuBaseline);
    const orders = await database(() => prisma.order.findMany({ where: { eventId: ids.event } }));
    const tickets = await database(() => prisma.ticket.findMany({ where: { eventId: ids.event } }));
    const ga = await database(() =>
      prisma.ticketType.findUniqueOrThrow({ where: { id: ids.ticketType } })
    );
    const ownOrders = { in: orders.map((row) => row.id) };
    const attempts = await database(() =>
      prisma.paymentAttempt.count({ where: { orderId: ownOrders } })
    );
    const refunds = await database(() =>
      prisma.paymentRefund.count({ where: { orderId: ownOrders } })
    );
    const receiptQueued = await database(() =>
      prisma.order.count({
        where: { eventId: ids.event, status: 'PAID', receiptStatus: { not: 'SENT' } },
      })
    );
    const buckets = Array.from({ length: 6 }, (_, i) => bucket(rows, i));
    const cancelled = orders.filter((row) => row.status === 'CANCELLED');
    const metrics = {
      elapsedMs: elapsed,
      fullActorOverlapMs: firstActorEnd - lastActorStart,
      maxActiveActors: maxActors,
      remainingActors: activeActors,
      maxHttpInFlight: maxRequests,
      remainingHttpInFlight: activeRequests,
      scheduledActions: 42000,
      executedActions,
      missedSlots,
      latenessP95Ms: percentile(lags),
      latenessMaxMs: Math.max(0, ...lags),
      plannedOfferedRps: 90000 / 1800,
      actualOfferedRps: rows.filter((row) => row.started < DURATION).length / 1800,
      completionRps: rows.length / (elapsed / 1000),
      orders: orders.length,
      tickets: tickets.length,
      paidBaselines: ids.paidOrders.length,
      cancelledOrders: cancelled.length,
      paymentAttempts: attempts,
      refunds,
      receiptQueued,
      queueOldestAgeMs: Math.max(0, ...samples.map((row) => row.oldest)),
      leaseDelta: (await database(() => redis!.zCard(ACTIVE_REQUESTS_KEY))) - leaseBaseline,
      refreshes: rows.filter((row) => row.kind === 'refresh' && row.valid).length,
      expired401: rows.filter((row) => row.kind === 'expired' && row.valid).length,
      maxHoldMs,
      allRequests: rows.length,
      drainRequests: rows.filter((row) => row.started >= DURATION).length,
      unexpectedRequests: rows.filter((row) => !row.valid).length,
      maxPendingQueued: Math.max(0, ...samples.map((row) => row.queue)),
      sampleCount: samples.length,
      maxPgConnections: Math.max(0, ...samples.map((row) => row.connections)),
      maxPgActive: Math.max(0, ...samples.map((row) => row.active)),
      maxPgLockWaiters: Math.max(0, ...samples.map((row) => row.lockWaiters)),
      maxRedisMemoryBytes: Math.max(0, ...samples.map((row) => row.redisMemory)),
      maxRedisClients: Math.max(0, ...samples.map((row) => row.redisClients)),
      maxRssBytes: Math.max(0, ...samples.map((row) => row.rss)),
      maxHeapBytes: Math.max(0, ...samples.map((row) => row.heap)),
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
      eventLoopP95Ms: histogram.percentile(95) / 1e6,
      eventLoopMaxMs: histogram.max / 1e6,
      gaAvailable: ga.quantityAvailable,
      gaHeld: ga.quantityHeld,
      gaSold: ga.quantitySold,
    };
    metricsRecord = {
      testAssertionsPassed: false,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
    };
    const fixed = {
      scope: 'task610-http-soak',
      sourceSha: process.env.TIXMO_SOAK_SOURCE_SHA,
      runId: process.env.TIXMO_SOAK_RUN_ID,
      actorModel: 'authenticated-http-actors-not-browsers',
      resourceScope: 'combined-api-and-driver-process-owned-ci-services',
      durationMs: DURATION,
      actors: ACTORS,
      accessJwtSeconds: 900,
      refreshJwtSeconds: 2700,
      syntheticReadMax: 10000,
      syntheticWriteMax: 4000,
      syntheticAdmissionMax: 4000,
      limitsQualified: false,
    };
    receipt = {
      ...fixed,
      passed: false,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
      metrics,
      buckets,
    };
    writeReceipt();
    assertBuckets(buckets);
    expect(rows.every((row) => row.valid)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(DURATION);
    expect(elapsed).toBeLessThan(DURATION + 30000);
    expect(metrics.fullActorOverlapMs).toBeGreaterThanOrEqual(DURATION - 15000);
    expect(metrics.executedActions).toBe(42000);
    expect(missedSlots).toBe(0);
    expect(activeRequests + activeActors).toBe(0);
    expect(metrics.refreshes).toBeGreaterThanOrEqual(400);
    expect(metrics.expired401).toBe(200);
    expect(maxHoldMs).toBeLessThanOrEqual(10000);
    expect(cancelled).toHaveLength(6000);
    expect(orders).toHaveLength(6200);
    expect(tickets).toHaveLength(6200);
    expect(new Set(ownedCreated.map((row) => row.id)).size).toBe(6000);
    expect(new Set(tickets.map((row) => row.barcode)).size).toBe(6200);
    expect(new Set(tickets.map((row) => row.id)).size).toBe(6200);
    expect(ga).toMatchObject({
      quantityTotal: 600,
      quantityAvailable: 400,
      quantityHeld: 0,
      quantitySold: 200,
    });
    for (const order of cancelled) {
      const owner = ownedCreated.find((row) => row.id === order.id);
      expect(owner).toBeDefined();
      expect(order.userId).toBe(ids.buyers[owner!.actor]);
      expect(order).toMatchObject({
        paymentIntentId: null,
        paymentStatus: 'PENDING',
        currency: 'cad',
      });
      expect(tickets.filter((t) => t.orderId === order.id)).toHaveLength(1);
      expect(tickets.find((t) => t.orderId === order.id)).toMatchObject({
        userId: order.userId,
        inventoryState: 'RELEASED',
        status: 'CANCELLED',
      });
    }
    expect(await ledger()).toEqual(beforeLedger);
    expect(await paidSnapshot()).toEqual(paidBefore);
    expect(
      await database(() => prisma.ticketType.findUniqueOrThrow({ where: { id: ids.vip } }))
    ).toEqual(vipBefore);
    expect(await foreignSnapshot()).toEqual(foreignBefore);
    expect(attempts + refunds + receiptQueued).toBe(0);
    expect(metrics.leaseDelta).toBe(0);
    expect(samples.length).toBeGreaterThanOrEqual(300);
    expect(mockTransportCalls).toBe(0);
    expect(backgroundErrors).toEqual([]);
    metricsRecord.testAssertionsPassed = true;
  };
  try {
    bodyWork = body();
    await bounded(bodyWork, 1950000);
  } catch (error) {
    primary = error;
  } finally {
    // A deadline is failure, never evidence of cancellation. Keep tracking and
    // context intact if HTTP/server/middleware/Redis work cannot be joined.
    let joined = false;
    stopSampling();
    try {
      await bounded(
        Promise.allSettled([...(bodyWork ? [bodyWork] : []), ...clients, joinSampling()])
      );
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
        'Unjoined soak work: preserve fixtures/connections for managed job teardown',
        'Managed job teardown owns retained context'
      );
    }
  }
  if (receipt && metricsRecord) {
    receipt.cleanupVerified = metricsRecord.cleanupVerified === true;
    receipt.lifetimeCleanupVerified = metricsRecord.lifetimeCleanupVerified === true;
    receipt.passed =
      metricsRecord.testAssertionsPassed === true &&
      primary === undefined &&
      backgroundErrors.length === 0 &&
      mockTransportCalls === 0 &&
      receipt.cleanupVerified &&
      receipt.lifetimeCleanupVerified;
    writeReceipt();
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Soak qualification failed', { cause: primary });
  expect(backgroundErrors).toEqual([]);
  expect(mockTransportCalls).toBe(0);
}, 2040000);
