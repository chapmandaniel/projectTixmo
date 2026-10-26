// Managed-CI HTTP actors:20 seconds/stage,10 public browsing cycles at2s cadence,
// one checkout spread across4..16s then one own-order recovery read. Not browser contexts.
import { randomUUID } from 'crypto';
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
        throw new Error('Ramp test forbids notification transport');
      },
    }
  ),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => {
    const forbidden: unknown = new Proxy(
      () => {
        mockTransportCalls++;
        throw new Error('Ramp test forbids payment provider transport');
      },
      { get: () => forbidden }
    );
    return forbidden;
  })
);

let unsafePriorStage = false;
let previousStageFailed = false;
const stageRecords: Array<Record<string, number | boolean>> = [];
let receiptIdentity: { dev: number; ino: number } | undefined;
const receiptPath = path.resolve(__dirname, '../../../runtime/task609-http-ramp.json');
const writeReceipt = () => {
  const value = {
    scope: 'task609-authenticated-http-actor-ramp',
    sourceSha: process.env.TIXMO_RAMP_SOURCE_SHA || 'local-synthetic',
    runId: process.env.TIXMO_RAMP_RUN_ID || 'local-synthetic',
    actorModel: 'authenticated-http-actors-not-browsers',
    resourceScope: 'combined-api-and-driver-process-owned-ci-services',
    stageDurationMs: 20000,
    browseCycles: 10,
    cadenceMs: 2000,
    checkoutStartMs: 4000,
    checkoutEndMs: 16000,
    syntheticReadMax: 10000,
    syntheticWriteMax: 4000,
    syntheticAdmissionMax: 4000,
    limitsQualified: false,
    stages: stageRecords,
  };
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  if (!receiptIdentity) {
    fs.writeFileSync(receiptPath, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
    receiptIdentity = fs.lstatSync(receiptPath);
  } else {
    const stat = fs.lstatSync(receiptPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.dev !== receiptIdentity.dev ||
      stat.ino !== receiptIdentity.ino
    )
      throw Error('Ramp receipt ownership changed');
    fs.writeFileSync(receiptPath, JSON.stringify(value) + '\n', { mode: 0o600 });
  }
};
it.each([100, 250, 500])(
  '%i authenticated HTTP actor lifetimes sustain public browsing and staggered reservation',
  async (actorCount) => {
    if (unsafePriorStage || previousStageFailed)
      throw Error('Earlier ramp stage failed; later load not started');
    jest.resetModules(); // Every stage must capture its OWN real middleware/Redis lifetimes.
    mockTransportCalls = 0;
    if (actorCount === 100) expect(fs.existsSync(receiptPath)).toBe(false);
    writeReceipt();
    const ids = {
      organization: randomUUID(),
      event: randomUUID(),
      ticketType: randomUUID(),
      vip: randomUUID(),
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
    const key = `ramp-${ids.event}`;
    let unsafe = false;
    const check = () => {
      if (unsafe) throw new Error('Unjoined ramp work');
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
              unsafePriorStage = true;
              reject(new Error('Ramp work did not drain'));
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
              quantityTotal: scope === ids ? actorCount + 50 : 10,
              quantityAvailable: scope === ids ? actorCount + 50 : 10,
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
      type Kind = 'public' | 'reservation' | 'recovery';
      type Measurement = {
        actor: number;
        kind: Kind;
        target: number;
        started: number;
        settled: number;
        status: number;
        orderId?: string;
        valid: boolean;
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
      const { percentile } = require('../../../scripts/http-pressure-receipt.cjs') as {
        percentile: (values: number[], fraction: number) => number;
      };
      const histogram = monitorEventLoopDelay({ resolution: 20 });
      histogram.enable();
      const cpuBaseline = process.cpuUsage();
      const start = performance.now();
      let activeRequests = 0,
        maxRequests = 0,
        activeActors = 0,
        maxActors = 0,
        lastActorStart = 0,
        firstActorEnd = Number.POSITIVE_INFINITY;
      let sampling = true;
      const samples: Array<{
        connections: number;
        active: number;
        lockWaiters: number;
        rss: number;
        heap: number;
        redisMemory: number;
        redisClients: number;
      }> = [];
      const { numericInfo: fixedInfo, stagePlan } =
        require('../../../scripts/http-ramp-receipt.cjs') as {
          numericInfo: (text: string, name: 'used_memory' | 'connected_clients') => number;
          stagePlan: (
            actors: number,
            actor: number
          ) => Array<{ kind: 'public' | 'reservation'; target: number }>;
        };
      const sampleWork = track(
        (async () => {
          while (sampling) {
            check();
            const [row] = await database(
              () =>
                prisma.$queryRaw<
                  Array<{ connections: number; active: number; lockWaiters: number }>
                >`SELECT count(*)::int AS connections,count(*) FILTER(WHERE state='active')::int AS active,count(*) FILTER(WHERE wait_event_type='Lock')::int AS "lockWaiters" FROM pg_stat_activity WHERE datname=current_database()`
            );
            const memory = await database(() => redis!.info('memory'));
            const clients = await database(() => redis!.info('clients'));
            const processMemory = process.memoryUsage();
            samples.push({
              ...row,
              rss: processMemory.rss,
              heap: processMemory.heapUsed,
              redisMemory: fixedInfo(memory, 'used_memory'),
              redisClients: fixedInfo(clients, 'connected_clients'),
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        })()
      );
      stopSampling = () => {
        sampling = false;
      };
      joinSampling = () => sampleWork;
      const invoke = async (actor: number, kind: Kind, target: number, orderId?: string) => {
        check();
        const started = performance.now() - start;
        activeRequests++;
        maxRequests = Math.max(maxRequests, activeRequests);
        let status = 0,
          valid = false,
          created: string | undefined;
        try {
          const route =
            kind === 'public'
              ? '/api/v1/events/public/' + `${key}-${ids.event}`
              : kind === 'reservation'
                ? '/api/v1/orders'
                : '/api/v1/orders/' + orderId + '/recovery';
          const client =
            kind === 'reservation' ? request(url).post(route) : request(url).get(route);
          client
            .set('Authorization', `Bearer ${tokens[actor]}`)
            .set('X-Forwarded-For', '127.0.0.1');
          if (kind === 'reservation')
            client.send({ items: [{ ticketTypeId: ids.ticketType, quantity: 1 }] });
          const response = await client.timeout({ response: 5000, deadline: 8000 });
          status = response.status;
          if (kind === 'reservation') {
            const candidate = response.body.data?.id as unknown;
            valid =
              status === 201 && typeof candidate === 'string' && /^[a-f0-9-]{36}$/.test(candidate);
            if (valid) created = candidate as string;
          } else
            valid =
              status === 200 &&
              response.body.data?.id === (kind === 'public' ? ids.event : orderId);
        } catch {
          /* Count network/deadline failure explicitly; no retry. */
        } finally {
          activeRequests--;
          measurements.push({
            actor,
            kind,
            target,
            started,
            settled: performance.now() - start,
            status,
            orderId: created,
            valid,
          });
        }
        return created;
      };
      try {
        const actors = buyers.map(async (_, actor) => {
          const actions = stagePlan(actorCount, actor);
          let begun = false;
          try {
            for (const action of actions) {
              check();
              const target = start + action.target;
              while (performance.now() < target)
                await new Promise((resolve) =>
                  setTimeout(resolve, Math.max(1, target - performance.now()))
                );
              check();
              if (!begun) {
                begun = true;
                activeActors++;
                maxActors = Math.max(maxActors, activeActors);
                lastActorStart = Math.max(lastActorStart, performance.now() - start);
              }
              const orderId = await invoke(actor, action.kind, action.target);
              if (action.kind === 'reservation' && orderId)
                await invoke(actor, 'recovery', performance.now() - start, orderId);
            }
          } finally {
            if (begun) {
              activeActors--;
              firstActorEnd = Math.min(firstActorEnd, performance.now() - start);
            }
          }
        });
        clients.push(...actors.map((actor) => track(actor, false)));
        await Promise.all(clients);
        const remaining = start + 20000 - performance.now();
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      } finally {
        sampling = false;
        try {
          await bounded(sampleWork);
        } finally {
          histogram.disable();
        }
      }
      await bounded(drain());
      const elapsed = performance.now() - start;
      const cpu = process.cpuUsage(cpuBaseline);
      const publicRows = measurements.filter((row) => row.kind === 'public');
      const reservations = measurements.filter((row) => row.kind === 'reservation');
      const successes = reservations.filter((row) => row.status === 201);
      const recoveryRows = measurements.filter((row) => row.kind === 'recovery');
      const lag = measurements
        .filter((row) => row.kind !== 'recovery')
        .map((row) => Math.max(0, row.started - row.target));
      const orders = await database(() => prisma.order.findMany({ where: { eventId: ids.event } }));
      const tickets = await database(() =>
        prisma.ticket.findMany({ where: { eventId: ids.event } })
      );
      const ga = await database(() =>
        prisma.ticketType.findUniqueOrThrow({ where: { id: ids.ticketType } })
      );
      const vip = await database(() =>
        prisma.ticketType.findUniqueOrThrow({ where: { id: ids.vip } })
      );
      const attempts = await database(() =>
        prisma.paymentAttempt.count({ where: { orderId: { in: orders.map((row) => row.id) } } })
      );
      const http5xx = measurements.filter((row) => row.status >= 500).length;
      const metrics = {
        actors: actorCount,
        testAssertionsPassed: false,
        cleanupVerified: false,
        lifetimeCleanupVerified: false,
        plannedPublicReads: actorCount * 10,
        plannedReservations: actorCount,
        plannedRequests: actorCount * 12,
        startedRequests: measurements.length,
        completedRequests: measurements.length,
        publicRead200: publicRows.filter((row) => row.status === 200).length,
        reservation201: successes.length,
        recovery200: recoveryRows.filter((row) => row.status === 200).length,
        publicReadP95Ms: percentile(
          publicRows.filter((row) => row.status === 200).map((row) => row.settled - row.started),
          0.95
        ),
        reservationP95Ms: percentile(
          successes.map((row) => row.settled - row.started),
          0.95
        ),
        recoveryReadP95Ms: percentile(
          recoveryRows.filter((row) => row.status === 200).map((row) => row.settled - row.started),
          0.95
        ),
        http429: measurements.filter((row) => row.status === 429).length,
        http503: measurements.filter((row) => row.status === 503).length,
        http5xx,
        unexpected5xxFraction: http5xx / Math.max(1, measurements.length),
        networkErrors: measurements.filter((row) => row.status === 0).length,
        otherStatus: measurements.filter(
          (row) =>
            row.status !== 0 &&
            row.status !== 200 &&
            row.status !== 201 &&
            row.status < 500 &&
            row.status !== 429
        ).length,
        malformedSuccess: measurements.filter(
          (row) => (row.status === 200 || row.status === 201) && !row.valid
        ).length,
        maxActiveActors: maxActors,
        remainingActors: activeActors,
        fullActorOverlapMs: Math.max(0, firstActorEnd - lastActorStart),
        maxHttpInFlight: maxRequests,
        remainingHttpInFlight: activeRequests,
        elapsedMs: elapsed,
        plannedOfferedRps: (actorCount * 12) / 20,
        actualOfferedRps: measurements.filter((row) => row.started <= 20000).length / 20,
        completionRps: measurements.length / (elapsed / 1000),
        startedWithinWindow: measurements.filter((row) => row.started <= 20000).length,
        scheduleLatenessP95Ms: percentile(lag, 0.95),
        scheduleLatenessMaxMs: Math.max(0, ...lag),
        missedCadence: lag.filter((value) => value > 2000).length,
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
        vipAvailable: vip.quantityAvailable,
        vipHeld: vip.quantityHeld,
        vipSold: vip.quantitySold,
        orders: orders.length,
        tickets: tickets.length,
        paymentAttempts: attempts,
        leaseDelta: (await database(() => redis!.zCard(ACTIVE_REQUESTS_KEY))) - leaseBaseline,
      };
      metricsRecord = metrics;
      stageRecords.push(metrics);
      writeReceipt();
      expect(clients).toHaveLength(actorCount);
      expect(maxActors).toBe(actorCount);
      expect(activeActors).toBe(0);
      expect(activeRequests).toBe(0);
      expect(metrics.fullActorOverlapMs).toBeGreaterThanOrEqual(14000);
      expect(publicRows).toHaveLength(actorCount * 10);
      expect(reservations).toHaveLength(actorCount);
      expect(recoveryRows).toHaveLength(actorCount);
      expect(measurements).toHaveLength(actorCount * 12);
      expect(metrics.startedWithinWindow).toBeGreaterThanOrEqual(actorCount * 12 * 0.95);
      expect(metrics.elapsedMs).toBeLessThan(30000);
      expect(metrics.publicReadP95Ms).toBeLessThanOrEqual(500);
      expect(metrics.reservationP95Ms).toBeLessThanOrEqual(2000);
      expect(metrics.unexpected5xxFraction).toBeLessThan(0.005);
      expect(
        metrics.networkErrors +
          metrics.otherStatus +
          metrics.http429 +
          metrics.http503 +
          metrics.malformedSuccess
      ).toBe(0);
      expect(metrics.reservation201).toBe(actorCount);
      expect(metrics.recovery200).toBe(actorCount);
      expect(samples.length).toBeGreaterThanOrEqual(10);
      expect(metrics.leaseDelta).toBe(0);
      expect(backgroundErrors).toEqual([]);
      expect(mockTransportCalls).toBe(0);
      expect(ga).toMatchObject({
        quantityTotal: actorCount + 50,
        quantityAvailable: 50,
        quantityHeld: actorCount,
        quantitySold: 0,
      });
      expect(vip).toMatchObject({
        quantityTotal: 200,
        quantityAvailable: 200,
        quantityHeld: 0,
        quantitySold: 0,
      });
      expect(orders).toHaveLength(actorCount);
      expect(tickets).toHaveLength(actorCount);
      expect(attempts).toBe(0);
      for (const field of ['id', 'orderNumber', 'userId'] as const)
        expect(new Set(orders.map((row) => row[field])).size).toBe(actorCount);
      for (const field of ['id', 'barcode', 'orderId'] as const)
        expect(new Set(tickets.map((row) => row[field])).size).toBe(actorCount);
      expect(new Set(successes.map((row) => row.orderId))).toEqual(
        new Set(orders.map((row) => row.id))
      );
      for (const order of orders) {
        expect(order).toMatchObject({ status: 'PENDING', currency: 'cad', paymentIntentId: null });
        expect(order.paymentStatus).not.toBe('SUCCEEDED');
        expect(ids.buyers[successes.find((row) => row.orderId === order.id)!.actor]).toBe(
          order.userId
        );
        expect(tickets.find((ticket) => ticket.orderId === order.id)).toMatchObject({
          userId: order.userId,
          inventoryState: 'HELD',
          ticketTypeId: ids.ticketType,
        });
      }
      expect(await foreignSnapshot()).toEqual(foreignBefore);
      metricsRecord.testAssertionsPassed = true;
    };
    try {
      bodyWork = body();
      await bounded(bodyWork, 90000);
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
          await database(() =>
            prisma.ticketType.deleteMany({ where: { eventId: { in: events } } })
          );
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
          expect(await database(() => prisma.event.count({ where: { id: { in: events } } }))).toBe(
            0
          );
          expect(
            await database(() =>
              prisma.organization.count({ where: { id: { in: organizations } } })
            )
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
          'Unjoined ramp work: preserve fixtures/connections for managed job teardown',
          'Managed job teardown owns retained context'
        );
      }
    }
    if (metricsRecord) {
      metricsRecord.testAssertionsPassed =
        metricsRecord.testAssertionsPassed === true &&
        primary === undefined &&
        backgroundErrors.length === 0 &&
        mockTransportCalls === 0 &&
        metricsRecord.cleanupVerified === true &&
        metricsRecord.lifetimeCleanupVerified === true;
      writeReceipt();
    }
    if (primary !== undefined || backgroundErrors.length || mockTransportCalls)
      previousStageFailed = true;
    if (primary)
      throw primary instanceof Error
        ? primary
        : new Error('Ramp checkout failed', { cause: primary });
    expect(backgroundErrors).toEqual([]);
    expect(mockTransportCalls).toBe(0);
  },
  210000
);
