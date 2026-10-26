// PostgreSQL owns order/refund/inventory state; this synthetic processor owns
// payment truth and idempotency. Scheduling barriers run outside database locks.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { PaymentService } from '../../src/api/payments/service';
import { cleanupTestData, prisma } from '../utils/testUtils';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Refund barrier timeout (harness failure)')),
          8000
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type RefundState = 'pending' | 'succeeded' | 'failed';
type Intent = {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
};
type Refund = {
  id: string;
  payment_intent: string;
  amount: number;
  currency: string;
  metadata: { refundId: string; orderId: string };
  status: RefundState;
};
function processor() {
  const intents = new Map<string, Intent>();
  const refunds = new Map<string, Refund>();
  const keys = new Map<string, Refund>();
  let state: RefundState = 'pending';
  let beforeCreate: (() => Promise<void>) | undefined;
  const stripe = {
    paymentIntents: {
      retrieve: jest.fn((id: string) => {
        const intent = intents.get(id);
        if (!intent) return Promise.reject(new Error('Unknown synthetic payment intent'));
        return Promise.resolve({ ...intent });
      }),
    },
    refunds: {
      list: jest.fn(({ payment_intent }: { payment_intent: string }) =>
        Promise.resolve({
          data: [...refunds.values()]
            .filter((refund) => refund.payment_intent === payment_intent)
            .map((refund) => ({ ...refund })),
        })
      ),
      create: jest.fn(
        async (
          params: Omit<Refund, 'id' | 'currency' | 'status'>,
          options: { idempotencyKey: string }
        ) => {
          await beforeCreate?.();
          const existing = keys.get(options.idempotencyKey);
          if (existing) {
            if (
              existing.payment_intent !== params.payment_intent ||
              existing.amount !== params.amount ||
              existing.metadata.refundId !== params.metadata.refundId
            ) {
              throw new Error('Synthetic processor idempotency parameter conflict');
            }
            return { ...existing };
          }
          const intent = intents.get(params.payment_intent);
          if (!intent) throw new Error('Unknown synthetic payment intent');
          const refund: Refund = {
            ...params,
            id: 're_' + randomUUID(),
            currency: intent.currency,
            status: state,
          };
          keys.set(options.idempotencyKey, refund);
          refunds.set(refund.id, refund);
          return { ...refund };
        }
      ),
      retrieve: jest.fn((id: string) => {
        const refund = refunds.get(id);
        if (!refund) return Promise.reject(new Error('Unknown synthetic refund'));
        return Promise.resolve({ ...refund });
      }),
    },
  };
  return {
    stripe,
    intents,
    refunds,
    keys,
    setState: (value: RefundState) => {
      state = value;
    },
    gateCreate: (work: () => Promise<void>) => {
      beforeCreate = work;
    },
    clearGate: () => {
      beforeCreate = undefined;
    },
  };
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await cleanupTestData();
});
afterAll(async () => {
  jest.restoreAllMocks();
  await cleanupTestData();
  await prisma.$disconnect();
});

async function fixture() {
  const key = 'refund-race-' + randomUUID();
  const organization = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const users = await Promise.all(
    ['target', 'paid', 'pending'].map((label) =>
      prisma.user.create({
        data: {
          email: key + '-' + label + '@example.test',
          passwordHash: 'fixture-only',
          firstName: label,
          lastName: 'Fixture',
        },
      })
    )
  );
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: key,
      slug: key,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 86400000),
      tags: [],
    },
  });
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'Admission',
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 4,
      quantityHeld: 2,
      quantitySold: 4,
    },
  });
  const tier = await prisma.ticketTier.create({
    data: {
      ticketTypeId: type.id,
      name: 'Standard',
      price: 10,
      quantityLimit: 10,
      quantityHeld: 2,
      quantitySold: 4,
    },
  });
  const makeOrder = (index: number, paid: boolean) =>
    prisma.order.create({
      data: {
        orderNumber: key + '-' + index,
        userId: users[index].id,
        eventId: event.id,
        totalAmount: 20,
        currency: 'cad',
        paymentIntentId: paid ? 'pi_' + key + '-' + index : null,
        status: paid ? 'PAID' : 'PENDING',
        paymentStatus: paid ? 'SUCCEEDED' : 'PENDING',
        tickets: {
          create: [0, 1].map((indexWithinOrder) => ({
            eventId: event.id,
            userId: users[index].id,
            ticketTypeId: type.id,
            tierId: tier.id,
            barcode: key + '-' + index + '-' + indexWithinOrder,
            pricePaid: 10,
            inventoryState: paid ? 'SOLD' : 'HELD',
          })),
        },
      },
      include: { tickets: { orderBy: { id: 'asc' } } },
    });
  const target = await makeOrder(0, true);
  const paidOther = await makeOrder(1, true);
  const pendingOther = await makeOrder(2, false);
  const fake = processor();
  fake.intents.set(target.paymentIntentId!, {
    id: target.paymentIntentId!,
    status: 'succeeded',
    amount: 2000,
    amount_received: 2000,
    currency: 'cad',
  });
  const service = new PaymentService();
  (service as any).stripe = fake.stripe;
  return { target, paidOther, pendingOther, type, tier, fake, service };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function snapshot(value: Fixture) {
  const [target, paidOther, pendingOther, type, tier, refunds] = await Promise.all([
    prisma.order.findUniqueOrThrow({
      where: { id: value.target.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    prisma.order.findUniqueOrThrow({
      where: { id: value.paidOther.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    prisma.order.findUniqueOrThrow({
      where: { id: value.pendingOther.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    prisma.ticketType.findUniqueOrThrow({ where: { id: value.type.id } }),
    prisma.ticketTier.findUniqueOrThrow({ where: { id: value.tier.id } }),
    prisma.paymentRefund.findMany({ where: { orderId: value.target.id } }),
  ]);
  return { target, paidOther, pendingOther, type, tier, refunds };
}
function expectOtherBuyersUnchanged(current: Awaited<ReturnType<typeof snapshot>>, value: Fixture) {
  expect(current.paidOther).toEqual(value.paidOther);
  expect(current.pendingOther).toEqual(value.pendingOther);
}
function expectFinalized(current: Awaited<ReturnType<typeof snapshot>>, value: Fixture) {
  expectOtherBuyersUnchanged(current, value);
  expect(current.target).toMatchObject({
    status: 'REFUNDED',
    paymentStatus: 'REFUNDED',
    refundStatus: 'SUCCEEDED',
  });
  expect(current.target.tickets).toEqual(
    value.target.tickets.map((ticket) => ({
      ...ticket,
      inventoryState: 'RELEASED',
      status: 'CANCELLED',
      updatedAt: expect.any(Date),
    }))
  );
  expect([
    current.type.quantityAvailable,
    current.type.quantityHeld,
    current.type.quantitySold,
  ]).toEqual([6, 2, 2]);
  expect([current.tier.quantityHeld, current.tier.quantitySold]).toEqual([2, 2]);
  expect(current.refunds).toHaveLength(1);
  expect(current.refunds[0]).toMatchObject({
    status: 'SUCCEEDED',
    reason: 'ORDER_REFUND',
    amount: 2000,
    currency: 'cad',
  });
  expect(value.fake.refunds.size).toBe(1);
}

test.each([false, true])(
  'overlapping processor refunds preserve sold inventory until success (reverse release=%s)',
  async (reverseRelease) => {
    const value = await fixture();
    expect(
      new Set([value.target.userId, value.paidOther.userId, value.pendingOther.userId]).size
    ).toBe(3);
    const invocation = new AsyncLocalStorage<number>();
    const arrived = [deferred(), deferred()],
      release = [deferred(), deferred()];
    value.fake.gateCreate(async () => {
      const index = invocation.getStore();
      if (index === undefined) throw new Error('Missing refund invocation identity');
      arrived[index].resolve();
      await bounded(release[index].promise);
    });
    const calls = [0, 1].map((index) =>
      invocation.run(index, () => value.service.refundOrder(value.target.id))
    );
    const outcomes = Promise.allSettled(calls);
    try {
      await bounded(Promise.all(arrived.map((barrier) => barrier.promise)));
      // Both durable requests have committed and both processor calls are paused;
      // no transaction lock is held while this state is inspected.
      const pending = await snapshot(value);
      expectOtherBuyersUnchanged(pending, value);
      expect(pending.target).toMatchObject({
        status: 'PAID',
        refundStatus: 'PROCESSING',
        paymentStatus: 'SUCCEEDED',
      });
      expect(pending.target.tickets).toEqual(value.target.tickets);
      expect(pending.type).toEqual(value.type);
      expect(pending.tier).toEqual(value.tier);
      expect(pending.refunds).toHaveLength(1);
      expect(pending.refunds[0]).toMatchObject({
        status: 'REQUESTED',
        amount: 2000,
        currency: 'cad',
      });
      expect(value.fake.refunds.size).toBe(0);

      const first = reverseRelease ? 1 : 0;
      release[first].resolve();
      await bounded(calls[first]);
      release[1 - first].resolve();
      expect((await bounded(outcomes)).map((result) => result.status)).toEqual([
        'fulfilled',
        'fulfilled',
      ]);
      value.fake.clearGate();
      const stillPending = await snapshot(value);
      expectOtherBuyersUnchanged(stillPending, value);
      expect(stillPending.target).toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
      expect(stillPending.target.tickets).toEqual(value.target.tickets);
      expect(stillPending.type).toEqual(value.type);
      expect(stillPending.tier).toEqual(value.tier);
      expect(stillPending.refunds).toHaveLength(1);
      const record = stillPending.refunds[0];
      expect(record.status).toBe('PROCESSING');
      expect(value.fake.stripe.refunds.create).toHaveBeenCalledTimes(2);
      expect(value.fake.refunds.size).toBe(1);
      expect(value.fake.keys.size).toBe(1);
      expect(
        new Set(value.fake.stripe.refunds.create.mock.calls.map((call) => call[1].idempotencyKey))
      ).toEqual(new Set(['refund-' + record.id]));

      [...value.fake.refunds.values()][0].status = 'succeeded';
      await value.service.recoverRefunds();
      expect(await snapshot(value)).toEqual(stillPending); // Fresh row cannot finalize early.
      await prisma.paymentRefund.update({
        where: { id: record.id },
        data: { updatedAt: new Date(Date.now() - 60001) },
      });
      await Promise.all([value.service.recoverRefunds(), value.service.recoverRefunds()]);
      const finalized = await snapshot(value);
      expectFinalized(finalized, value);
      await value.service.recoverRefunds();
      await value.service.refundOrder(value.target.id);
      expect(await snapshot(value)).toEqual(finalized);
      expect(value.fake.stripe.refunds.create).toHaveBeenCalledTimes(2);
    } finally {
      release.forEach((barrier) => barrier.resolve());
      await bounded(outcomes);
      value.fake.clearGate();
    }
  },
  25000
);

test.each(['USED', 'TRANSFERRED'] as const)(
  '%s tickets reject the refund before processor or inventory effects',
  async (state) => {
    const value = await fixture();
    await prisma.ticket.update({
      where: { id: value.target.tickets[0].id },
      data: {
        status: state,
        ...(state === 'TRANSFERRED'
          ? { transferredAt: new Date(), userId: value.pendingOther.userId }
          : {}),
      },
    });
    const before = await snapshot(value);
    await expect(value.service.refundOrder(value.target.id)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(await snapshot(value)).toEqual(before);
    expect(value.fake.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(value.fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(value.fake.refunds.size).toBe(0);
  }
);

test.each(['type', 'tier'] as const)(
  'inconsistent %s sold inventory preserves processor success and rolls back finalization, then recovers',
  async (inconsistent) => {
    const value = await fixture();
    value.fake.setState('succeeded');
    if (inconsistent === 'type')
      await prisma.ticketType.update({
        where: { id: value.type.id },
        data: { quantityAvailable: 7, quantitySold: 1 },
      });
    else
      await prisma.ticketTier.update({ where: { id: value.tier.id }, data: { quantitySold: 1 } });
    const before = await snapshot(value);
    await expect(value.service.refundOrder(value.target.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    const failedFinalization = await snapshot(value);
    expectOtherBuyersUnchanged(failedFinalization, value);
    expect(failedFinalization.target).toMatchObject({
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      refundStatus: 'PROCESSING',
    });
    expect(failedFinalization.target.tickets).toEqual(before.target.tickets);
    // A tier failure occurs after the type-counter update: equality also proves
    // that earlier update rolled back with the failed ticket transition.
    expect(failedFinalization.type).toEqual(before.type);
    expect(failedFinalization.tier).toEqual(before.tier);
    expect(failedFinalization.refunds).toHaveLength(1);
    expect(failedFinalization.refunds[0]).toMatchObject({
      status: 'SUCCEEDED',
      amount: 2000,
      currency: 'cad',
    });
    expect(value.fake.refunds.size).toBe(1);
    expect([...value.fake.refunds.values()][0].status).toBe('succeeded');
    expect(value.fake.stripe.refunds.create).toHaveBeenCalledTimes(1);

    // Fixture repair restores the known allocation (four sold, two held); the
    // durable processor result must then complete locally without a second refund.
    if (inconsistent === 'type')
      await prisma.ticketType.update({
        where: { id: value.type.id },
        data: { quantityAvailable: 4, quantitySold: 4 },
      });
    else
      await prisma.ticketTier.update({ where: { id: value.tier.id }, data: { quantitySold: 4 } });
    const repairedBeforeCooldown = await snapshot(value);
    await value.service.recoverRefunds();
    expect(await snapshot(value)).toEqual(repairedBeforeCooldown); // Still cooling down.
    await prisma.paymentRefund.update({
      where: { id: failedFinalization.refunds[0].id },
      data: { updatedAt: new Date(Date.now() - 60001) },
    });
    await Promise.all([value.service.recoverRefunds(), value.service.recoverRefunds()]);
    const recovered = await snapshot(value);
    expectFinalized(recovered, value);
    await value.service.recoverRefunds();
    expect(await snapshot(value)).toEqual(recovered);
    expect(value.fake.stripe.refunds.create).toHaveBeenCalledTimes(1);
  },
  20000
);
