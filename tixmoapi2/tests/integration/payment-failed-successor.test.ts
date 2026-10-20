jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) },
}));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
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
test.each([false, true])(
  'failed B real C retry stale A failure=%s',
  async (staleFailure) => {
    const key = `failedbc143-${Date.now()}`;
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

    const snapshot = async () => ({
      event: await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } }),
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
      events: await prisma.paymentWebhookEvent.count({ where: { id: eventId } }),
    });

    const before = {
      target,
      other: otherBefore,
      inventory: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
    };
    const aService = new PaymentService(),
      bService = new PaymentService(),
      cService = new PaymentService();
    const aReached = deferred(),
      aRelease = deferred(),
      cReached = deferred(),
      cRelease = deferred();
    const originalB = new Error('bounded B handler failure before order commit');
    const originalA = new Error('bounded stale A handler failure');
    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
    const gateA = jest
      .spyOn(aService as any, 'handlePaymentSuccess')
      .mockImplementation(async () => {
        aReached.resolve();
        await bounded(aRelease.promise);
        if (staleFailure) throw originalA;
      });
    // Inject at handler entry, not a Prisma/database mock: B owns generation 2 but never commits an order effect.
    const failB = jest
      .spyOn(bService as any, 'handlePaymentSuccess')
      .mockImplementation(async (_intent: any, claim: any) => {
        expect(claim).toEqual({ eventId, generation: 2n });
        throw originalB;
      });
    const realC = (cService as any).finishWebhookEvent.bind(cService);
    const gateC = jest
      .spyOn(cService as any, 'finishWebhookEvent')
      .mockImplementation(async (...args: any[]) => {
        expect(args[0]).toEqual({ eventId, generation: 3n });
        cReached.resolve();
        await bounded(cRelease.promise);
        return realC(...args);
      });
    const realUpdate = prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
    const terminal: Array<{ generation: bigint; status: string; count: number }> = [];
    const writes = jest
      .spyOn(prisma.paymentWebhookEvent as any, 'updateMany')
      .mockImplementation(async (args: any) => {
        const result = await realUpdate(args);
        if (args.where.id === eventId && ['PROCESSED', 'FAILED'].includes(args.data.status))
          terminal.push({
            generation: args.where.attemptGeneration,
            status: args.data.status,
            count: result.count,
          });
        return result;
      });
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: target.paymentIntentId,
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
    const run = (service: PaymentService) =>
      service.handleWebhook(signature, Buffer.from(payload)).then(
        () => undefined,
        (error) => error
      );
    const a = run(aService);
    let c: Promise<unknown> | undefined;
    try {
      await bounded(aReached.promise);
      await prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: { processingStartedAt: new Date('2000-01-01T00:00:00Z') },
      });
      expect(await bounded(run(bService))).toBe(originalB);
      const failed = await snapshot();
      expect(failed.event).toMatchObject({
        status: 'FAILED',
        attemptGeneration: 2n,
        errorMessage: originalB.message,
      });
      expect(failed.event.processedAt).toBeNull();
      expect({ target: failed.target, other: failed.other, inventory: failed.inventory }).toEqual(
        before
      );
      expect(failed.tickets).toBe(4);
      expect(failed.events).toBe(1);
      expect(email).not.toHaveBeenCalled();
      expect(terminal).toEqual([{ generation: 2n, status: 'FAILED', count: 1 }]);
      c = run(cService);
      await bounded(cReached.promise);
      const successor = await snapshot();
      expect(successor.event).toMatchObject({
        status: 'PROCESSING',
        attemptGeneration: 3n,
        processedAt: null,
        errorMessage: null,
      });
      expect(successor.target).toMatchObject({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
      expect(successor.target.tickets).toEqual(
        target.tickets.map((ticket) => ({
          ...ticket,
          inventoryState: 'SOLD',
          updatedAt: expect.any(Date),
        }))
      );
      expect(successor.other).toEqual(otherBefore);
      expect([
        successor.inventory.quantityAvailable,
        successor.inventory.quantityHeld,
        successor.inventory.quantitySold,
      ]).toEqual([6, 2, 2]);
      expect(successor.tickets).toBe(4);
      expect(successor.events).toBe(1);
      terminal.length = 0;
      aRelease.resolve();
      expect(await bounded(a)).toBe(staleFailure ? originalA : undefined);
      expect(await snapshot()).toEqual(successor);
      // Both terminal outcomes from failed B must also be fenced while C still owns PROCESSING.
      for (const status of ['PROCESSED', 'FAILED']) {
        await (bService as any).finishWebhookEvent(
          { eventId, generation: 2n },
          status,
          status === 'FAILED' ? originalB : undefined
        );
        expect(await snapshot()).toEqual(successor);
      }
      expect(terminal).toEqual([
        { generation: 1n, status: staleFailure ? 'FAILED' : 'PROCESSED', count: 0 },
        { generation: 2n, status: 'PROCESSED', count: 0 },
        { generation: 2n, status: 'FAILED', count: 0 },
      ]);
      console.log(
        'TASK143_FAILED_B_C',
        JSON.stringify({ staleFailure, failed, successor, terminal }, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        )
      );
      cRelease.resolve();
      expect(await bounded(c)).toBeUndefined();
      const final = await snapshot();
      expect(final.event).toMatchObject({ status: 'PROCESSED', attemptGeneration: 3n });
      expect({ ...final, event: successor.event }).toEqual(successor);
      await new PaymentService().handleWebhook(signature, Buffer.from(payload));
      expect(await snapshot()).toEqual(final);
      expect(email).toHaveBeenCalledTimes(1);
    } finally {
      aRelease.resolve();
      cRelease.resolve();
      try {
        await bounded(Promise.allSettled([a, ...(c ? [c] : [])]));
      } finally {
        gateA.mockRestore();
        failB.mockRestore();
        gateC.mockRestore();
        writes.mockRestore();
        email.mockRestore();
      }
    }
  },
  15000
);
