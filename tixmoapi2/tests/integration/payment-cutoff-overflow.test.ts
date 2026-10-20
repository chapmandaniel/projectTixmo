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

afterAll(async () => {
  await prisma.$disconnect();
});
// Ancient fixture time establishes a crashed owner, not a product lease duration.
(process.env.TIXMO_EXPERIMENTAL_RECOVERY === '1' ? test : test.skip).each(['FAILED', 'PROCESSING'])(
  'maxBigInt signed public %s admission leaves full business snapshot unchanged',
  async (status) => {
    const ancient = true;
    const started = ancient ? new Date('2000-01-01T00:00:00.000Z') : new Date();
    const key = `overflow143-${Date.now()}`;
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
      data: { organizationId: org.id, name: key, slug: key, tags: [] },
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
          paymentIntentId: suffix === 'a' ? `pi_${key}` : null,
          paymentStatus: suffix === 'a' ? 'PROCESSING' : 'PENDING',
          tickets: {
            create: [0, 1].map((i) => ({
              eventId: event.id,
              userId: buyer,
              ticketTypeId: type.id,
              barcode: `${key}-${suffix}-${i}`,
              pricePaid: 10,
            })),
          },
        },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
    const target = await makeOrder('a');
    const otherBefore = await makeOrder('b', otherUser.id);

    const eventId = `evt_${key}`;
    await prisma.paymentWebhookEvent.create({
      data: {
        id: eventId,
        type: 'payment_intent.succeeded',
        orderId: target.id,
        paymentIntentId: target.paymentIntentId,
        status,
        attemptGeneration: 9223372036854775807n,
        processingStartedAt: started,
        createdAt: started,
        updatedAt: started,
      },
    });

    const beforeEvent = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    const beforeInventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect(target.status).toBe('PENDING');
    expect(target.paymentStatus).toBe('PROCESSING');
    expect(beforeEvent.processedAt).toBeNull();
    expect([
      beforeInventory.quantityAvailable,
      beforeInventory.quantityHeld,
      beforeInventory.quantitySold,
    ]).toEqual([6, 4, 0]);
    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: target.paymentIntentId,
          object: 'payment_intent',
          status: 'succeeded',
          metadata: { orderId: target.id, userId: user.id },
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: config.stripeWebhookSecret,
    });
    try {
      await new PaymentService().handleWebhook(signature, Buffer.from(payload));
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
      const counters = [
        inventory.quantityAvailable,
        inventory.quantityHeld,
        inventory.quantitySold,
      ];
      console.log(
        'TASK143_OWNERLESS_DURABLE',
        JSON.stringify(
          {
            ancient,
            before: { event: beforeEvent, target, other: otherBefore, inventory: beforeInventory },
            after: { event: row, target: a, other: b, inventory },
            emails: email.mock.calls.length,
          },
          (_, value) => (typeof value === 'bigint' ? value.toString() : value)
        )
      );
      expect(b).toEqual(otherBefore);
      expect(a.tickets).toEqual(target.tickets);
      expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
      expect(await prisma.paymentWebhookEvent.count({ where: { id: eventId } })).toBe(1);
      expect(counters.every((n) => n >= 0)).toBe(true);
      expect(counters.reduce((sum, n) => sum + n, 0)).toBe(inventory.quantityTotal);
      expect(row).toEqual(beforeEvent);
      expect(a).toEqual(target);
      expect(inventory).toEqual(beforeInventory);
      expect(email).not.toHaveBeenCalled();
      expect(notificationService.sendAdminAlert).not.toHaveBeenCalled();
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    } finally {
      email.mockRestore();
    }
  },
  15000
);

(process.env.TIXMO_EXPERIMENTAL_RECOVERY === '1' ? test : test.skip).each([-1, 0, 1])(
  'inclusive 300s cutoff offset %sms using one genuine DB sample',
  async (offset) => {
    const sample = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    // Prisma Date truncates PostgreSQL submilliseconds: this proves millisecond boundaries only.
    const id = `evt_cutoff143_${offset}_${Date.now()}`;
    const before = await prisma.paymentWebhookEvent.create({
      data: {
        id,
        type: 'unhandled.test',
        status: 'PROCESSING',
        attemptGeneration: 7n,
        processingStartedAt: new Date(sample[0].now.getTime() - 300_000 + offset),
      },
    });
    const clock = jest
      .spyOn(prisma as any, '$queryRaw')
      .mockImplementation(async (strings: any) => {
        expect(strings.join('')).toBe('SELECT clock_timestamp() AS now');
        return sample;
      });
    try {
      const claim = await (new PaymentService() as any).beginWebhookEvent({
        id,
        type: 'unhandled.test',
        data: { object: {} },
      });
      const after = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
      if (offset <= 0) {
        expect(claim).toEqual({ eventId: id, generation: 8n });
        expect(after).toMatchObject({
          status: 'PROCESSING',
          attemptGeneration: 8n,
          processingStartedAt: sample[0].now,
        });
      } else {
        expect(claim).toBeNull();
        expect(after).toEqual(before);
      }
      expect(await prisma.paymentWebhookEvent.count({ where: { id } })).toBe(1);
      console.log(
        'TASK143_CUTOFF',
        JSON.stringify({ offset, sample, before, after }, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        )
      );
    } finally {
      clock.mockRestore();
    }
  },
  15000
);
