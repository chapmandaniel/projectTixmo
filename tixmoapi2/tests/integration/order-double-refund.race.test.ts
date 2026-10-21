// Historical refund invariants on the current provider-confirmed finalization path.
// All processor operations are inert in-process fixtures.
// Timeouts below bound harness failures; they never choose operation ordering.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { retrieve: jest.fn() },
  refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
})));
import { paymentService } from '../../src/api/payments/service';
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';

const provider = (paymentService as any).stripe;
function bindProvider(order: { paymentIntentId: string | null }) {
  provider.paymentIntents.retrieve.mockResolvedValue({ id: order.paymentIntentId, status: 'succeeded', amount: 2000, amount_received: 2000, currency: 'cad' });
  provider.refunds.list.mockResolvedValue({ data: [] });
  provider.refunds.create.mockImplementation(async (p: any) => ({ id: `re_${order.paymentIntentId}`, status: 'succeeded', amount: p.amount, currency: 'cad', payment_intent: p.payment_intent, metadata: p.metadata }));
}
beforeEach(() => jest.clearAllMocks());
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded(promise: Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});
test.each([false, true])(
  'overlapping refund applies inventory once and preserves other paid and pending buyers (reverse release=%s)',
  async (reverseSchedule) => {
    const key = `race121-${Date.now()}`;
    const org = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    const users = await Promise.all(
      ['target', 'paid', 'pending'].map((suffix) =>
        prisma.user.create({
          data: {
            email: `${key}-${suffix}@example.test`,
            passwordHash: 'test-only',
            firstName: suffix,
            lastName: 'Fixture',
          },
        })
      )
    );
    const event = await prisma.event.create({
      data: { organizationId: org.id, name: key, slug: key, tags: [] },
    });
    const type = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: key,
        price: 10,
        quantityTotal: 10,
        quantityAvailable: 4,
        quantityHeld: 2,
        quantitySold: 4,
      },
    });
    const makeOrder = (index: number, paid: boolean) =>
      prisma.order.create({
        data: {
          orderNumber: `${key}-${index}`,
          userId: users[index].id,
          eventId: event.id,
          totalAmount: 20,
          status: paid ? 'PAID' : 'PENDING',
          paymentStatus: paid ? 'SUCCEEDED' : 'PENDING',
          currency: 'cad',
          paymentIntentId: paid ? `pi_${key}-${index}` : null,
          tickets: {
            create: [0, 1].map((i) => ({
              eventId: event.id,
              userId: users[index].id,
              ticketTypeId: type.id,
              barcode: `${key}-${index}-${i}`,
              pricePaid: 10,
              inventoryState: paid ? 'SOLD' : 'HELD',
            })),
          },
        },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
    const target = await makeOrder(0, true);
    bindProvider(target);
    const paidBefore = await makeOrder(1, true);
    const pendingBefore = await makeOrder(2, false);
    expect(new Set([target.userId, paidBefore.userId, pendingBefore.userId]).size).toBe(3);
    expect([type.quantityAvailable, type.quantityHeld, type.quantitySold]).toEqual([4, 2, 4]);
    const original = prisma.order.findFirst.bind(prisma.order);
    const arrived = [deferred(), deferred()];
    const release = [deferred(), deferred()];
    const trace: string[] = [];
    let reads = 0;
    const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
      // Bind the gate to invocation order, never database completion order.
      const index = args.where.id === target.id && reads < 2 ? reads++ : -1;
      // Force query 1 to complete before query 0 without sleeps or fake results.
      if (reverseSchedule && index === 0) await bounded(arrived[1].promise);
      const snapshot = await original(args);
      if (index >= 0) {
        expect(snapshot?.status).toBe('PAID');
        const tickets = await prisma.ticket.findMany({ where: { orderId: target.id } });
        expect(tickets).toHaveLength(2);
        expect(tickets.every(t => t.status === 'VALID' && t.inventoryState === 'SOLD')).toBe(true);
        trace.push(`read-${index}-PAID`);
        arrived[index].resolve();
        await bounded(release[index].promise);
      }
      return snapshot;
    }) as any);
    const service = new OrderService();
    const first = service.refundOrder(target.id);
    const second = service.refundOrder(target.id);
    // Attach rejection handlers immediately; gate failures cannot become unhandled.
    const outcomes = Promise.allSettled([first, second]);
    try {
      await bounded(Promise.all(arrived.map((g) => g.promise)));
      if (reverseSchedule) expect(trace).toEqual(['read-1-PAID', 'read-0-PAID']);
      const winnerIndex = reverseSchedule ? 1 : 0;
      const loserIndex = 1 - winnerIndex;
      release[winnerIndex].resolve();
      await [first, second][winnerIndex];
      trace.push(`call-${winnerIndex}-committed`);
      release[loserIndex].resolve();
      const settled = await outcomes;
      trace.push('both-settled');
      spy.mockRestore();
      const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
      const a = await prisma.order.findUniqueOrThrow({
        where: { id: target.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const b = await prisma.order.findUniqueOrThrow({
        where: { id: pendingBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const paid = await prisma.order.findUniqueOrThrow({
        where: { id: paidBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const counters = [
        inventory.quantityAvailable,
        inventory.quantityHeld,
        inventory.quantitySold,
      ];
      console.log(
        'TASK121_OBSERVED',
        JSON.stringify({
          trace,
          outcomes: settled.map((r) => r.status),
          counters,
          target: a.status,
          payment: a.paymentStatus,
          otherPending: b.status,
          otherPaid: paid.status,
          ticketStates: a.tickets.map((t) => t.status),
        })
      );
      expect(reads).toBe(2);
      expect(counters.every((n) => n >= 0)).toBe(true);
      expect(counters.reduce((sum, n) => sum + n, 0)).toBe(10);
      expect(b).toEqual(pendingBefore);
      expect(paid).toEqual(paidBefore);
      expect(a.status).toBe('REFUNDED');
      expect(a.paymentStatus).toBe(target.paymentStatus);
      expect(a.tickets).toEqual(
        target.tickets.map((ticket) => ({
          ...ticket,
          status: 'CANCELLED',
          inventoryState: 'RELEASED',
          updatedAt: expect.any(Date),
        }))
      );
      expect(counters).toEqual([6, 2, 2]);
      expect(provider.refunds.create).toHaveBeenCalledTimes(1);
      expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: target.paymentIntentId! } })).toMatchObject({ status: 'SUCCEEDED', amount: 2000, reason: 'ORDER_REFUND' });
      expect(settled[winnerIndex].status).toBe('fulfilled');
      expect(settled[loserIndex].status).toBe('rejected');
      expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(settled.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const loser = settled.find((r) => r.status === 'rejected');
      if (loser?.status === 'rejected') expect(loser.reason).toMatchObject({ statusCode: 400 });
    } finally {
      release.forEach((g) => g.resolve());
      await outcomes;
      spy.mockRestore();
    }
  },
  20000
);

async function refundFixture(sold = 2, ticketStatus: 'VALID' | 'USED' | 'TRANSFERRED' = 'VALID') {
  const key = `guard123-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'test-only',
      firstName: 'Refund',
      lastName: 'Fixture',
    },
  });
  const event = await prisma.event.create({
    data: { organizationId: org.id, name: key, slug: key, tags: [] },
  });
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 10 - sold,
      quantitySold: sold,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: key,
      userId: user.id,
      eventId: event.id,
      totalAmount: 20,
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      currency: 'cad',
      paymentIntentId: `pi_${key}`,
      tickets: {
        create: [0, 1].map((i) => ({
          eventId: event.id,
          userId: user.id,
          ticketTypeId: type.id,
          barcode: `${key}-${i}`,
          pricePaid: 10,
          status: ticketStatus,
          inventoryState: 'SOLD',
        })),
      },
    },
    include: { tickets: { orderBy: { id: 'asc' } } },
  });
  bindProvider(order);
  return { order, type };
}

test('insufficient sold inventory rolls back claim and ticket cancellation completely', async () => {
  const { order, type } = await refundFixture(1);
  await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({
    statusCode: 409,
    message: 'Order inventory is inconsistent',
  });
  expect(
    await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    })
  ).toEqual({ ...order, refundStatus: 'PROCESSING', updatedAt: expect.any(Date) });
  expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: order.paymentIntentId! } })).toMatchObject({ status: 'SUCCEEDED', amount: 2000 });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
});

test('refund preserves scalar/payment fields, cancels refundable SOLD tickets and makes retry idempotent', async () => {
  const { order, type } = await refundFixture();
  const result = await new OrderService().refundOrder(order.id);
  const { tickets, ...scalar } = order;
  expect(result).toEqual({ ...scalar, status: 'REFUNDED', refundStatus: 'SUCCEEDED', updatedAt: expect.any(Date) });
  const after = await prisma.ticket.findMany({
    where: { orderId: order.id },
    orderBy: { id: 'asc' },
  });
  expect(after).toEqual(
    tickets.map(t => ({ ...t, status: 'CANCELLED', inventoryState: 'RELEASED', updatedAt: expect.any(Date) }))
  );
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([
    10, 0, 0,
  ]);
  // The accepted retry DTO also includes relations; preserve exact scalar values.
  const { tickets: retryTickets, event: retryEvent, ...retryScalar } = await new OrderService().refundOrder(order.id) as any;
  expect(retryScalar).toEqual(result);
  expect(retryTickets).toEqual(expect.arrayContaining(after));
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(result);
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(inventory);
});

test.each(['status', 'paymentStatus'] as const)(
  'stale refund rejects concurrent %s change without dependent writes',
  async (field) => {
    const { order, type } = await refundFixture();
    const original = prisma.order.findFirst.bind(prisma.order);
    let changed: unknown;
    const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementationOnce((async (args: any) => {
      const snapshot = await original(args);
      changed = await prisma.order.update({
        where: { id: order.id },
        data: field === 'status' ? { status: 'CANCELLED' } : { paymentStatus: 'FAILED' },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      return snapshot;
    }) as any);
    try {
      await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({
        statusCode: 400,
      });
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      })
    ).toEqual(changed);
    expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(provider.refunds.create).not.toHaveBeenCalled();
  }
);

// Nonrefundable states remain independent denial assertions, not success fixtures.
test.each(['USED', 'TRANSFERRED'] as const)('denies %s without dependent or provider writes', async status => {
  const { order, type } = await refundFixture(2, status);
  await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({ statusCode: 400 });
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(order);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});
