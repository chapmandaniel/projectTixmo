jest.mock('../../src/utils/notificationService', () => ({ notificationService: { sendAdminAlert: jest.fn().mockResolvedValue(undefined) } }));
import prisma from '../../src/config/prisma';
import Stripe from 'stripe';
import { PaymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { config } from '../../src/config/environment';

afterAll(async () => { await prisma.$disconnect(); });
// Ancient fixture time establishes a crashed owner, not a product lease duration.
test.each([false, true])('PROCESSING duplicate (crashed ancient owner=%s)', async (ancient) => {
  const started = ancient ? new Date('2000-01-01T00:00:00.000Z') : new Date();
  const key = `crash137-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'Race', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 6, quantityHeld: 4 } });
  const otherUser = await prisma.user.create({ data: { email: `${key}-other@example.test`, passwordHash: 'test-only', firstName: 'Other', lastName: 'Buyer' } });
  const makeOrder = (suffix: string, buyer = user.id) => prisma.order.create({ data: { orderNumber: `${key}-${suffix}`, userId: buyer, eventId: event.id, totalAmount: 20, paymentIntentId: suffix === 'a' ? `pi_${key}` : null, paymentStatus: suffix === 'a' ? 'PROCESSING' : 'PENDING',
    tickets: { create: [0, 1].map(i => ({ eventId: event.id, userId: buyer, ticketTypeId: type.id, barcode: `${key}-${suffix}-${i}`, pricePaid: 10 })) } }, include: { tickets: { orderBy: { id: 'asc' } } } });
  const target = await makeOrder('a');
  const otherBefore = await makeOrder('b', otherUser.id);

  const eventId = `evt_${key}`;
  await prisma.paymentWebhookEvent.create({ data: { id: eventId, type: 'payment_intent.succeeded', orderId: target.id, paymentIntentId: target.paymentIntentId, status: 'PROCESSING', processingStartedAt: started, createdAt: started, updatedAt: started } });

  const beforeEvent = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
  const beforeInventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect(target.status).toBe('PENDING');
  expect(target.paymentStatus).toBe('PROCESSING');
  expect(beforeEvent.processedAt).toBeNull();
  expect([beforeInventory.quantityAvailable, beforeInventory.quantityHeld, beforeInventory.quantitySold]).toEqual([6, 4, 0]);
  const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue(undefined);
  const payload = JSON.stringify({ id: eventId, object: 'event', type: 'payment_intent.succeeded', data: { object: { id: target.paymentIntentId, object: 'payment_intent', status: 'succeeded', metadata: { orderId: target.id, userId: user.id } } } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripeWebhookSecret });
  try {
    // No owner invocation is started: only this signed public redelivery runs.
    await new PaymentService().handleWebhook(signature, Buffer.from(payload));
    const row = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    const a = await prisma.order.findUniqueOrThrow({ where: { id: target.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const b = await prisma.order.findUniqueOrThrow({ where: { id: otherBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    const counters = [inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold];
    console.log('TASK137_DURABLE', JSON.stringify({ ancient, before: { event: beforeEvent, target, other: otherBefore, inventory: beforeInventory }, after: { event: row, target: a, other: b, inventory }, emails: email.mock.calls.length }));
    expect(b).toEqual(otherBefore);
    expect(a.tickets).toEqual(target.tickets);
    expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
    expect(await prisma.paymentWebhookEvent.count({ where: { id: eventId } })).toBe(1);
    expect(counters.every(n => n >= 0)).toBe(true);
    expect(counters.reduce((sum, n) => sum + n, 0)).toBe(inventory.quantityTotal);
    if (!ancient) {
      expect(row).toEqual(beforeEvent);
      expect(a).toEqual(target);
      expect(inventory).toEqual(beforeInventory);
      expect(email).not.toHaveBeenCalled();
      return;
    }
    // Baseline observation assertions run first; recovery oracle below is
    // deliberately RED until a separately reviewed recovery contract exists.
    expect(row).toEqual(beforeEvent);
    expect(a).toEqual(target);
    expect(inventory).toEqual(beforeInventory);
    expect(email).not.toHaveBeenCalled();
    expect({ event: row.status, order: a.status, payment: a.paymentStatus, counters, emails: email.mock.calls.length }).toEqual({
      event: 'PROCESSED', order: 'PAID', payment: 'SUCCEEDED', counters: [6, 2, 2], emails: 1,
    });
  } finally { email.mockRestore(); }
}, 15000);
