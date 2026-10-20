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
test.each([false, true])(
  'FAILED same-ID retry has one claimant (second delivery claims first=%s)',
  async (secondFirst) => {
    const key = `race132-${Date.now()}`;
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

    const eventId = `evt_${key}`;
    await prisma.paymentWebhookEvent.create({
      data: {
        id: eventId,
        type: 'payment_intent.succeeded',
        orderId: target.id,
        paymentIntentId: target.paymentIntentId,
        status: 'FAILED',
        errorMessage: 'prior confirmation failure',
      },
    });
    const invocation = new AsyncLocalStorage<number>();
    const claimRead = [deferred(), deferred()];
    const claimRelease = [deferred(), deferred()];
    const orderRead = [deferred(), deferred()];
    const orderRelease = [deferred(), deferred()];
    const claimDone = [deferred(), deferred()];
    const trace: string[] = [];
    const originalRead = prisma.paymentWebhookEvent.findUnique.bind(prisma.paymentWebhookEvent);
    const originalWrite = prisma.paymentWebhookEvent.update.bind(prisma.paymentWebhookEvent);
    const originalClaim = prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
    const originalOrder = prisma.order.findUnique.bind(prisma.order);
    let claims = 0;
    const gated = new Set<number>();
    const readSpy = jest.spyOn(prisma.paymentWebhookEvent, 'findUnique').mockImplementation((async (
      args: any
    ) => {
      const index = invocation.getStore();
      const row = await originalRead(args);
      if (args.where.id === eventId && index !== undefined) {
        expect(row?.status).toBe('FAILED');
        trace.push(`claim-read-${index}-FAILED`);
        claimRead[index].resolve();
        await bounded(claimRelease[index].promise);
      }
      return row;
    }) as any);
    const writeSpy = jest.spyOn(prisma.paymentWebhookEvent, 'update').mockImplementation((async (
      args: any
    ) => {
      const index = invocation.getStore();
      const row = await originalWrite(args);
      if (args.where.id === eventId) {
        trace.push(`write-${index}-${args.data.status}`);
        if (args.data.status === 'PROCESSING') {
          claims++;
          if (index !== undefined) claimDone[index].resolve();
        }
      }
      return row;
    }) as any);
    const claimSpy = jest
      .spyOn(prisma.paymentWebhookEvent, 'updateMany')
      .mockImplementation((async (args: any) => {
        const result = await originalClaim(args);
        const index = invocation.getStore();
        if (args.where.id === eventId && index !== undefined && args.data.status === 'PROCESSING') {
          claims += result.count;
          trace.push(`claim-${index}-${result.count}`);
          claimDone[index].resolve();
        }
        return result;
      }) as any);
    const service = new PaymentService();
    const originalFence = (service as any).withWebhookFence.bind(service);
    // Invocation gate runs BEFORE the transaction acquires event/order locks.
    const orderSpy = jest.spyOn(service as any, 'withWebhookFence').mockImplementation((async (
      ...args: any[]
    ) => {
      const index = invocation.getStore();
      if (index !== undefined && !gated.has(index)) {
        gated.add(index);
        expect((await originalOrder({ where: { id: target.id } }))?.status).toBe('PENDING');
        trace.push(`pre-fence-${index}-PENDING`);
        orderRead[index].resolve();
        await bounded(orderRelease[index].promise);
      }
      return originalFence(...args);
    }) as any);
    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
    const eventPayload = JSON.stringify({
      id: eventId,
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
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: config.stripeWebhookSecret,
    });
    const deliver = (index: number) =>
      invocation.run(index, () => service.handleWebhook(signature, Buffer.from(eventPayload)));
    const calls = [deliver(0), deliver(1)];
    const outcomes = Promise.allSettled(calls);
    try {
      await bounded(Promise.all(claimRead.map((g) => g.promise)));
      // Both retain real FAILED pre-reads. Reverse the atomic admission winner.
      const winner = secondFirst ? 1 : 0;
      const loser = 1 - winner;
      claimRelease[winner].resolve();
      await bounded(orderRead[winner].promise);
      claimRelease[loser].resolve();
      await bounded(claimDone[loser].promise);
      orderRelease[winner].resolve();
      await calls[winner];
      // Original unconditional admission enters the second handler; release it so
      // the single-owner oracle fails rather than timing out on an obsolete gate.
      orderRelease[loser].resolve();
      const settled = await outcomes;
      readSpy.mockRestore();
      writeSpy.mockRestore();
      claimSpy.mockRestore();
      orderSpy.mockRestore();
      const row = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
      const a = await prisma.order.findUniqueOrThrow({
        where: { id: target.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const b = await prisma.order.findUniqueOrThrow({
        where: { id: otherBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
      console.log(
        'TASK132_OBSERVED',
        JSON.stringify(
          {
            secondFirst,
            trace,
            claims,
            outcomes: settled.map((r) => r.status),
            row,
            counters: [inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold],
          },
          (_, value) => (typeof value === 'bigint' ? value.toString() : value)
        )
      );
      expect(claims).toBe(1);
      expect(trace).toContain(`claim-${loser}-0`);
      expect(gated.size).toBe(1);
      expect(settled.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(row).toMatchObject({
        id: eventId,
        type: 'payment_intent.succeeded',
        orderId: target.id,
        paymentIntentId: target.paymentIntentId,
        status: 'PROCESSED',
        errorMessage: null,
        processedAt: expect.any(Date),
        processingStartedAt: expect.any(Date),
      });
      expect(await prisma.paymentWebhookEvent.count({ where: { id: eventId } })).toBe(1);
      expect(a.status).toBe('PAID');
      expect(a.paymentStatus).toBe('SUCCEEDED');
      expect(a.paymentIntentId).toBe(target.paymentIntentId);
      expect(a.tickets).toEqual(
        target.tickets.map((ticket) => ({
          ...ticket,
          inventoryState: 'SOLD',
          updatedAt: expect.any(Date),
        }))
      );
      expect(b).toEqual(otherBefore);
      expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual(
        [6, 2, 2]
      );
      expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
      expect(email).toHaveBeenCalledTimes(1);
      // Explicit sequential FAILED recovery, then processed duplicate no-op.
      await prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: { status: 'FAILED', errorMessage: 'retry fixture' },
      });
      // Existing retry contract is a same-intent PAID no-op, not invented policy.
      const payload = Buffer.from(eventPayload);
      await service.handleWebhook(signature, payload);
      const recovered = await prisma.paymentWebhookEvent.findUniqueOrThrow({
        where: { id: eventId },
      });
      expect(recovered.status).toBe('PROCESSED');
      expect(recovered.errorMessage).toBeNull();
      await service.handleWebhook(signature, payload);
      expect(
        await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })
      ).toEqual(recovered);
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
      expect(email).toHaveBeenCalledTimes(1);
    } finally {
      [...claimRelease, ...orderRelease].forEach((g) => g.resolve());
      await outcomes;
      readSpy.mockRestore();
      writeSpy.mockRestore();
      claimSpy.mockRestore();
      orderSpy.mockRestore();
      email.mockRestore();
    }
  },
  20000
);
