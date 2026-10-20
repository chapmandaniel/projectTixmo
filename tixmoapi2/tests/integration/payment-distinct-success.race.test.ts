jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) },
}));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { AsyncLocalStorage } from 'async_hooks';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { config } from '../../src/config/environment';

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
test.each([
  [0, false],
  [0, true],
  [1, false],
  [1, true],
] as const)(
  'distinct successful webhook IDs preserve single fulfillment (winner=%s, reverse reads=%s)',
  async (winnerIndex, reverseReads) => {
    const key = `race130-${Date.now()}`;
    const org = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    const user = await prisma.user.create({
      data: {
        email: `${key}@example.test`,
        passwordHash: 'test-only',
        firstName: 'Race',
        lastName: 'Fixture',
      },
    });
    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
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
        name: key,
        price: 10,
        quantityTotal: 10,
        quantityAvailable: 6,
        quantityHeld: 4,
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        email: `${key}-other@example.test`,
        passwordHash: 'test-only',
        firstName: 'Other',
        lastName: 'Buyer',
      },
    });
    const makeOrder = (suffix: string, buyer = user.id) =>
      prisma.order.create({
        data: {
          orderNumber: `${key}-${suffix}`,
          userId: buyer,
          eventId: event.id,
          totalAmount: 20,
          currency: 'cad',
          paymentIntentId: suffix === 'a' ? `pi_${key}` : null,
          paymentStatus: suffix === 'a' ? 'PROCESSING' : 'PENDING',
          tickets: {
            create: [0, 1].map((i) => ({
              eventId: event.id,
              userId: buyer,
              ticketTypeId: type.id,
              barcode: `${key}-${suffix}-${i}`,
              pricePaid: 10,
              inventoryState: 'HELD',
            })),
          },
        },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
    const target = await makeOrder('a');
    const attempt = await prisma.paymentAttempt.create({
      data: {
        orderId: target.id,
        amount: 2000,
        currency: 'cad',
        paymentIntentId: target.paymentIntentId,
      },
    });
    const otherBefore = await makeOrder('b', otherUser.id);
    const original = prisma.order.findUnique.bind(prisma.order);
    const arrived = [deferred(), deferred()];
    const release = [deferred(), deferred()];
    const trace: string[] = [];
    let reads = 0;
    const invocation = new AsyncLocalStorage<number>();
    const gated = new Set<number>();
    const service = new PaymentService();
    const originalFence = (service as any).withWebhookFence.bind(service);
    // All scheduling waits precede transaction/event/order locks.
    const spy = jest.spyOn(service as any, 'withWebhookFence').mockImplementation((async (
      ...args: any[]
    ) => {
      // Bind the gate to invocation order, never database completion order.
      const call = invocation.getStore();
      const index = call !== undefined && !gated.has(call) ? call : -1;
      if (index >= 0) {
        gated.add(index);
        reads++;
      }
      // Force the selected real-query completion order without sleeps or fake results.
      if (index === (reverseReads ? 0 : 1)) await bounded(arrived[reverseReads ? 1 : 0].promise);
      const snapshot = await original({ where: { id: target.id } });
      if (index >= 0) {
        expect(snapshot?.status).toBe('PENDING');
        trace.push(`read-${index}-PENDING`);
        arrived[index].resolve();
        await bounded(release[index].promise);
      }
      return originalFence(...args);
    }) as any);
    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
    const events = [0, 1].map((i) => ({
      id: `evt_${key}_${i}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: target.paymentIntentId,
          object: 'payment_intent',
          status: 'succeeded',
          amount: 2000,
          amount_received: 2000,
          currency: 'cad',
          metadata: { orderId: target.id, attemptId: attempt.id, userId: user.id },
        },
      },
    }));
    const deliver = (index: number) => {
      const payload = JSON.stringify(events[index]);
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: config.stripeWebhookSecret,
      });
      return invocation.run(index, () => service.handleWebhook(signature, Buffer.from(payload)));
    };
    const first = deliver(0);
    const second = deliver(1);
    // Attach rejection handlers immediately; gate failures cannot become unhandled.
    const outcomes = Promise.allSettled([first, second]);
    try {
      await bounded(Promise.all(arrived.map((g) => g.promise)));
      expect(trace).toEqual(
        reverseReads ? ['read-1-PENDING', 'read-0-PENDING'] : ['read-0-PENDING', 'read-1-PENDING']
      );
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
        where: { id: otherBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const counters = [
        inventory.quantityAvailable,
        inventory.quantityHeld,
        inventory.quantitySold,
      ];
      console.log(
        'TASK130_OBSERVED',
        JSON.stringify({
          winnerIndex,
          reverseReads,
          trace,
          outcomes: settled.map((r) => r.status),
          counters,
          target: a.status,
          payment: a.paymentStatus,
          other: b.status,
          ticketStates: a.tickets.map((t) => t.status),
        })
      );
      expect(reads).toBe(2);
      expect(counters.every((n) => n >= 0)).toBe(true);
      expect(counters.reduce((sum, n) => sum + n, 0)).toBe(10);
      expect(b).toEqual(otherBefore);
      expect(a.status).toBe('PAID');
      expect(a.paymentStatus).toBe('SUCCEEDED');
      expect(a.paymentIntentId).toBe(target.paymentIntentId);
      expect(a.tickets).toHaveLength(2);
      expect(b.tickets).toHaveLength(2);
      expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
      expect(a.tickets).toEqual(
        target.tickets.map((ticket) => ({
          ...ticket,
          inventoryState: 'SOLD',
          updatedAt: expect.any(Date),
        }))
      );
      expect(counters).toEqual([6, 2, 2]);
      expect(settled.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
      const initialRows = await prisma.paymentWebhookEvent.findMany({
        where: { id: { in: events.map((e) => e.id) } },
        orderBy: { id: 'asc' },
      });
      expect(initialRows).toHaveLength(2);
      for (const [index, row] of initialRows.entries()) {
        expect(row).toMatchObject({
          id: events[index].id,
          type: 'payment_intent.succeeded',
          orderId: target.id,
          paymentIntentId: target.paymentIntentId,
          status: 'PROCESSED',
          processedAt: expect.any(Date),
          processingStartedAt: expect.any(Date),
        });
        expect(row.errorMessage).toBeNull();
      }
      expect(email).toHaveBeenCalledTimes(1);
      // Per tasks139/146: serialized same-intent success is a paid no-op, not FAILED.
      // Both same-ID duplicates must preserve complete event snapshots.
      await deliver(loserIndex);
      const recoveredRows = await prisma.paymentWebhookEvent.findMany({
        where: { id: { in: events.map((e) => e.id) } },
        orderBy: { id: 'asc' },
      });
      expect(recoveredRows).toEqual(initialRows);
      expect(recoveredRows.map((row) => row.status)).toEqual(['PROCESSED', 'PROCESSED']);
      expect(recoveredRows.map((row) => row.errorMessage)).toEqual([null, null]);
      await deliver(winnerIndex);
      expect(
        await prisma.paymentWebhookEvent.findMany({
          where: { id: { in: events.map((e) => e.id) } },
          orderBy: { id: 'asc' },
        })
      ).toEqual(recoveredRows);
      expect(
        await prisma.order.findUniqueOrThrow({
          where: { id: target.id },
          include: { tickets: { orderBy: { id: 'asc' } } },
        })
      ).toEqual(a);
      expect(
        await prisma.order.findUniqueOrThrow({
          where: { id: otherBefore.id },
          include: { tickets: { orderBy: { id: 'asc' } } },
        })
      ).toEqual(otherBefore);
      expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(
        inventory
      );
      expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
      expect(email).toHaveBeenCalledTimes(1);
      console.log(
        'TASK130_EVENTS',
        JSON.stringify({
          winnerIndex,
          reverseReads,
          initial: initialRows.map((row) => ({
            id: row.id,
            status: row.status,
            errorMessage: row.errorMessage,
          })),
          recovered: recoveredRows.map((row) => ({ id: row.id, status: row.status })),
        })
      );
    } finally {
      release.forEach((g) => g.resolve());
      await outcomes;
      spy.mockRestore();
      email.mockRestore();
    }
  },
  20000
);
