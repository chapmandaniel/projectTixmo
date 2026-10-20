jest.mock('../../src/utils/notificationService', () => ({
  notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) },
}));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { config } from '../../src/config/environment';

afterAll(async () => {
  await prisma.$disconnect();
});
// Ancient fixture time establishes a crashed owner, not a product lease duration.
test.each([false, true])(
  'PROCESSING duplicate (crashed ancient owner=%s)',
  async (ancient) => {
    const started = ancient ? new Date('2000-01-01T00:00:00.000Z') : new Date();
    const key = `crash137-${Date.now()}`;
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
        status: 'PROCESSING',
        processingStartedAt: started,
        createdAt: started,
        updatedAt: started,
      },
    });

    const email = jest
      .spyOn(orderService, 'sendOrderConfirmationEmail')
      .mockResolvedValue(undefined);
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
      emails: email.mock.calls.length,
    });
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
      const before = await snapshot();
      expect(before.target).toEqual(target);
      expect(before.other).toEqual(otherBefore);
      expect(before.target.status).toBe('PENDING');
      expect(before.target.paymentStatus).toBe('PROCESSING');
      expect(before.event.status).toBe('PROCESSING');
      // Deliberately omitted seed generation exercises the schema's legacy default.
      expect(before.event.attemptGeneration).toBe(0n);
      expect(before.event.errorMessage).toBeNull();
      expect(before.event.processedAt).toBeNull();
      expect(before.event.processingStartedAt).toEqual(started);
      expect(Number.isFinite(before.event.processingStartedAt.getTime())).toBe(true);
      expect([
        before.inventory.quantityAvailable,
        before.inventory.quantityHeld,
        before.inventory.quantitySold,
      ]).toEqual([6, 4, 0]);
      expect([before.tickets, before.events, before.emails]).toEqual([4, 1, 0]);
      // No owner invocation is started: only this signed public redelivery runs.
      await new PaymentService().handleWebhook(signature, Buffer.from(payload));
      const after = await snapshot();
      const { event: row, target: a, other: b, inventory } = after;
      const counters = [
        inventory.quantityAvailable,
        inventory.quantityHeld,
        inventory.quantitySold,
      ];
      console.log(
        'TASK137_DURABLE',
        JSON.stringify({ ancient, before, after }, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );
      expect(b).toEqual(before.other);
      expect(a.tickets).toEqual(before.target.tickets);
      expect([after.tickets, after.events]).toEqual([4, 1]);
      for (const state of [before.inventory, inventory]) {
        const quantities = [state.quantityAvailable, state.quantityHeld, state.quantitySold];
        expect(quantities.every((n) => n >= 0)).toBe(true);
        expect(quantities.reduce((sum, n) => sum + n, 0)).toBe(state.quantityTotal);
      }
      if (!ancient) {
        expect(row.attemptGeneration).toBe(0n);
        expect(after).toEqual(before);
        expect(email).not.toHaveBeenCalled();
        return;
      }
      expect(row.attemptGeneration).toBe(1n);
      expect(row.errorMessage).toBeNull();
      expect(row.processingStartedAt).toBeInstanceOf(Date);
      expect(Number.isFinite(row.processingStartedAt.getTime())).toBe(true);
      expect(row.processingStartedAt.getTime()).toBeGreaterThan(started.getTime());
      expect(row.processedAt).toBeInstanceOf(Date);
      expect(Number.isFinite(row.processedAt!.getTime())).toBe(true);
      expect(row.processedAt!.getTime()).toBeGreaterThanOrEqual(row.processingStartedAt.getTime());
      expect(Number.isFinite(row.updatedAt.getTime())).toBe(true);
      expect(row.updatedAt.getTime()).toBeGreaterThan(started.getTime());
      // Only lifecycle fields may change; identity/type/order/intent/createdAt stay fixed.
      expect(row).toEqual({
        ...before.event,
        status: 'PROCESSED',
        attemptGeneration: 1n,
        processingStartedAt: row.processingStartedAt,
        processedAt: row.processedAt,
        updatedAt: row.updatedAt,
      });
      expect(a).toEqual({
        ...before.target,
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        updatedAt: a.updatedAt,
      });
      expect(a.paymentIntentId).toBe(target.paymentIntentId);
      expect(inventory).toEqual({
        ...before.inventory,
        quantityHeld: before.inventory.quantityHeld - 2,
        quantitySold: before.inventory.quantitySold + 2,
        updatedAt: inventory.updatedAt,
      });
      expect({
        event: row.status,
        order: a.status,
        payment: a.paymentStatus,
        counters,
        emails: after.emails,
      }).toEqual({
        event: 'PROCESSED',
        order: 'PAID',
        payment: 'SUCCEEDED',
        counters: [6, 2, 2],
        emails: 1,
      });
      // Terminal duplicate must preserve every durable field, timestamp and generation.
      await new PaymentService().handleWebhook(signature, Buffer.from(payload));
      const repeated = await snapshot();
      console.log(
        'TASK198_TERMINAL_REPEAT',
        JSON.stringify({ ancient, after, repeated }, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );
      expect(repeated).toEqual(after);
      expect(email).toHaveBeenCalledTimes(1);
    } finally {
      email.mockRestore();
    }
  },
  15000
);
