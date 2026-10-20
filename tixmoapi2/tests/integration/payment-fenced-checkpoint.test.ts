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
test('FAILED retry generation, real transaction fulfillment, stale finish and failure immunity', async () => {
  const key = `fence143-${Date.now()}`;
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
      status: 'FAILED',
    },
  });

  const service = new PaymentService();
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const deliver = async (id: string, eventType = 'payment_intent.succeeded') => {
    const payload = JSON.stringify({
      id,
      object: 'event',
      type: eventType,
      data: {
        object: { id: target.paymentIntentId, metadata: { orderId: target.id, userId: user.id } },
      },
    });
    await service.handleWebhook(
      Stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripeWebhookSecret }),
      Buffer.from(payload)
    );
  };
  try {
    const mismatchPayload = JSON.stringify({
      id: `${eventId}-mismatch`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_wrong', metadata: { orderId: target.id, userId: user.id } } },
    });
    await expect(
      service.handleWebhook(
        Stripe.webhooks.generateTestHeaderString({
          payload: mismatchPayload,
          secret: config.stripeWebhookSecret,
        }),
        Buffer.from(mismatchPayload)
      )
    ).rejects.toMatchObject({ statusCode: 400, message: 'Payment intent does not match order' });
    expect(notificationService.sendAdminAlert).toHaveBeenCalledWith(
      'Payment Intent Mismatch',
      `Payment intent pi_wrong does not match order ${target.id}`
    );
    expect(
      await prisma.order.findUniqueOrThrow({
        where: { id: target.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      })
    ).toEqual(target);
    await deliver(eventId);
    const row = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(row).toMatchObject({ status: 'PROCESSED', attemptGeneration: 1n });
    const snapshot = async () => ({
      order: await prisma.order.findUniqueOrThrow({ where: { id: target.id } }),
      other: await prisma.order.findUniqueOrThrow({
        where: { id: otherBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      }),
      inventory: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
    });
    const before = await snapshot();
    expect(before.order).toMatchObject({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
    expect(before.other).toEqual(otherBefore);
    expect([
      before.inventory.quantityAvailable,
      before.inventory.quantityHeld,
      before.inventory.quantitySold,
    ]).toEqual([6, 2, 2]);
    await deliver(eventId);
    await deliver(`${eventId}-failure`, 'payment_intent.payment_failed');
    expect(await snapshot()).toEqual(before);
    expect(email).toHaveBeenCalledTimes(1);
    await prisma.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSING', attemptGeneration: 2n },
    });
    const successor = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    await (service as any).finishWebhookEvent(
      { eventId, generation: 1n },
      'FAILED',
      new Error('stale')
    );
    expect(await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })).toEqual(
      successor
    );
    await expect(
      (service as any).withWebhookFence({ eventId, generation: 1n }, target.id, async (tx: any) =>
        tx.order.update({ where: { id: target.id }, data: { paymentStatus: 'FAILED' } })
      )
    ).rejects.toThrow('Webhook ownership lost');
    expect(await snapshot()).toEqual(before);
    await prisma.paymentWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'FAILED', attemptGeneration: 9223372036854775807n },
    });
    const exhausted = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(
      await (service as any).beginWebhookEvent({
        id: eventId,
        type: 'payment_intent.succeeded',
        data: { object: { id: target.paymentIntentId, metadata: { orderId: target.id } } },
      })
    ).toBeNull();
    expect(await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })).toEqual(
      exhausted
    );
    await expect(
      (service as any).beginWebhookEvent({ id: '', data: { object: {} } })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await snapshot()).toEqual(before);
  } finally {
    email.mockRestore();
  }
}, 15000);
