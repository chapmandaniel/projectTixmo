jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendAdminAlert: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  },
}));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import { config } from '../../src/config/environment';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>, timeoutMs = 5000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
afterAll(async () => {
  await prisma.$disconnect();
});
test('distinct signed failure A cannot regress committed success B before order fence', async () => {
  const staleFailure = true;
  const key = `distinctfailure143-${Date.now()}`;
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
        paymentIntentId: null,
        paymentStatus: 'PENDING',
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

  const eventId = `evt_${key}_failure`;
  const successEventId = `evt_${key}_success`;

  const aService = new PaymentService(),
    bService = new PaymentService();
  const aReached = deferred(),
    aRelease = deferred();
  const trace: string[] = [];
  const snapshot = async () => ({
    event: await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: successEventId } }),
    target: await prisma.order.findUniqueOrThrow({
      where: { id: target.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    other: await prisma.order.findUniqueOrThrow({
      where: { id: otherBefore.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    inventory: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
    tickets: await prisma.ticket.count({ where: { ticketTypeId: type.id } }),
    events: await prisma.paymentWebhookEvent.count({
      where: { id: { in: [eventId, successEventId] } },
    }),
  });
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const realUpdate = prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
  const staleCounts: number[] = [];
  const writes = jest
    .spyOn(prisma.paymentWebhookEvent as any, 'updateMany')
    .mockImplementation(async (args: any) => {
      const result = await realUpdate(args);
      if (args.where.id === eventId && args.data.processedAt) {
        staleCounts.push(result.count);
        trace.push(`A-terminal-${args.data.status}-rows-${result.count}`);
      }
      return result;
    });
  // Gate before the real transaction/fence begins: no event/order lock is held.
  const realFence = (aService as any).withWebhookFence.bind(aService);
  const gateA = jest
    .spyOn(aService as any, 'withWebhookFence')
    .mockImplementation(async (...args: any[]) => {
      expect(args[0]).toEqual({ eventId, generation: 1n });
      trace.push('A-claimed-paused-BEFORE-event-lock');
      aReached.resolve();
      await bounded(aRelease.promise);
      return realFence(...args);
    });
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    type: staleFailure ? 'payment_intent.payment_failed' : 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_${key}`,
        amount: 2000,
        amount_received: 2000,
        currency: 'cad',
        status: 'succeeded',
        metadata: { orderId: target.id, attemptId: attempt.id, userId: user.id },
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: config.stripeWebhookSecret,
  });
  const a = aService.handleWebhook(signature, Buffer.from(payload));
  const aResult = a.then(
    () => undefined,
    (error) => error
  );
  let bResult: Promise<unknown> | undefined;
  try {
    await bounded(aReached.promise);
    const bPayload = JSON.stringify({
      id: successEventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_${key}`,
          amount: 2000,
          amount_received: 2000,
          currency: 'cad',
          status: 'succeeded',
          metadata: { orderId: target.id, attemptId: attempt.id, userId: user.id },
        },
      },
    });
    const bSignature = Stripe.webhooks.generateTestHeaderString({
      payload: bPayload,
      secret: config.stripeWebhookSecret,
    });
    bResult = bService.handleWebhook(bSignature, Buffer.from(bPayload)).then(
      () => undefined,
      (error) => error
    );
    {
      expect(await bounded(bResult)).toBeUndefined();
      staleCounts.length = 0; // Keep the A-only counter explicit; B uses a different ID.
      trace.push('B-PROCESSED-before-A-resume');
    }
    const successor = await snapshot();
    expect(successor.event).toMatchObject({ status: 'PROCESSED', attemptGeneration: 1n });
    expect(successor.event.processedAt).toBeInstanceOf(Date);
    expect(successor.target).toMatchObject({
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      paymentIntentId: `pi_${key}`,
    });
    expect(successor.other).toEqual(otherBefore);
    expect(successor.target.tickets).toEqual(target.tickets);
    expect([
      successor.inventory.quantityAvailable,
      successor.inventory.quantityHeld,
      successor.inventory.quantitySold,
    ]).toEqual([6, 2, 2]);
    expect(successor.tickets).toBe(4);
    expect(successor.events).toBe(2);
    expect(
      await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })
    ).toMatchObject({ status: 'PROCESSING', attemptGeneration: 1n });
    aRelease.resolve();
    expect(await bounded(aResult)).toBe(undefined);
    const afterStale = await snapshot();
    console.log(
      'TASK143_DISTINCT_FAILURE_SERIALIZATION',
      JSON.stringify(
        {
          trace,
          successor,
          afterStale,
          staleCounts,
          failureEvent: await prisma.paymentWebhookEvent.findUniqueOrThrow({
            where: { id: eventId },
          }),
        },
        (_, v) => (typeof v === 'bigint' ? v.toString() : v)
      )
    );
    expect(afterStale).toEqual(successor); // All protected durable state including B event remains unchanged; A bookkeeping is separate.
    expect(staleCounts).toEqual([1]); // A retains its own valid generation and completes bookkeeping.
    expect(
      await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })
    ).toMatchObject({ status: 'PROCESSED', attemptGeneration: 1n });
    expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, subject: 'Payment Failed' })
    );
    expect(email).toHaveBeenCalledTimes(1);
    expect(await bounded(bResult)).toBeUndefined();
    const final = await snapshot();
    expect(final.event).toMatchObject({ status: 'PROCESSED', attemptGeneration: 1n });
    expect({ ...final, event: successor.event }).toEqual(successor);
    expect(email).toHaveBeenCalledTimes(1);
  } finally {
    aRelease.resolve();
    try {
      await bounded(Promise.allSettled([aResult, ...(bResult ? [bResult] : [])]));
    } finally {
      gateA.mockRestore();
      writes.mockRestore();
      email.mockRestore();
    }
  }
}, 15000);
