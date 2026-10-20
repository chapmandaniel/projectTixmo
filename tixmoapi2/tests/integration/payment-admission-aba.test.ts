jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendAdminAlert: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  },
}));
import prisma from '../../src/config/prisma';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded<T>(p: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('ABA barrier harness timeout')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
afterAll(async () => {
  await prisma.$disconnect();
});
// Direct private admissions only: not public whole-handler acceptance.
test.each(['FAILED', 'PROCESSING'])(
  'generation-only admission ABA %s preserves successor',
  async (status) => {
    const started = new Date('2000-01-01T00:00:00Z');
    const key = `admissionaba143-${Date.now()}`;
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
        status,
        attemptGeneration: 7n,
        processingStartedAt: started,
        createdAt: started,
        updatedAt: started,
      },
    });

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
    const before = await snapshot();
    const reached = deferred(),
      release = deferred();
    const realUpdate = prisma.paymentWebhookEvent.updateMany.bind(prisma.paymentWebhookEvent);
    const updates: any[] = [];
    const writes = jest
      .spyOn(prisma.paymentWebhookEvent as any, 'updateMany')
      .mockImplementation(async (args: any) => {
        const index = updates.length;
        const observation: any = { args };
        updates.push(observation);
        if (index === 0) {
          reached.resolve();
          await bounded(release.promise);
        }
        const result = await realUpdate(args);
        observation.count = result.count;
        return result;
      });
    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
    const input = {
      id: eventId,
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
    };
    const stale = (new PaymentService() as any).beginWebhookEvent(input);
    try {
      await bounded(reached.promise); // A has read g=7; actual UPDATE has not run, no transaction held.
      expect(await bounded((new PaymentService() as any).beginWebhookEvent(input))).toEqual({
        eventId,
        generation: 8n,
      });
      // Explicit fixture-only transition restores SAME status/lease eligibility, retaining genuine successor generation.
      await prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          status,
          processingStartedAt: started,
          errorMessage: 'fixture successor remains eligible',
        },
      });
      const successor = await snapshot();
      expect(successor.event).toMatchObject({
        status,
        attemptGeneration: 8n,
        processingStartedAt: started,
      });
      expect({ ...successor, event: before.event }).toEqual(before);
      release.resolve();
      const result = await bounded(stale);
      const after = await snapshot();
      console.log(
        'TASK143_ADMISSION_ABA',
        JSON.stringify({ status, result, updates, before, successor, after }, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        )
      );
      expect(updates[0].count).toBe(0); // Actual DB affected-row oracle; mutant must fail here, never timeout.
      expect(result).toBeNull();
      expect(after).toEqual(successor);
      expect(email).not.toHaveBeenCalled();
      expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      try {
        await bounded(Promise.allSettled([stale]));
      } finally {
        writes.mockRestore();
        email.mockRestore();
      }
    }
  },
  15000
);
