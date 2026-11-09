jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({ webhooks: { constructEvent: jest.fn() } }))
);
jest.mock('../../src/config/environment', () => ({
  config: {
    nodeEnv: 'test',
    stripeSecretKey: 'sk_test_mock',
    stripeWebhookSecret: 'whsec_mock',
    paymentCurrency: 'cad',
    cartExpiryMinutes: 15,
  },
}));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    paymentRefund: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    paymentRefundLine: { findMany: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
    paymentWebhookEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    paymentAttempt: { findMany: jest.fn(), update: jest.fn() },
    event: { findUnique: jest.fn() },
  },
}));

import { logger } from '../../src/config/logger';
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
import { PaymentService, paymentService } from '../../src/api/payments/service';
import {
  runWithRefundActor,
  schedulerRefundStore,
  setRefundSubject,
  staffRefundStore,
} from '../../src/api/payments/refund-actor';
import { formatLogLine } from '../../src/api/payments/refund-log-format';
import {
  startPaymentRecoveryJob,
  stopPaymentRecoveryJob,
} from '../../src/jobs/payment-recovery.job';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const REFUND_ID = '22222222-2222-4222-8222-222222222222';
const PROVIDER_REFUND_ID = 're_testRefund123';
const EVENT_ID = 'evt_delivered123';
const REPLAY_EVENT_ID = 'evt_replay999';
const FORBIDDEN_KEYS = [
  'email',
  'firstName',
  'lastName',
  'phone',
  'name',
  'buyer',
  'customer',
  'paymentMethod',
  'card',
  'last4',
  'brand',
  'payload',
  'body',
  'raw',
  'rawPayload',
  'secret',
  'authorization',
  'auth',
  'idempotencyKey',
  'idempotency',
  'token',
  'password',
  'cookie',
  'staffId',
  'userId',
  'actorId',
  'signature',
  'clientSecret',
  'webhookSecret',
  'apiKey',
];
const SECRET_TEXT = [
  'buyer@example.com',
  '+15555550123',
  'idempotency-key',
  'sk_test_mock',
  'whsec_mock',
  'Bearer staff-token',
  'pm_card_visa',
  '4242424242424242',
  'pi_secretshouldnotlog',
  'staff-user-id',
].join(' ');

const db = prisma as any;
const info = logger.info as jest.Mock;
const orders = new OrderService();
const service = new PaymentService();
const previousRelease = process.env.RELEASE;
const previousReplica = process.env.RAILWAY_REPLICA_ID;

const tx = {
  $queryRaw: jest.fn(),
  order: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
  ticket: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
  ticketType: { updateMany: jest.fn() },
  ticketTier: { updateMany: jest.fn() },
  paymentRefundLine: { findMany: jest.fn() },
  paymentRefund: { findMany: jest.fn(), findFirst: jest.fn() },
};

let phase = 'open';
let order: any;

const money = (cents: number) => ({
  eq: (value: number) => Math.round(Number(value) * 100) === cents,
  toNumber: () => cents / 100,
});

const refundRecord = () => ({
  id: REFUND_ID,
  orderId: ORDER_ID,
  reason: 'ORDER_REFUND',
  status: 'SUCCEEDED',
  stripeRefundId: PROVIDER_REFUND_ID,
  paymentIntentId: 'pi_secretshouldnotlog',
  amount: 0,
  currency: 'cad',
  updatedAt: new Date(0),
  email: 'buyer@example.com',
  idempotencyKey: 'idempotency-key',
});

function keysDeep(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    found.push(key);
    keysDeep(child, found);
  }
  return found;
}

function payloads() {
  return info.mock.calls
    .map((call) => call[1]?.structuredPayload)
    .filter((line) => line && typeof line === 'object');
}

function lines(event: string) {
  return payloads().filter((line) => line.event === event);
}

function assertSafe(line: unknown) {
  const serialized = formatLogLine({
    timestamp: '2026-11-09 00:00:00:000',
    level: 'info',
    message: 'ignored',
    structuredPayload: line,
  });
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  expect(serialized.startsWith('{')).toBe(true);
  expect(serialized).not.toContain('\u001b');
  for (const key of keysDeep(parsed)) expect(FORBIDDEN_KEYS).not.toContain(key);
  expect(serialized).not.toContain('buyer@example.com');
  expect(serialized).not.toContain('idempotency');
  expect(serialized).not.toContain('sk_test');
  expect(serialized).not.toContain('whsec_');
  expect(serialized).not.toContain('pm_card');
  expect(serialized).not.toContain('4242424242424242');
  expect(serialized).not.toContain('pi_secretshouldnotlog');
  expect(serialized).not.toContain('staff-user-id');
  expect(serialized).not.toContain('+15555550123');
  return parsed;
}

beforeEach(() => {
  jest.clearAllMocks();
  phase = 'open';
  process.env.RELEASE = '82905ae';
  process.env.RAILWAY_REPLICA_ID = 'replica-1';
  order = {
    id: ORDER_ID,
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    refundStatus: 'PROCESSING',
    totalAmount: money(0),
    currency: 'cad',
    paymentIntentId: null,
    paymentMethod: 'pm_card_visa',
    tickets: [],
    event: { status: 'PUBLISHED', startDatetime: null, ticketingMode: null },
    userId: 'staff-user-id',
    user: {
      email: 'buyer@example.com',
      firstName: 'Buyer',
      lastName: 'Person',
      phone: '+15555550123',
    },
  };
  tx.$queryRaw.mockResolvedValue([]);
  tx.ticket.findMany.mockResolvedValue([]);
  tx.ticket.count.mockResolvedValue(0);
  tx.ticket.updateMany.mockResolvedValue({ count: 0 });
  tx.paymentRefundLine.findMany.mockResolvedValue([]);
  tx.paymentRefund.findMany.mockResolvedValue([]);
  tx.order.findUnique.mockImplementation(() => order);
  tx.order.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
    Object.assign(order, data);
    return { ...order };
  });
  db.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => {
    try {
      const result = await fn(tx);
      phase = 'committed';
      return result;
    } catch (error) {
      phase = 'rolled_back';
      throw error;
    }
  });
  db.paymentRefund.findMany.mockResolvedValue([]);
  db.paymentRefund.findUniqueOrThrow.mockImplementation(() => refundRecord());
  info.mockImplementation(() => {
    expect(phase === 'open' || phase === 'committed' || phase === 'rolled_back').toBe(true);
  });
});

afterEach(() => {
  stopPaymentRecoveryJob();
  jest.useRealTimers();
  if (previousRelease === undefined) delete process.env.RELEASE;
  else process.env.RELEASE = previousRelease;
  if (previousReplica === undefined) delete process.env.RAILWAY_REPLICA_ID;
  else process.env.RAILWAY_REPLICA_ID = previousReplica;
});

describe('refund finalization logs', () => {
  it('logs a committed staff refund after the transaction commits', async () => {
    const phases: string[] = [];
    info.mockImplementation(() => phases.push(phase));
    await service.refundOrder(ORDER_ID, {
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      actor: 'scheduler',
      email: 'buyer@example.com',
      userId: 'staff-user-id',
    } as any);

    const logged = lines('refund.finalize');
    expect(logged).toHaveLength(1);
    const parsed = assertSafe(logged[0]);
    expect(parsed).toMatchObject({
      event: 'refund.finalize',
      message: 'refund.finalize',
      actor: 'staff',
      subpath: null,
      orderId: ORDER_ID,
      refundId: null,
      providerRefundId: null,
      attempt: 1,
      outcome: 'committed',
      reason: null,
      release: '82905ae',
      pid: process.pid,
      instanceId: 'replica-1',
    });
    expect(parsed.invocationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(parsed.invocationId).not.toBe('staff-user-id');
    expect(parsed.startedAt).toEqual(expect.any(String));
    expect(parsed.finishedAt).toEqual(expect.any(String));
    expect(parsed.durationMs).toEqual(expect.any(Number));
    expect(phases).toEqual(['committed']);
    expect(order.status).toBe('REFUNDED');
  });

  it('logs webhook finalization with the Stripe event id and keeps that actor for recoverRefunds', async () => {
    jest.spyOn(service as any, 'beginWebhookEvent').mockResolvedValue({
      eventId: EVENT_ID,
      generation: 1n,
    });
    jest.spyOn(service as any, 'finishWebhookEvent').mockResolvedValue(undefined);
    db.paymentRefund.findMany.mockResolvedValue([refundRecord()]);

    await (service as any).processEvent({
      id: EVENT_ID,
      type: 'refund.updated',
      data: { object: { id: PROVIDER_REFUND_ID, email: 'buyer@example.com' } },
    });

    expect((service as any).beginWebhookEvent).toHaveBeenCalledTimes(1);
    const logged = lines('refund.finalize');
    expect(logged).toHaveLength(1);
    const parsed = assertSafe(logged[0]);
    expect(parsed).toMatchObject({
      actor: 'webhook',
      subpath: null,
      invocationId: EVENT_ID,
      orderId: ORDER_ID,
      refundId: REFUND_ID,
      providerRefundId: PROVIDER_REFUND_ID,
      attempt: 1,
      outcome: 'committed',
    });
    expect(lines('refund.recovery.tick')).toHaveLength(0);
  });

  it('labels a scheduled stored-webhook replay without treating it as the scheduler or a delivered webhook', async () => {
    jest.spyOn(service as any, 'beginWebhookEvent').mockResolvedValue({
      eventId: REPLAY_EVENT_ID,
      generation: 1n,
    });
    jest.spyOn(service as any, 'finishWebhookEvent').mockResolvedValue(undefined);
    db.paymentRefund.findMany.mockResolvedValue([refundRecord()]);
    const store = schedulerRefundStore('interval');

    await runWithRefundActor(store, () =>
      (service as any).processEvent({
        id: REPLAY_EVENT_ID,
        type: 'refund.updated',
        data: { object: { id: PROVIDER_REFUND_ID } },
      })
    );

    const parsed = assertSafe(lines('refund.finalize')[0]);
    expect(parsed).toMatchObject({
      actor: 'scheduler',
      subpath: 'webhook_replay',
      invocationId: store.invocationId,
      outcome: 'committed',
      refundId: REFUND_ID,
      providerRefundId: PROVIDER_REFUND_ID,
    });
    expect(parsed.invocationId).not.toBe(REPLAY_EVENT_ID);
    expect(store.scan.candidateCount).toBeNull();
    expect(lines('refund.recovery.tick')).toHaveLength(0);
  });

  it('logs scheduler startup and interval ticks, including an empty candidate set', async () => {
    const seen: Array<string | null> = [];
    jest.spyOn(paymentService, 'recoverPayments').mockImplementation(async () => {
      const actor = (await import('../../src/api/payments/refund-actor')).getRefundActor();
      seen.push(actor?.subpath ?? null);
      order.status = 'PAID';
      await paymentService.recoverRefunds();
      setRefundSubject(REFUND_ID, PROVIDER_REFUND_ID);
      await orders.finalizeRefund(ORDER_ID);
    });
    jest.useFakeTimers();
    startPaymentRecoveryJob();
    await jest.advanceTimersByTimeAsync(0);

    const startup = lines('refund.finalize').map((line) => assertSafe(line));
    const startupTicks = lines('refund.recovery.tick').map((line) => assertSafe(line));
    expect(seen).toEqual(['startup']);
    expect(startup).toHaveLength(1);
    expect(startup[0]).toMatchObject({
      actor: 'scheduler',
      subpath: 'startup',
      outcome: 'committed',
      orderId: ORDER_ID,
      refundId: REFUND_ID,
      providerRefundId: PROVIDER_REFUND_ID,
      attempt: 1,
    });
    expect(startupTicks).toEqual([
      expect.objectContaining({
        event: 'refund.recovery.tick',
        actor: 'scheduler',
        subpath: 'startup',
        invocationId: startup[0].invocationId,
        candidateCount: 0,
        release: '82905ae',
        pid: process.pid,
        instanceId: 'replica-1',
      }),
    ]);

    await jest.advanceTimersByTimeAsync(60_000);

    const interval = lines('refund.finalize').map((line) => assertSafe(line));
    const ticks = lines('refund.recovery.tick').map((line) => assertSafe(line));
    expect(seen).toEqual(['startup', 'interval']);
    expect(interval[1]).toMatchObject({
      actor: 'scheduler',
      subpath: 'interval',
      outcome: 'committed',
      attempt: 1,
    });
    expect(ticks[1]).toMatchObject({
      actor: 'scheduler',
      subpath: 'interval',
      candidateCount: 0,
      invocationId: interval[1].invocationId,
    });
    expect(interval[0].invocationId).not.toBe(interval[1].invocationId);
  });

  it('does not default a context-free finalizer or refund scan to the scheduler', async () => {
    db.paymentRefund.findMany.mockResolvedValue([refundRecord()]);
    await service.recoverRefunds();
    const parsed = assertSafe(lines('refund.finalize')[0]);
    expect(parsed.actor).toBe('unknown');
    expect(parsed.subpath).toBeNull();
    expect(parsed.invocationId).toBeNull();
    expect(lines('refund.recovery.tick')).toHaveLength(0);
  });

  it('logs noop, refusal, and error without a committed line, and only after the transaction settles', async () => {
    const phases: string[] = [];
    info.mockImplementation(() => phases.push(phase));
    const store = staffRefundStore();

    await runWithRefundActor(store, async () => {
      await orders.finalizeRefund(ORDER_ID);
      await orders.finalizeRefund(ORDER_ID);
    });
    expect(lines('refund.finalize').map((line) => line.outcome)).toEqual([
      'committed',
      'noop_already_refunded',
    ]);
    expect(lines('refund.finalize').map((line) => line.attempt)).toEqual([1, 2]);
    expect(lines('refund.finalize').every((line) => line.actor === 'staff')).toBe(true);
    expect(phases).toEqual(['committed', 'committed']);

    order.status = 'CANCELLED';
    await expect(runWithRefundActor(store, () => orders.finalizeRefund(ORDER_ID))).rejects.toThrow(
      'Order is not paid'
    );
    tx.order.findUnique.mockResolvedValue(null);
    await expect(orders.finalizeRefund(ORDER_ID)).rejects.toThrow('Order not found');
    order.status = 'PAID';
    order.totalAmount = money(1200);
    tx.order.findUnique.mockImplementation(() => order);
    tx.paymentRefundLine.findMany.mockResolvedValue([{ amount: 100, currency: 'cad' }]);
    await orders.finalizeRefund(ORDER_ID);
    tx.paymentRefundLine.findMany.mockResolvedValue([{ amount: 1300, currency: 'cad' }]);
    await expect(orders.finalizeRefund(ORDER_ID)).rejects.toThrow(
      'Processor refund has not been confirmed'
    );

    const outcomes = lines('refund.finalize').map((line) => ({
      outcome: line.outcome,
      reason: line.reason,
      phase: phases[lines('refund.finalize').indexOf(line)],
    }));
    expect(outcomes).toEqual([
      { outcome: 'committed', reason: null, phase: 'committed' },
      { outcome: 'noop_already_refunded', reason: null, phase: 'committed' },
      { outcome: 'refused', reason: 'order_not_paid', phase: 'rolled_back' },
      { outcome: 'refused', reason: 'not_found', phase: 'rolled_back' },
      { outcome: 'refused', reason: 'refund_not_covering', phase: 'committed' },
      { outcome: 'refused', reason: 'processor_refund_not_confirmed', phase: 'rolled_back' },
    ]);
    expect(outcomes.filter((line) => line.outcome === 'committed')).toHaveLength(1);
  });

  it('logs an error when the transaction rolls back and never calls that attempt committed', async () => {
    const phases: string[] = [];
    info.mockImplementation(() => phases.push(phase));
    db.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => {
      await fn(tx);
      phase = 'rolled_back';
      throw new Error(SECRET_TEXT);
    });

    await expect(orders.finalizeRefund(ORDER_ID)).rejects.toThrow(SECRET_TEXT);
    const logged = lines('refund.finalize');
    expect(logged).toHaveLength(1);
    const parsed = assertSafe(logged[0]);
    expect(parsed).toMatchObject({ actor: 'unknown', outcome: 'error', reason: 'exception' });
    expect(parsed.outcome).not.toBe('committed');
    expect(phases).toEqual(['rolled_back']);
  });

  it('keeps a committed refund successful when the logger throws', async () => {
    info.mockImplementation(() => {
      throw new Error('log sink down buyer@example.com');
    });
    await expect(orders.finalizeRefund(ORDER_ID)).resolves.toMatchObject({
      id: ORDER_ID,
      status: 'REFUNDED',
    });
  });

  it('omits an unsafe release value instead of copying it', async () => {
    process.env.RELEASE = 'buyer@example.com';
    await orders.finalizeRefund(ORDER_ID);
    const parsed = assertSafe(lines('refund.finalize')[0]);
    expect(parsed.release).toBeNull();
  });
});
