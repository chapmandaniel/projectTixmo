// Current-candidate real SQL regression port of historical #291/#308/#311/#364.
// Synthetic disk ledger and owned subprocesses are not real-provider qualification.
import { randomUUID } from 'crypto';
import { fork, ChildProcess } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import prisma from '../../src/config/prisma';

const root = path.resolve(__dirname, '../..');
const worker = path.join(__dirname, 'fixtures/payment-recovery-worker.cjs');
type Reply = {
  type: string;
  pid: number;
  calls: string[][];
  casSnapshot?: Record<string, unknown>;
};
type Spec = {
  mode: string;
  orderIds: string[];
  eventIds: string[];
  poisonEvents: string[];
  poisonIntents: string[];
  unavailableIntents: string[];
  pauseAfterEffect?: boolean;
  casEvent?: string;
  ledger: string;
};
const ownerReason =
  'Recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.';

describe('Recovery queue and old-window durable effects on real SQL', () => {
  let ids: {
    org: string;
    user: string;
    event: string;
    type: string;
    foreignEvent: string;
    foreignType: string;
    foreignOrder: string;
    orders: string[];
    refunds: string[];
    events: string[];
  };
  let directory: string, ledger: string;
  let bodyWork: Promise<void> | undefined,
    unsafe = false;
  const children = new Set<ChildProcess>();
  const qualify = (name: string, body: () => Promise<void>) =>
    it(
      name,
      () => {
        bodyWork = body();
        return bodyWork;
      },
      90000
    );
  async function bounded<T>(promise: Promise<T>, milliseconds = 10000): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Recovery qualification deadline')),
            milliseconds
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function joinBody() {
    try {
      await bounded(Promise.allSettled(bodyWork ? [bodyWork] : []));
    } catch (error) {
      unsafe = true;
      throw error;
    }
  }
  const spec = (extra: Partial<Spec> = {}): Spec => ({
    mode: 'refund',
    orderIds: ids.orders,
    eventIds: ids.events,
    poisonEvents: [],
    poisonIntents: [],
    unavailableIntents: [],
    ledger,
    ...extra,
  });
  const effects = () =>
    (
      JSON.parse(readFileSync(ledger, 'utf8')) as {
        effects: Array<{ key: string; response: Record<string, unknown> }>;
      }
    ).effects;
  async function run(input: Spec, inspectGap?: (reply: Reply) => Promise<void>): Promise<Reply> {
    // The same guard used before standard schema setup also runs before spawn.
    const { validateVerificationTargets } = require('../../../scripts/verification-safety.cjs');
    validateVerificationTargets(process.env);
    const compiled = path.join(root, 'dist/api/payments/service.js');
    if (
      !existsSync(compiled) ||
      statSync(compiled).mtimeMs < statSync(path.join(root, 'src/api/payments/service.ts')).mtimeMs
    )
      throw new Error('Fresh API build required before recovery integration suite');
    const child = fork(worker, [JSON.stringify(input)], {
      env: {
        NODE_ENV: 'test',
        TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        STRIPE_SECRET_KEY: 'sk_test_task566_synthetic',
        JWT_SECRET: 'task566_synthetic_jwt_secret',
        JWT_REFRESH_SECRET: 'task566_synthetic_refresh',
        SESSION_SECRET: 'task566_synthetic_session',
      },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    children.add(child);
    let closed = false;
    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      child.once('close', (code, signal) => {
        closed = true;
        children.delete(child);
        resolve({ code, signal });
      })
    );
    try {
      const reply = await bounded(
        new Promise<Reply>((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', () =>
            reject(new Error('Recovery worker exited before IPC acknowledgment'))
          );
          child.once('message', (value) => resolve(value as Reply));
        }),
        20000
      );
      expect(reply.pid).toBe(child.pid);
      if (inspectGap) {
        expect(reply.type).toBe('effect-before-return');
        await inspectGap(reply);
        child.kill('SIGKILL');
        expect((await bounded(exit)).signal).toBe('SIGKILL');
      } else {
        expect(reply.type).toBe('complete');
        expect(await bounded(exit)).toEqual({ code: 0, signal: null });
      }
      return reply;
    } finally {
      if (!closed) {
        child.kill('SIGKILL');
        await bounded(exit).catch((error) => {
          unsafe = true;
          throw error;
        });
      }
    }
  }
  const foreign = async () => ({
    event: await prisma.event.findUnique({ where: { id: ids.foreignEvent } }),
    stock: await prisma.ticketType.findUnique({ where: { id: ids.foreignType } }),
    order: await prisma.order.findUnique({
      where: { id: ids.foreignOrder },
      include: { tickets: true },
    }),
  });
  const snapshot = async (index: number) => ({
    refund: await prisma.paymentRefund.findUniqueOrThrow({
      where: { id: ids.refunds[index] },
      include: { order: { include: { tickets: true } } },
    }),
    stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } }),
  });
  async function seedRefunds(
    count: number,
    healthy: number,
    extra: Array<{ index: number; manual?: boolean; old?: boolean }> = []
  ) {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const option = extra.find((value) => value.index === i);
      await prisma.order.create({
        data: {
          id: ids.orders[i],
          orderNumber: ids.orders[i],
          userId: ids.user,
          eventId: ids.event,
          totalAmount: 10,
          currency: 'usd',
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          paymentIntentId: 'pi_' + ids.refunds[i],
          refundStatus: 'PROCESSING',
          receiptStatus: 'SENT',
          receiptSentAt: new Date(),
        },
      });
      await prisma.paymentRefund.create({
        data: {
          id: ids.refunds[i],
          orderId: ids.orders[i],
          paymentIntentId: 'pi_' + ids.refunds[i],
          amount: 1000,
          currency: 'usd',
          reason: option?.manual ? 'LATE_PAYMENT' : 'ORDER_REFUND',
          createdAt: new Date(now - (option?.old ? 24 * 3600000 : 120000)),
          updatedAt: new Date(now - 180000 + i),
        },
      });
    }
    await prisma.ticketType.update({
      where: { id: ids.type },
      data: { quantityAvailable: 0, quantitySold: 1 },
    });
    await prisma.ticket.create({
      data: {
        orderId: ids.orders[healthy],
        userId: ids.user,
        eventId: ids.event,
        ticketTypeId: ids.type,
        barcode: randomUUID(),
        pricePaid: 10,
        inventoryState: 'SOLD',
      },
    });
  }
  beforeEach(() => {
    bodyWork = (async () => {
      if (unsafe) throw new Error('Unjoined recovery work prohibits fixture reuse');
      ids = {
        org: randomUUID(),
        user: randomUUID(),
        event: randomUUID(),
        type: randomUUID(),
        foreignEvent: randomUUID(),
        foreignType: randomUUID(),
        foreignOrder: randomUUID(),
        orders: Array.from({ length: 54 }, () => randomUUID()),
        refunds: Array.from({ length: 54 }, () => randomUUID()),
        events: Array.from({ length: 51 }, () => 'evt_' + randomUUID()),
      };
      directory = mkdtempSync(path.join(os.tmpdir(), 'tixmo-566-'));
      ledger = path.join(directory, 'ledger.json');
      writeFileSync(ledger, JSON.stringify({ effects: [] }), { mode: 0o600 });
      await prisma.organization.create({
        data: { id: ids.org, name: ids.org, slug: ids.org, type: 'PROMOTER' },
      });
      await prisma.user.create({
        data: {
          id: ids.user,
          email: ids.user + '@example.test',
          passwordHash: 'synthetic',
          firstName: 'Synthetic',
          lastName: 'Recovery',
        },
      });
      for (const [id, type] of [
        [ids.event, ids.type],
        [ids.foreignEvent, ids.foreignType],
      ]) {
        await prisma.event.create({
          data: {
            id,
            organizationId: ids.org,
            name: id,
            slug: id,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        });
        await prisma.ticketType.create({
          data: {
            id: type,
            eventId: id,
            name: 'GA',
            price: 10,
            quantityTotal: 1,
            quantityAvailable: 1,
          },
        });
      }
      await prisma.order.create({
        data: {
          id: ids.foreignOrder,
          orderNumber: ids.foreignOrder,
          userId: ids.user,
          eventId: ids.foreignEvent,
          totalAmount: 10,
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          receiptStatus: 'SENT',
          receiptSentAt: new Date(),
        },
      });
    })();
    return bodyWork;
  }, 30000);
  afterEach(async () => {
    if (unsafe) throw new Error('Preserve recovery fixtures for managed job teardown');
    await joinBody();
    if (children.size) {
      unsafe = true;
      throw new Error('Unreaped recovery child; preserve fixtures');
    }
    bodyWork = (async () => {
      await prisma.paymentWebhookEvent.deleteMany({ where: { id: { in: ids.events } } });
      await prisma.ticket.deleteMany({ where: { eventId: { in: [ids.event, ids.foreignEvent] } } });
      await prisma.order.deleteMany({ where: { id: { in: [...ids.orders, ids.foreignOrder] } } });
      await prisma.ticketType.deleteMany({ where: { id: { in: [ids.type, ids.foreignType] } } });
      await prisma.event.deleteMany({ where: { id: { in: [ids.event, ids.foreignEvent] } } });
      await prisma.user.deleteMany({ where: { id: ids.user } });
      await prisma.organization.deleteMany({ where: { id: ids.org } });
      rmSync(directory, { recursive: true, force: true });
    })();
    await joinBody();
    await bodyWork;
  }, 15000);
  afterAll(async () => {
    if (!unsafe) await prisma.$disconnect();
  });

  qualify(
    'real SQL rotates 50 poison webhooks, processes healthy51 next, and enforces persisted cooldown',
    async () => {
      const beforeForeign = await foreign();
      const now = Date.now();
      await prisma.paymentWebhookEvent.createMany({
        data: ids.events.map((id, i) => ({
          id,
          type: 'task566.synthetic.unsupported',
          status: 'FAILED',
          attemptGeneration: i < 50 ? 7n : 0n,
          leaseToken: i < 50 ? 'owned-lease-' + id : null,
          processingStartedAt: new Date(now - 600000),
          updatedAt: new Date(now - 180000 + i),
        })),
      });
      const before = await prisma.paymentWebhookEvent.findMany({
        where: { id: { in: ids.events.slice(0, 50) } },
        orderBy: { updatedAt: 'asc' },
      });
      const first = await run(spec({ mode: 'webhook', poisonEvents: ids.events.slice(0, 50) }));
      expect(first.calls).toEqual(before.map((row) => ['event', row.id]));
      const rotated = await prisma.paymentWebhookEvent.findMany({
        where: { id: { in: ids.events.slice(0, 50) } },
      });
      for (const row of rotated) {
        expect(row).toMatchObject({
          status: 'FAILED',
          attemptGeneration: 7n,
          processedAt: null,
          errorMessage:
            'Webhook recovery reconciliation required; owner=tixmo-backend; retry after 60 seconds.',
        });
        const original = before.find((value) => value.id === row.id)!;
        expect(row.leaseToken).toBe(original.leaseToken);
        expect(row.processingStartedAt).toEqual(original.processingStartedAt);
        expect(row.updatedAt.getTime()).toBeGreaterThan(now - 1000);
      }
      const second = await run(spec({ mode: 'webhook', poisonEvents: ids.events.slice(0, 50) }));
      expect(second.calls).toEqual([['event', ids.events[50]]]);
      const healthy = await prisma.paymentWebhookEvent.findUniqueOrThrow({
        where: { id: ids.events[50] },
      });
      expect(healthy).toMatchObject({
        status: 'PROCESSED',
        attemptGeneration: 1n,
        errorMessage: null,
      });
      expect(healthy.processedAt).not.toBeNull();
      expect((await run(spec({ mode: 'webhook' }))).calls).toEqual([]);
      expect(
        await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: ids.events[50] } })
      ).toEqual(healthy);
      await prisma.paymentWebhookEvent.update({
        where: { id: ids.events[0] },
        data: { updatedAt: new Date(Date.now() - 61000) },
      });
      expect(
        (await run(spec({ mode: 'webhook', poisonEvents: ids.events.slice(0, 50) }))).calls
      ).toEqual([['event', ids.events[0]]]);
      expect(await foreign()).toEqual(beforeForeign);
      expect(effects()).toHaveLength(0);
    }
  );

  qualify(
    'stale retrieval failure cannot overwrite a newer real SQL generation completion',
    async () => {
      await seedRefunds(1, 0, [{ index: 0, manual: true }]);
      const beforeFinancial = await snapshot(0),
        beforeForeign = await foreign();
      const id = ids.events[0];
      await prisma.paymentWebhookEvent.create({
        data: {
          id,
          type: 'task566.synthetic.unsupported',
          status: 'FAILED',
          attemptGeneration: 7n,
          leaseToken: 'old-owned-lease',
          processedAt: null,
          processingStartedAt: new Date(Date.now() - 600000),
          updatedAt: new Date(Date.now() - 120000),
        },
      });
      const reply = await run(spec({ mode: 'webhook', casEvent: id }));
      expect(reply.calls).toEqual([['event', id]]);
      expect(reply.casSnapshot).toBeDefined();
      const final = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
      expect(final).toMatchObject({
        status: 'PROCESSED',
        attemptGeneration: 8n,
        errorMessage: null,
        leaseToken: null,
      });
      expect(final.processedAt).not.toBeNull();
      // Compare the entire committed row, including timestamps, after the older
      // recoverPayments catch attempts its stale-selection metadata CAS.
      expect(
        JSON.parse(
          JSON.stringify(final, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        )
      ).toEqual(reply.casSnapshot);
      expect(await snapshot(0)).toEqual(beforeFinancial);
      expect(await foreign()).toEqual(beforeForeign);
      expect(effects()).toHaveLength(0);
    }
  );

  qualify(
    'real SQL refund backlog rotates 50 poison requests and finalizes healthy51 stock once',
    async () => {
      await seedRefunds(52, 50, [{ index: 51, manual: true }]);
      const beforeForeign = await foreign();
      const manual = await prisma.paymentRefund.findUniqueOrThrow({
        where: { id: ids.refunds[51] },
      });
      const poisonIntents = ids.refunds.slice(0, 50).map((id) => 'pi_' + id);
      expect((await run(spec({ poisonIntents }))).calls).toEqual(
        poisonIntents.map((id) => ['intent', id])
      );
      const rotated = await prisma.paymentRefund.findMany({
        where: { id: { in: ids.refunds.slice(0, 50) } },
      });
      expect(rotated).toHaveLength(50);
      for (const row of rotated) {
        expect(row).toMatchObject({
          status: 'REQUESTED',
          stripeRefundId: null,
          errorMessage: ownerReason,
        });
        expect(row.updatedAt.getTime()).toBeGreaterThan(Date.now() - 10000);
      }
      const next = await run(spec({ poisonIntents }));
      expect(next.calls.filter((call) => call[0] === 'create')).toEqual([
        ['create', 'pi_' + ids.refunds[50]],
      ]);
      const settled = await snapshot(50);
      expect(settled.refund.status).toBe('SUCCEEDED');
      expect(settled.refund.order.status).toBe('REFUNDED');
      expect(settled.refund.order.tickets).toEqual([
        expect.objectContaining({ inventoryState: 'RELEASED', status: 'CANCELLED' }),
      ]);
      expect(settled.stock).toMatchObject({
        quantityAvailable: 1,
        quantityHeld: 0,
        quantitySold: 0,
      });
      expect(effects()).toHaveLength(1);
      expect((await run(spec())).calls).toEqual([]);
      expect(await snapshot(50)).toEqual(settled);
      expect(
        await prisma.paymentRefund.findUniqueOrThrow({ where: { id: ids.refunds[51] } })
      ).toEqual(manual);
      await prisma.paymentRefund.update({
        where: { id: ids.refunds[0] },
        data: { updatedAt: new Date(Date.now() - 61000) },
      });
      expect((await run(spec({ poisonIntents }))).calls).toEqual([['intent', poisonIntents[0]]]);
      expect(await snapshot(50)).toEqual(settled);
      expect(await foreign()).toEqual(beforeForeign);
      expect(effects()).toHaveLength(1);
    }
  );

  qualify(
    'SIGKILL after fsynced effect then SQL-age SAME refund beyond23h and recover in a real replacement process',
    async () => {
      await seedRefunds(4, 0, [
        { index: 1, old: true },
        { index: 2, old: true },
        { index: 3, manual: true },
      ]);
      const beforeForeign = await foreign(),
        before = await snapshot(0);
      const manual = await prisma.paymentRefund.findUniqueOrThrow({
        where: { id: ids.refunds[3] },
      });
      const first = await run(spec({ pauseAfterEffect: true }), async (reply) => {
        expect(reply.calls.filter((call) => call[0] === 'create')).toEqual([
          ['create', 'pi_' + ids.refunds[0]],
        ]);
        expect(await snapshot(0)).toEqual(before);
        expect(effects()).toHaveLength(1);
        expect(effects()[0]).toMatchObject({
          key: 'refund-' + ids.refunds[0],
          response: { metadata: { refundId: ids.refunds[0], orderId: ids.orders[0] } },
        });
      });
      const agedAt = new Date(Date.now() - 24 * 3600000);
      await prisma.$executeRaw`UPDATE payment_refunds SET created_at=${agedAt} WHERE id=${ids.refunds[0]}`;
      const aged = await snapshot(0);
      expect(aged.refund.createdAt.getTime()).toBeLessThan(Date.now() - 23 * 3600000);
      expect(aged.refund).toMatchObject({ status: 'REQUESTED', stripeRefundId: null });
      expect(aged.stock).toEqual(before.stock);
      const second = await run(spec({ unavailableIntents: ['pi_' + ids.refunds[2]] }));
      expect(second.pid).not.toBe(first.pid);
      expect(second.calls.filter((call) => call[0] === 'create')).toEqual([]);
      expect(second.calls).toContainEqual(['list', 'pi_' + ids.refunds[0]]);
      const settled = await snapshot(0);
      expect(settled.refund.status).toBe('SUCCEEDED');
      expect(settled.refund.order.status).toBe('REFUNDED');
      expect(settled.refund.order.tickets).toEqual([
        expect.objectContaining({ inventoryState: 'RELEASED', status: 'CANCELLED' }),
      ]);
      expect(settled.stock).toMatchObject({
        quantityAvailable: 1,
        quantityHeld: 0,
        quantitySold: 0,
      });
      for (const index of [1, 2])
        expect(
          await prisma.paymentRefund.findUniqueOrThrow({ where: { id: ids.refunds[index] } })
        ).toMatchObject({ status: 'REQUESTED', stripeRefundId: null, errorMessage: ownerReason });
      expect((await run(spec())).calls).toEqual([]);
      expect(await snapshot(0)).toEqual(settled);
      expect(effects()).toHaveLength(1);
      expect(
        await prisma.paymentRefund.findUniqueOrThrow({ where: { id: ids.refunds[3] } })
      ).toEqual(manual);
      expect(await foreign()).toEqual(beforeForeign);
    }
  );
});
