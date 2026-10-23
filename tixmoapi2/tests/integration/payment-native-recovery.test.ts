// Real60s scheduler + real SQL; synthetic transport outage only, never a provider send.
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

let mockHealthy = false;
let mockIntent = '';
let mockRefund = '';
let mockOrder = '';
let mockUnexpected = 0;
const mockRetrieveTimes: Array<{ wall: number; monotonic: number }> = [];
const mockEffects: Array<{ key: string; response: Record<string, unknown> }> = [];
const mockForbidden = () => {
  mockUnexpected++;
  throw Error('Native recovery fixture refuses unexpected transport');
};
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy({}, { get: () => mockForbidden }),
}));
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: {
      retrieve: (id: string) => {
        if (id !== mockIntent) return mockForbidden();
        mockRetrieveTimes.push({ wall: Date.now(), monotonic: performance.now() });
        if (!mockHealthy) return Promise.reject(Error('Synthetic transport unavailable'));
        return Promise.resolve({ id, status: 'succeeded', amount_received: 1000, currency: 'usd' });
      },
      search: mockForbidden,
      create: mockForbidden,
      cancel: mockForbidden,
    },
    refunds: {
      list: (args: { payment_intent: string }) => {
        if (args.payment_intent !== mockIntent) return mockForbidden();
        return Promise.resolve({ data: mockEffects.map((effect) => effect.response) });
      },
      retrieve: mockForbidden,
      create: (
        args: {
          payment_intent: string;
          amount: number;
          metadata: { refundId: string; orderId: string };
        },
        options: { idempotencyKey: string }
      ) => {
        if (
          !mockHealthy ||
          args.payment_intent !== mockIntent ||
          args.amount !== 1000 ||
          args.metadata.refundId !== mockRefund ||
          args.metadata.orderId !== mockOrder ||
          options.idempotencyKey !== `refund-${mockRefund}` ||
          mockEffects.length
        )
          return mockForbidden();
        const response = {
          id: `re_${mockRefund}`,
          status: 'succeeded',
          amount: 1000,
          currency: 'usd',
          payment_intent: mockIntent,
          metadata: args.metadata,
        };
        mockEffects.push({ key: options.idempotencyKey, response });
        return Promise.resolve(response);
      },
    },
    events: { retrieve: mockForbidden },
  }))
);

it('native scheduled retry drains an owned refund within five minutes after synthetic transport restoration', async () => {
  require('../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
  const ids = {
    org: randomUUID(),
    user: randomUUID(),
    event: randomUUID(),
    type: randomUUID(),
    foreignEvent: randomUUID(),
    foreignType: randomUUID(),
    orders: Array.from({ length: 3 }, () => randomUUID()),
    refunds: Array.from({ length: 3 }, () => randomUUID()),
    tickets: Array.from({ length: 3 }, () => randomUUID()),
  };
  const events = [ids.event, ids.foreignEvent];
  const pending = new Set<Promise<unknown>>();
  const jobErrors: unknown[] = [];
  let unsafe = false,
    primary: unknown,
    bodyWork: Promise<void> | undefined;
  const check = () => {
    if (unsafe) throw Error('Native recovery context is unjoined');
  };
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise)
    );
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            unsafe = true;
            reject(Error('Native recovery deadline'));
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const db = <T>(work: () => Promise<T>) => {
    check();
    return bounded(track(work()));
  };
  const waitUntil = async (condition: () => boolean, ms: number) => {
    const end = performance.now() + ms;
    while (!condition()) {
      check();
      if (performance.now() >= end) throw Error('Native scheduler observation deadline');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const spies: Array<{ mockRestore: () => void }> = [];
  const dotenv = require('dotenv') as typeof import('dotenv');
  spies.push(jest.spyOn(dotenv, 'config').mockReturnValue({ parsed: {} }));
  const { config } = await import('../../src/config/environment');
  spies.push({
    mockRestore: jest.replaceProperty(
      config,
      'stripeSecretKey',
      ['sk', 'test', 'task612_synthetic'].join('_')
    ).restore,
  });
  spies.push({
    mockRestore: jest.replaceProperty(
      config,
      'redisDb',
      Number(new URL(process.env.REDIS_URL!).pathname.slice(1))
    ).restore,
  });
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  const { paymentService } = await import('../../src/api/payments/service');
  const job = await import('../../src/jobs/payment-recovery.job');
  const passes: Array<{ started: number; finished: number }> = [];
  const refundSelectionSizes: number[] = [];
  let receipt: Record<string, unknown> | undefined;
  const receiptPath = path.resolve(__dirname, '../../../runtime/task612-native-recovery.json');
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
        throw Error('Native recovery receipt changed');
      fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
    }
  };
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  const body = async () => {
    expect(fs.existsSync(receiptPath)).toBe(false);
    mockHealthy = false;
    mockUnexpected = 0;
    mockEffects.length = 0;
    mockRetrieveTimes.length = 0;
    mockIntent = `pi_${ids.refunds[0]}`;
    mockRefund = ids.refunds[0];
    mockOrder = ids.orders[0];
    redis = await db(() => redisModule.connectRedis());
    expect(redis.isReady).toBe(true);
    const { ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom');
    const leaseBefore = await db(() => redis!.zCard(ACTIVE_REQUESTS_KEY));
    await db(() =>
      prisma.organization.create({
        data: { id: ids.org, name: ids.org, slug: ids.org, type: 'PROMOTER' },
      })
    );
    await db(() =>
      prisma.user.create({
        data: {
          id: ids.user,
          email: `${ids.user}@example.test`,
          passwordHash: 'synthetic',
          firstName: 'Synthetic',
          lastName: 'NativeRecovery',
        },
      })
    );
    for (const [event, type, total] of [
      [ids.event, ids.type, 2],
      [ids.foreignEvent, ids.foreignType, 1],
    ] as const) {
      await db(() =>
        prisma.event.create({
          data: {
            id: event,
            organizationId: ids.org,
            name: event,
            slug: event,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        })
      );
      await db(() =>
        prisma.ticketType.create({
          data: {
            id: type,
            eventId: event,
            name: 'GA',
            price: 10,
            quantityTotal: total,
            quantityAvailable: 0,
            quantitySold: total,
          },
        })
      );
    }
    const aged = new Date(Date.now() - 120000);
    for (let i = 0; i < 3; i++) {
      const event = i === 2 ? ids.foreignEvent : ids.event,
        type = i === 2 ? ids.foreignType : ids.type;
      await db(() =>
        prisma.order.create({
          data: {
            id: ids.orders[i],
            orderNumber: ids.orders[i],
            userId: ids.user,
            eventId: event,
            totalAmount: 10,
            currency: 'usd',
            status: 'PAID',
            paymentStatus: 'SUCCEEDED',
            paymentIntentId: `pi_${ids.refunds[i]}`,
            refundStatus: i === 2 ? 'NONE' : 'PROCESSING',
            receiptStatus: 'SENT',
            receiptSentAt: new Date(),
          },
        })
      );
      await db(() =>
        prisma.ticket.create({
          data: {
            id: ids.tickets[i],
            orderId: ids.orders[i],
            eventId: event,
            ticketTypeId: type,
            userId: ids.user,
            barcode: ids.tickets[i],
            pricePaid: 10,
            inventoryState: 'SOLD',
            status: 'VALID',
          },
        })
      );
      if (i < 2)
        await db(() =>
          prisma.paymentRefund.create({
            data: {
              id: ids.refunds[i],
              orderId: ids.orders[i],
              paymentIntentId: `pi_${ids.refunds[i]}`,
              amount: 1000,
              currency: 'usd',
              reason: i === 1 ? 'LATE_PAYMENT' : 'ORDER_REFUND',
              createdAt: aged,
              updatedAt: aged,
            },
          })
        );
    }
    const snapshot = async (i: number) => ({
      order: await db(() =>
        prisma.order.findUniqueOrThrow({
          where: { id: ids.orders[i] },
          include: { tickets: true, refunds: true },
        })
      ),
      stock: await db(() =>
        prisma.ticketType.findUniqueOrThrow({ where: { id: i === 2 ? ids.foreignType : ids.type } })
      ),
    });
    const before = await snapshot(0);
    const manualBefore = await db(() =>
      prisma.order.findUniqueOrThrow({
        where: { id: ids.orders[1] },
        include: { tickets: true, refunds: true },
      })
    );
    const foreignBefore = await snapshot(2);
    const userBefore = await db(() => prisma.user.findUniqueOrThrow({ where: { id: ids.user } }));
    const eventBefore = await db(() =>
      prisma.event.findMany({ where: { id: { in: events } }, orderBy: { id: 'asc' } })
    );
    // Preserve actual recovery predicates/order/limits/results/CAS; restrict only ownership.
    for (const [model, ownership] of [
      ['order', { id: { in: ids.orders } }],
      ['paymentRefund', { orderId: { in: ids.orders } }],
      ['paymentAttempt', { orderId: { in: ids.orders } }],
      ['paymentWebhookEvent', { id: { in: [] } }],
    ] as const) {
      const target = prisma[model] as any,
        realFind = target.findMany.bind(target);
      spies.push(
        jest.spyOn(target, 'findMany').mockImplementation(async (args: any) => {
          const rows = await realFind({ ...args, where: { AND: [args?.where || {}, ownership] } });
          if (model === 'paymentRefund') refundSelectionSizes.push(rows.length);
          return rows;
        })
      );
    }
    const actualRecover = paymentService.recoverPayments.bind(paymentService);
    spies.push(
      jest.spyOn(paymentService, 'recoverPayments').mockImplementation(() => {
        check();
        const started = performance.now();
        const promise = actualRecover().then(
          () => {
            passes.push({ started, finished: performance.now() });
          },
          (error) => {
            jobErrors.push(error);
            throw error;
          }
        );
        return track(promise);
      })
    );
    job.startPaymentRecoveryJob();
    await waitUntil(() => passes.length >= 1, 10000);
    expect(mockRetrieveTimes).toHaveLength(1);
    expect(mockEffects).toHaveLength(0);
    const failed = await db(() =>
      prisma.paymentRefund.findUniqueOrThrow({ where: { id: ids.refunds[0] } })
    );
    expect(failed).toMatchObject({
      status: 'REQUESTED',
      stripeRefundId: null,
      amount: 1000,
      currency: 'usd',
      errorMessage:
        'Recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.',
    });
    expect(failed.updatedAt.getTime()).toBeGreaterThan(aged.getTime());
    const failedSnapshot = await snapshot(0);
    expect(failedSnapshot.stock).toEqual(before.stock);
    expect(failedSnapshot.order.tickets).toEqual(before.order.tickets);
    const { refunds: _beforeRefunds, ...beforeOrder } = before.order;
    const { refunds: _failedRefunds, ...failedOrder } = failedSnapshot.order;
    expect(failedOrder).toEqual(beforeOrder);
    // Only the synthetic transport availability changes. No DB timestamps or direct recovery calls below.
    mockHealthy = true;
    const restoredAt = performance.now();
    let observed = passes.length,
      settled: Awaited<ReturnType<typeof snapshot>> | undefined;
    while (performance.now() - restoredAt <= 300000) {
      await waitUntil(
        () => passes.length > observed,
        Math.max(1, 300000 - (performance.now() - restoredAt))
      );
      observed = passes.length;
      const current = await snapshot(0);
      if (current.order.status === 'REFUNDED') {
        settled = current;
        break;
      }
    }
    const recoveryMs = performance.now() - restoredAt;
    expect(settled).toBeDefined();
    expect(recoveryMs).toBeLessThanOrEqual(300000);
    expect(mockEffects).toHaveLength(1);
    expect(mockRetrieveTimes).toHaveLength(2);
    const backoffElapsedMs = mockRetrieveTimes[1].wall - failed.updatedAt.getTime();
    expect(backoffElapsedMs).toBeGreaterThanOrEqual(60000);
    expect(settled!.order).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'SUCCEEDED',
    });
    expect(settled!.order.refunds).toEqual([
      expect.objectContaining({
        id: ids.refunds[0],
        status: 'SUCCEEDED',
        stripeRefundId: `re_${ids.refunds[0]}`,
        amount: 1000,
        currency: 'usd',
      }),
    ]);
    expect(settled!.order.tickets).toEqual([
      expect.objectContaining({
        id: ids.tickets[0],
        inventoryState: 'RELEASED',
        status: 'CANCELLED',
      }),
    ]);
    expect(settled!.stock).toMatchObject({
      quantityTotal: 2,
      quantityAvailable: 1,
      quantityHeld: 0,
      quantitySold: 1,
    });
    const terminalPass = passes.length,
      replayStart = performance.now();
    await waitUntil(() => passes.length > terminalPass, 70000);
    const replayWaitMs = performance.now() - replayStart;
    expect(await snapshot(0)).toEqual(settled);
    expect(mockEffects).toHaveLength(1);
    expect(mockRetrieveTimes).toHaveLength(2);
    const intervals = passes.slice(1).map((pass, i) => pass.started - passes[i].started);
    const minTickIntervalMs = Math.min(...intervals);
    expect(minTickIntervalMs).toBeGreaterThanOrEqual(59900);
    expect(
      await db(() =>
        prisma.order.findUniqueOrThrow({
          where: { id: ids.orders[1] },
          include: { tickets: true, refunds: true },
        })
      )
    ).toEqual(manualBefore);
    expect(await snapshot(2)).toEqual(foreignBefore);
    expect(await db(() => prisma.user.findUniqueOrThrow({ where: { id: ids.user } }))).toEqual(
      userBefore
    );
    expect(
      await db(() =>
        prisma.event.findMany({ where: { id: { in: events } }, orderBy: { id: 'asc' } })
      )
    ).toEqual(eventBefore);
    // Last actual replay pass queried the production eligibility predicate on real SQL.
    const remainingEligible = refundSelectionSizes.at(-1)!;
    expect(remainingEligible).toBe(0);
    expect(mockUnexpected).toBe(0);
    expect(jobErrors).toEqual([]);
    const leaseDelta = (await db(() => redis!.zCard(ACTIVE_REQUESTS_KEY))) - leaseBefore;
    expect(leaseDelta).toBe(0);
    receipt = {
      scope: 'task612-native-scheduled-recovery',
      sourceSha: process.env.TIXMO_RECOVERY_SOURCE_SHA || 'local-synthetic',
      runId: process.env.TIXMO_RECOVERY_RUN_ID || 'local-synthetic',
      passed: false,
      firstPassFailed: true,
      persistedBackoff: true,
      healthyRestored: true,
      firstPassMs: passes[0].finished - passes[0].started,
      recoveryMs,
      backoffElapsedMs,
      schedulerPasses: passes.length,
      replayWaitMs,
      minTickIntervalMs,
      syntheticEffects: mockEffects.length,
      initialSold: before.stock.quantitySold,
      finalAvailable: settled!.stock.quantityAvailable,
      finalHeld: settled!.stock.quantityHeld,
      finalSold: settled!.stock.quantitySold,
      unexpectedTransportAttempts: mockUnexpected,
      remainingEligible,
      leaseDelta,
      manualUnchanged: true,
      foreignUnchanged: true,
      replayUnchanged: true,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
    };
    writeReceipt();
  };
  try {
    bodyWork = body();
    await bounded(bodyWork, 390000);
  } catch (error) {
    primary = error;
  } finally {
    job.stopPaymentRecoveryJob();
    try {
      await bounded(Promise.allSettled(bodyWork ? [bodyWork] : []));
      await bounded(drain());
      check();
      const cleanup = async () => {
        await db(() => prisma.paymentRefund.deleteMany({ where: { id: { in: ids.refunds } } }));
        await db(() => prisma.ticket.deleteMany({ where: { id: { in: ids.tickets } } }));
        await db(() => prisma.order.deleteMany({ where: { id: { in: ids.orders } } }));
        await db(() =>
          prisma.ticketType.deleteMany({ where: { id: { in: [ids.type, ids.foreignType] } } })
        );
        await db(() => prisma.event.deleteMany({ where: { id: { in: events } } }));
        await db(() => prisma.user.deleteMany({ where: { id: ids.user } }));
        await db(() => prisma.organization.deleteMany({ where: { id: ids.org } }));
        expect(
          await db(() => prisma.paymentRefund.count({ where: { id: { in: ids.refunds } } }))
        ).toBe(0);
        expect(await db(() => prisma.ticket.count({ where: { id: { in: ids.tickets } } }))).toBe(0);
        expect(await db(() => prisma.order.count({ where: { id: { in: ids.orders } } }))).toBe(0);
        expect(
          await db(() =>
            prisma.ticketType.count({ where: { id: { in: [ids.type, ids.foreignType] } } })
          )
        ).toBe(0);
        expect(await db(() => prisma.event.count({ where: { id: { in: events } } }))).toBe(0);
        expect(await db(() => prisma.user.count({ where: { id: ids.user } }))).toBe(0);
        expect(await db(() => prisma.organization.count({ where: { id: ids.org } }))).toBe(0);
        if (receipt) receipt.cleanupVerified = true;
      };
      await bounded(track(cleanup()), 30000);
      await bounded(drain());
      check();
      for (const spy of spies.reverse()) spy.mockRestore();
      await bounded(track(redisModule.disconnectRedis()));
      check();
      await bounded(track(prisma.$disconnect()));
      check();
      if (receipt) receipt.lifetimeCleanupVerified = true;
    } catch (error) {
      primary ??= error;
    }
  }
  if (receipt) {
    receipt.passed =
      primary === undefined &&
      !unsafe &&
      jobErrors.length === 0 &&
      mockUnexpected === 0 &&
      receipt.cleanupVerified === true &&
      receipt.lifetimeCleanupVerified === true;
    writeReceipt();
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Native recovery qualification failed', { cause: primary });
  expect(jobErrors).toEqual([]);
  expect(mockUnexpected).toBe(0);
}, 450000);
