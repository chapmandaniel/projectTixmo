import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/utils/jwt';
import { PaymentService, paymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { scannerService } from '../../src/api/scanners/service';
import { ticketService } from '../../src/api/tickets/service';
import { eventService } from '../../src/api/events/service';
import { notificationService } from '../../src/utils/notificationService';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { generateTicketQRData } from '../../src/utils/qrcode';
import { formatMoney } from '../../src/utils/receipt';

function processor() {
  const intents = new Map<string, any>(),
    refunds = new Map<string, any>(),
    keys = new Map<string, any>();
  const events = new Map<string, any>();
  let loseCreateResponse = false;
  let refundState = 'succeeded';
  const stripe = {
    paymentIntents: {
      create: jest.fn(async (params: any, options: any) => {
        const key = options?.idempotencyKey || randomUUID();
        let intent = keys.get(key);
        if (!intent) {
          intent = {
            ...params,
            id: 'pi_' + randomUUID(),
            status: 'requires_payment_method',
            amount_received: 0,
            client_secret: 'synthetic_client_secret',
          };
          keys.set(key, intent);
          intents.set(intent.id, intent);
        }
        if (loseCreateResponse) {
          loseCreateResponse = false;
          throw new Error('Response lost after processor accepted request');
        }
        return intent;
      }),
      retrieve: jest.fn(async (id: string) => intents.get(id)),
      cancel: jest.fn(async (id: string) => {
        const intent = intents.get(id);
        intent.status = 'canceled';
        return intent;
      }),
      search: jest.fn(async () => ({ data: [...intents.values()] })),
    },
    refunds: {
      create: jest.fn(async (params: any, options: any) => {
        let refund = keys.get(options.idempotencyKey);
        if (!refund) {
          refund = {
            ...params,
            id: 're_' + randomUUID(),
            currency: intents.get(params.payment_intent).currency,
            status: refundState,
          };
          keys.set(options.idempotencyKey, refund);
          refunds.set(refund.id, refund);
        }
        return refund;
      }),
      retrieve: jest.fn(async (id: string) => refunds.get(id)),
      list: jest.fn(async (params: any) => ({
        data: [...refunds.values()].filter((r) => r.payment_intent === params.payment_intent),
      })),
    },
    webhooks: { constructEvent: jest.fn((payload: Buffer) => JSON.parse(payload.toString())) },
    events: { retrieve: jest.fn(async (id: string) => events.get(id)) },
  };
  return {
    stripe,
    intents,
    refunds,
    events,
    setLost: () => {
      loseCreateResponse = true;
    },
    setRefundState: (state: string) => {
      refundState = state;
    },
  };
}

describe('Payment, admission and inventory integrity', () => {
  let fake: ReturnType<typeof processor>, service: PaymentService;
  let user: any, recipient: any, event: any, type: any, scanner: any;
  const originalStripe = (paymentService as any).stripe;
  beforeEach(async () => {
    await cleanupTestData();
    jest.restoreAllMocks();
    jest.spyOn(notificationService, 'sendOrderConfirmation').mockResolvedValue(true);
    jest.spyOn(notificationService, 'sendAdminAlert').mockResolvedValue(true);
    fake = processor();
    service = new PaymentService();
    (service as any).stripe = fake.stripe;
    (paymentService as any).stripe = fake.stripe;
    user = await prisma.user.create({
      data: {
        email: 'integrity@test.com',
        firstName: 'Test',
        lastName: 'Buyer',
        passwordHash: 'unused',
        role: 'CUSTOMER',
      },
    });
    recipient = await prisma.user.create({
      data: {
        email: 'recipient@test.com',
        firstName: 'Recipient',
        lastName: 'User',
        passwordHash: 'unused',
        role: 'CUSTOMER',
      },
    });
    const org = await prisma.organization.create({
      data: { name: 'Integrity', slug: randomUUID(), type: 'PROMOTER' },
    });
    event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Integrity',
        slug: randomUUID(),
        status: 'PUBLISHED',
        startDatetime: new Date(Date.now() + 86400000),
        endDatetime: new Date(Date.now() + 90000000),
      },
    });
    type = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Admission',
        price: 10,
        quantityTotal: 20,
        quantityAvailable: 20,
        maxPerOrder: 10,
      },
    });
    scanner = await prisma.scanner.create({
      data: {
        name: 'Gate',
        apiKey: randomUUID(),
        organizationId: org.id,
        eventId: event.id,
        createdBy: user.id,
      },
    });
  });
  afterAll(async () => {
    (paymentService as any).stripe = originalStripe;
    await cleanupTestData();
    jest.restoreAllMocks();
  });
  const reserve = (quantity = 1) =>
    orderService.createOrder(user.id, { items: [{ ticketTypeId: type.id, quantity }] });
  async function paid(quantity = 1) {
    const order = await reserve(quantity);
    const session = await service.createPaymentIntent(order.id, user.id);
    const intent = fake.intents.get(session.paymentIntentId);
    intent.status = 'succeeded';
    intent.amount_received = intent.amount;
    await deliver(intent);
    return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: true } });
  }
  async function deliver(intent: any, id = 'evt_' + randomUUID()) {
    const event = { id, type: 'payment_intent.succeeded', data: { object: intent } };
    fake.events.set(id, event);
    return service.handleWebhook('synthetic_signature', Buffer.from(JSON.stringify(event)));
  }
  async function deliverExternal(type: string, object: any, id = 'evt_' + randomUUID()) {
    const event = { id, type, data: { object } };
    fake.events.set(id, event);
    return service.handleWebhook('synthetic_signature', Buffer.from(JSON.stringify(event)));
  }
  const orderCents = (value: { toNumber(): number }) => Math.round(value.toNumber() * 100);
  const stock = () => prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });

  it('reuses one durable payment session across concurrent requests and a lost response', async () => {
    const order = await reserve();
    fake.setLost();
    await expect(service.createPaymentIntent(order.id, user.id)).rejects.toThrow('Response lost');
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => service.createPaymentIntent(order.id, user.id))
    );
    expect(new Set(responses.map((r) => r.paymentIntentId)).size).toBe(1);
    expect(fake.intents.size).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).currency).toBe(
      'cad'
    );
    await expect(service.createPaymentIntent(order.id, recipient.id)).rejects.toThrow(
      'Order not found'
    );
  });

  it('keeps failed fulfillment retryable, recovers an abandoned lease and never consumes another hold', async () => {
    const order = await reserve(),
      other = await reserve(2);
    const session = await service.createPaymentIntent(order.id, user.id);
    const intent = fake.intents.get(session.paymentIntentId);
    intent.status = 'succeeded';
    intent.amount_received = intent.amount;
    const failure = jest
      .spyOn(orderService, 'confirmOrderInTransaction')
      .mockRejectedValue(new Error('Database unavailable'));
    const id = 'evt_failure_recovery';
    await expect(deliver(intent, id)).rejects.toThrow('Database unavailable');
    expect((await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } })).status).toBe(
      'FAILED'
    );
    expect((await stock()).quantityHeld).toBe(3);
    failure.mockRestore();
    await prisma.paymentWebhookEvent.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        leaseToken: 'abandoned',
        processingStartedAt: new Date(Date.now() - 360000),
      },
    });
    await Promise.all([deliver(intent, id), deliver(intent, id)]);
    expect((await stock()).quantityHeld).toBe(2);
    expect((await stock()).quantitySold).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(
      'PENDING'
    );
    expect((await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } })).status).toBe(
      'PROCESSED'
    );
  });

  it('releases each reservation once when confirmation and repeated cancellation overlap', async () => {
    const order = await reserve(2),
      other = await reserve(3);
    await Promise.allSettled([
      orderService.confirmOrder(order.id),
      orderService.cancelOrder(order.id),
      orderService.cancelOrder(order.id),
      orderService.confirmOrder(order.id),
    ]);
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const inventory = await stock();
    expect(inventory.quantityHeld).toBe(3);
    expect(inventory.quantitySold).toBe(current.status === 'PAID' ? 2 : 0);
    expect(inventory.quantityAvailable).toBe(current.status === 'PAID' ? 15 : 17);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(
      'PENDING'
    );
  });

  it('records manual late payments without reviving expired tickets or stealing a newer hold', async () => {
    const order = await reserve(),
      session = await service.createPaymentIntent(order.id, user.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await Promise.all([orderService.cancelOrder(order.id), orderService.cancelOrder(order.id)]);
    await reserve(2);
    const intent = fake.intents.get(session.paymentIntentId);
    intent.status = 'succeeded';
    intent.amount_received = intent.amount;
    await deliver(intent);
    await deliver(intent);
    expect(fake.refunds.size).toBe(0);
    const manual = await prisma.paymentRefund.findFirstOrThrow({
      where: { paymentIntentId: intent.id },
    });
    expect(manual).toMatchObject({
      orderId: order.id,
      paymentIntentId: intent.id,
      amount: intent.amount_received,
      currency: intent.currency,
      reason: 'LATE_PAYMENT',
      status: 'REQUESTED',
      stripeRefundId: null,
    });
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'CANCELLED', inventoryState: 'RELEASED' }),
      ])
    );
    expect(manual.errorMessage).toBe(
      'Manual reconciliation required: late payment; automatic refund prohibited.'
    );
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentClosedAt
    ).toBeNull();
    expect((await stock()).quantityHeld).toBe(2);
    expect((await stock()).quantitySold).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'CANCELLED'
    );
  });

  it('freezes pending refunds and finalizes processor success once across replay', async () => {
    const order = await paid(2);
    fake.setRefundState('pending');
    const requests = await Promise.all([
      service.refundOrder(order.id),
      service.refundOrder(order.id),
    ]);
    expect(requests.every((o) => o.status === 'PAID' && o.refundStatus === 'PROCESSING')).toBe(
      true
    );
    expect(fake.refunds.size).toBe(1);
    expect((await stock()).quantitySold).toBe(2);
    const ticket = order.tickets[0],
      qr = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    expect(
      (await scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'ENTRY' }))
        .success
    ).toBe(false);
    await expect(ticketService.transferTicket(ticket.id, user.id, recipient.email)).rejects.toThrow(
      'refund in progress'
    );
    const sync = await scannerService.syncTickets(scanner.id, event.id);
    expect(sync.tickets.every((t) => t.status === 'CANCELLED' && t.barcode === '')).toBe(true);
    [...fake.refunds.values()][0].status = 'succeeded';
    await service.recoverRefunds();
    expect((await stock()).quantitySold).toBe(2); // Fresh refund is still cooling down.
    await prisma.paymentRefund.updateMany({
      where: { orderId: order.id },
      data: { updatedAt: new Date(Date.now() - 60001) },
    });
    await Promise.all([service.recoverRefunds(), service.recoverRefunds()]);
    expect((await stock()).quantitySold).toBe(0);
    expect((await stock()).quantityAvailable).toBe(20);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'REFUNDED'
    );
  });

  it('does not claim a failed processor refund returned money or restore stock', async () => {
    const order = await paid();
    fake.setRefundState('failed');
    const result = await service.refundOrder(order.id);
    expect(result.status).toBe('PAID');
    expect(result.refundStatus).toBe('FAILED');
    expect((await stock()).quantitySold).toBe(1);
    expect((await stock()).quantityAvailable).toBe(19);
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: order.tickets[0].id } })).status
    ).toBe('VALID');
  });

  it('rejects duplicate item limit bypass and reserves tier and promo capacity atomically', async () => {
    await expect(
      orderService.createOrder(user.id, {
        items: [
          { ticketTypeId: type.id, quantity: 6 },
          { ticketTypeId: type.id, quantity: 6 },
        ],
      })
    ).rejects.toThrow('Maximum');
    const tier = await prisma.ticketTier.create({
      data: { ticketTypeId: type.id, name: 'Early', price: 5, quantityLimit: 2 },
    });
    const promo = await prisma.promoCode.create({
      data: {
        organizationId: event.organizationId,
        code: 'LIMITED',
        discountType: 'FIXED_AMOUNT',
        discountValue: 1,
        maxUses: 1,
        validFrom: new Date(Date.now() - 1000),
        validUntil: new Date(Date.now() + 86400000),
      },
    });
    const order = await orderService.createOrder(user.id, {
      items: [{ ticketTypeId: type.id, quantity: 2 }],
      promoCode: promo.code,
    });
    expect(order.totalAmount.toNumber()).toBe(9);
    expect(
      (await prisma.ticketTier.findUniqueOrThrow({ where: { id: tier.id } })).quantityHeld
    ).toBe(2);
    await expect(reserve()).rejects.toThrow('pricing tier');
    await orderService.cancelOrder(order.id);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usesHeld).toBe(
      0
    );
    const next = await orderService.createOrder(user.id, {
      items: [{ ticketTypeId: type.id, quantity: 1 }],
      promoCode: promo.code,
    });
    await orderService.confirmOrder(next.id);
    expect(
      (await prisma.ticketTier.findUniqueOrThrow({ where: { id: tier.id } })).quantitySold
    ).toBe(1);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usesCount).toBe(
      1
    );
  });

  it('rotates credentials on transfer and reissue, hides transferred credentials from the buyer, and permits one entry', async () => {
    const order = await paid(),
      ticket = order.tickets[0];
    const oldQR = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const transferred = await ticketService.transferTicket(ticket.id, user.id, recipient.email);
    expect(transferred).not.toHaveProperty('barcode');
    const replacement = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(replacement.barcode).not.toBe(ticket.barcode);
    expect(
      (await scannerService.scanTicket({ scannerId: scanner.id, qrData: oldQR, scanType: 'ENTRY' }))
        .success
    ).toBe(false);
    const buyerOrder: any = await orderService.getOrderById(order.id, user.id);
    expect(buyerOrder.tickets[0].barcode).toBe('');
    expect(buyerOrder.tickets[0].qrCodeUrl).toBeNull();
    await ticketService.regenerateTicketQRCode(ticket.id, recipient.id);
    const reissued = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const staleQR = generateTicketQRData(ticket.id, replacement.barcode, ticket.eventId);
    expect(
      (
        await scannerService.scanTicket({
          scannerId: scanner.id,
          qrData: staleQR,
          scanType: 'ENTRY',
        })
      ).success
    ).toBe(false);
    await prisma.event.update({
      where: { id: event.id },
      data: {
        startDatetime: new Date(Date.now() - 1000),
        endDatetime: new Date(Date.now() + 3600000),
      },
    });
    const qr = generateTicketQRData(ticket.id, reissued.barcode, ticket.eventId);
    const results = await Promise.allSettled([
      ticketService.checkInTicket(reissued.barcode),
      scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'ENTRY' }),
      scannerService.processOfflineScans(scanner.id, [
        { qrData: qr, scannedAt: new Date().toISOString(), scanType: 'ENTRY' },
      ]),
    ]);
    const successes = results.filter(
      (r) =>
        r.status === 'fulfilled' &&
        ((r.value as any).status === 'USED' ||
          (r.value as any).success === true ||
          (r.value as any).success === 1)
    );
    expect(successes).toHaveLength(1);
    expect(
      await prisma.scanLog.count({
        where: { ticketId: ticket.id, success: true, scanType: 'ENTRY' },
      })
    ).toBeLessThanOrEqual(1);
  });

  it('enforces scanner event scope, active state, and truthful unknown-ticket logs', async () => {
    const order = await paid(),
      ticket = order.tickets[0],
      qr = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const otherEvent = await prisma.event.create({
      data: { organizationId: event.organizationId, name: 'Other', slug: randomUUID() },
    });
    await prisma.scanner.update({ where: { id: scanner.id }, data: { eventId: otherEvent.id } });
    await expect(
      scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'ENTRY' })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Scanner is not assigned to this event',
      data: {
        valid: false,
        reason: 'WRONG_EVENT',
        message: 'This ticket is for Integrity.',
        eventName: 'Integrity',
      },
    });
    expect(
      await prisma.scanLog.findFirst({
        where: {
          scannerId: scanner.id,
          ticketId: ticket.id,
          success: false,
          failureReason: 'WRONG_EVENT',
        },
      })
    ).toBeTruthy();
    await expect(scannerService.syncTickets(scanner.id, event.id)).rejects.toThrow('not assigned');
    await prisma.scanner.update({ where: { id: scanner.id }, data: { eventId: event.id } });
    const invalid = await scannerService.scanTicket({
      scannerId: scanner.id,
      qrData: 'invalid',
      scanType: 'ENTRY',
    });
    expect(invalid.scanLog.ticketId).toBeNull();
    expect(invalid.success).toBe(false);
    await prisma.scanner.update({ where: { id: scanner.id }, data: { status: 'REVOKED' } });
    await expect(scannerService.syncTickets(scanner.id, event.id)).rejects.toThrow('not active');
    await expect(
      scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'ENTRY' })
    ).rejects.toThrow('not active');
  });

  it('preserves paid stock on event cancellation until its processor refund succeeds', async () => {
    const sold = await paid(2),
      pending = await reserve(3);
    await Promise.all([eventService.cancelEvent(event.id), orderService.cancelOrder(pending.id)]);
    expect((await stock()).quantityHeld).toBe(0);
    expect((await stock()).quantitySold).toBe(2);
    await service.refundOrder(sold.id);
    expect((await stock()).quantitySold).toBe(0);
    expect((await stock()).quantityAvailable).toBe(20);
  });

  it('does not expose recipient secrets or replacement credentials in the transfer HTTP response', async () => {
    await prisma.user.update({
      where: { id: recipient.id },
      data: {
        passwordHash: 'synthetic-recipient-password-hash',
        twoFactorSecret: 'synthetic-recipient-two-factor-secret',
      },
    });
    const order = await paid(),
      ticket = order.tickets[0];
    const token = (account: any) =>
      generateAccessToken({
        userId: account.id,
        email: account.email,
        role: account.role,
        sessionVersion: account.sessionVersion,
      });
    const senderToken = token(user),
      recipientToken = token(recipient);
    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/transfer`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientEmail: recipient.email });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ id: ticket.id, userId: recipient.id }));
    for (const field of ['user', 'barcode', 'qrCodeUrl', 'passwordHash', 'twoFactorSecret'])
      expect(res.body.data).not.toHaveProperty(field);
    expect(JSON.stringify(res.body)).not.toContain('synthetic-recipient');
    expect(
      (
        await request(app)
          .get(`/api/v1/tickets/${ticket.id}/qr`)
          .set('Authorization', `Bearer ${senderToken}`)
      ).status
    ).toBe(403);
    const qr = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/qr`)
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(qr.status).toBe(200);
    expect(qr.body.data.qrCode).toMatch(/^data:image/);
    const mine = await request(app)
      .get('/api/v1/tickets/mine')
      .set('Authorization', `Bearer ${senderToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.items || mine.body.data.tickets || []).toHaveLength(0);
  });

  it('finishes local refunds after a crash following the processor success commit', async () => {
    const order = await paid(2);
    const crash = jest
      .spyOn(orderService, 'finalizeRefund')
      .mockRejectedValueOnce(new Error('Crash after processor commit'));
    await expect(service.refundOrder(order.id)).rejects.toThrow('Crash after processor commit');
    expect(
      (await prisma.paymentRefund.findFirstOrThrow({ where: { orderId: order.id } })).status
    ).toBe('SUCCEEDED');
    expect((await stock()).quantitySold).toBe(2);
    crash.mockRestore();
    await service.recoverRefunds();
    expect((await stock()).quantitySold).toBe(2); // No early local finalization.
    await prisma.paymentRefund.updateMany({
      where: { orderId: order.id },
      data: { updatedAt: new Date(Date.now() - 60001) },
    });
    await service.recoverRefunds();
    await service.recoverRefunds();
    expect(fake.refunds.size).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'REFUNDED'
    );
    expect((await stock()).quantitySold).toBe(0);
  });

  it('recovers late charges after failed payments and reservation cancellation without a webhook', async () => {
    const order = await reserve(),
      session = await service.createPaymentIntent(order.id, user.id);
    const intent = fake.intents.get(session.paymentIntentId);
    await service.handleWebhook(
      'synthetic_signature',
      Buffer.from(
        JSON.stringify({
          id: 'evt_failed_' + randomUUID(),
          type: 'payment_intent.payment_failed',
          data: { object: intent },
        })
      )
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      'FAILED'
    );
    await orderService.cancelOrder(order.id);
    intent.status = 'succeeded';
    intent.amount_received = intent.amount;
    await service.recoverPayments();
    const recovered = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(recovered.status).toBe('CANCELLED');
    expect(recovered.paymentClosedAt).toBeNull();
    expect(fake.refunds.size).toBe(0);
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(await prisma.ticket.findMany({ where: { orderId: order.id } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'CANCELLED', inventoryState: 'RELEASED' }),
      ])
    );
    expect(
      await prisma.paymentRefund.findFirstOrThrow({ where: { paymentIntentId: intent.id } })
    ).toMatchObject({
      orderId: order.id,
      amount: intent.amount_received,
      currency: intent.currency,
      reason: 'LATE_PAYMENT',
      status: 'REQUESTED',
      stripeRefundId: null,
      errorMessage: 'Manual reconciliation required: late payment; automatic refund prohibited.',
    });
    expect((await stock()).quantityHeld).toBe(0);
    expect((await stock()).quantitySold).toBe(0);
    expect((await stock()).quantityAvailable).toBe(20);
    fake.stripe.paymentIntents.retrieve.mockClear();
    await service.recoverPayments();
    expect(fake.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(intent.id);
    expect(fake.refunds.size).toBe(0);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentClosedAt
    ).toBeNull();
  });

  it('delivers new free-order receipts without Stripe and avoids replaying historical receipts', async () => {
    await prisma.ticketType.update({ where: { id: type.id }, data: { price: 0 } });
    const legacy = await reserve();
    await prisma.order.update({
      where: { id: legacy.id },
      data: { receiptStatus: 'LEGACY_UNKNOWN' },
    });
    const free = await reserve();
    (service as any).stripe = undefined;
    jest.mocked(notificationService.sendOrderConfirmation).mockResolvedValueOnce(false);
    await service.recoverPayments();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: free.id } })).receiptStatus).toBe(
      'PENDING'
    );
    await service.recoverPayments();
    expect(notificationService.sendOrderConfirmation).toHaveBeenCalledTimes(2);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: free.id } })).receiptStatus).toBe(
      'SENT'
    );
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: legacy.id } })).receiptSentAt
    ).toBeNull();
  });

  it('uses identical hashes for streamed and nonstreamed admission revocations', async () => {
    await paid();
    const pending = await paid();
    fake.setRefundState('pending');
    await service.refundOrder(pending.id);
    await reserve();
    const ordinary = await scannerService.syncTickets(scanner.id, event.id);
    const streamed: any[] = [];
    for await (const batch of scannerService.syncTicketsStream(scanner.id, event.id, undefined, 1))
      streamed.push(...batch);
    const sort = (tickets: any[]) => tickets.sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(streamed)).toEqual(sort(ordinary.tickets));
    for (const ticket of streamed)
      expect(ticket.hash).toBe(
        createHash('sha256')
          .update(`${ticket.id}:${ticket.barcode}:${ticket.status}`)
          .digest('hex')
          .slice(0, 16)
      );
    await eventService.cancelEvent(event.id);
    for await (const batch of scannerService.syncTicketsStream(scanner.id, event.id)) {
      expect(batch.every((t) => t.status === 'CANCELLED' && t.barcode === '')).toBe(true);
    }
  });

  it('claims receipt delivery once across workers and recovers abandoned delivery leases', async () => {
    await prisma.ticketType.update({ where: { id: type.id }, data: { price: 0 } });
    const order = await reserve();
    await Promise.all([service.recoverPayments(), service.recoverPayments()]);
    expect(notificationService.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    const abandoned = await reserve();
    await prisma.order.update({
      where: { id: abandoned.id },
      data: {
        receiptStatus: 'PROCESSING',
        receiptLeaseToken: 'abandoned',
        receiptStartedAt: new Date(Date.now() - 360000),
      },
    });
    await service.recoverPayments();
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: abandoned.id } })).receiptStatus
    ).toBe('SENT');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).receiptStatus).toBe(
      'SENT'
    );
    expect(notificationService.sendOrderConfirmation).toHaveBeenCalledTimes(2);
  });

  it('rejects unreconciled historical tier schedules and invalid offline timestamps before admission', async () => {
    await prisma.ticketType.update({
      where: { id: type.id },
      data: { tierInventoryStatus: 'REQUIRES_RECONCILIATION' },
    });
    await expect(reserve()).rejects.toThrow('requires inventory reconciliation');
    await prisma.ticketType.update({
      where: { id: type.id },
      data: { tierInventoryStatus: 'READY' },
    });
    const order = await paid(),
      ticket = order.tickets[0];
    const qr = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
    const result = await scannerService.processOfflineScans(scanner.id, [
      { qrData: qr, scannedAt: 'invalid', scanType: 'ENTRY' },
    ]);
    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'VALID'
    );
  });

  it('voids tickets once when Stripe Dashboard refunds the full charge', async () => {
    const order = await paid();
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    const refund = {
      id: 're_dashboard',
      amount,
      currency: order.currency,
      payment_intent: paymentIntentId,
      metadata: {},
    };
    await deliverExternal('refund.created', { ...refund, status: 'pending' }, 'evt_pending');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.paymentRefund.findFirst({ where: { orderId: order.id } })).toMatchObject({
      stripeRefundId: 're_dashboard',
      amount,
      status: 'PROCESSING',
    });

    await Promise.all([
      deliverExternal('refund.updated', { ...refund, status: 'succeeded' }, 'evt_updated'),
      deliverExternal('refund.created', { ...refund, status: 'succeeded' }, 'evt_created_dup'),
    ]);
    await deliverExternal(
      'charge.refunded',
      {
        id: 'ch_dashboard',
        amount,
        amount_refunded: amount,
        currency: order.currency,
        refunded: true,
        payment_intent: paymentIntentId,
        refunds: { object: 'list', data: [{ ...refund, status: 'succeeded' }], has_more: false },
      },
      'evt_charge'
    );

    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(fake.stripe.refunds.list).not.toHaveBeenCalled();
    const rows = await prisma.paymentRefund.findMany({ where: { orderId: order.id } });
    expect(rows).toEqual([
      expect.objectContaining({
        reason: 'ORDER_REFUND',
        status: 'SUCCEEDED',
        stripeRefundId: 're_dashboard',
        amount,
        currency: order.currency,
        paymentIntentId,
      }),
    ]);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
    });
    expect(await stock()).toMatchObject({ quantitySold: 0, quantityAvailable: 20 });
    expect(
      await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: 'evt_updated' } })
    ).toMatchObject({ paymentIntentId, status: 'PROCESSED' });
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });
    expect(ticket).toMatchObject({ status: 'CANCELLED', inventoryState: 'RELEASED' });
    const scan = await scannerService.scanTicket({
      scannerId: scanner.id,
      qrData: generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId),
      scanType: 'ENTRY',
    });
    expect(scan.success).toBe(false);
    expect(scan.reason).toMatch(/cancelled/i);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'CANCELLED'
    );
  });

  it('settles charge.refunded from the processor refund list without creating a refund', async () => {
    const order = await paid();
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    fake.refunds.set('re_listed', {
      id: 're_listed',
      amount,
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
    });
    await deliverExternal('charge.refunded', {
      id: 'ch_listed',
      amount,
      amount_refunded: amount,
      currency: order.currency,
      refunded: true,
      payment_intent: paymentIntentId,
      refunds: { object: 'list', data: [], has_more: true },
    });
    await deliverExternal('charge.refunded', {
      id: 'ch_listed',
      amount,
      amount_refunded: amount,
      currency: order.currency,
      refunded: true,
      payment_intent: paymentIntentId,
      refunds: { object: 'list', data: [], has_more: true },
    });
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(fake.stripe.refunds.list).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentRefund.count({ where: { paymentIntentId } })).toBe(1);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
    });
    expect(await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('does not create another Stripe refund for a refund the app already started', async () => {
    const order = await paid();
    await service.refundOrder(order.id);
    expect(fake.stripe.refunds.create).toHaveBeenCalledTimes(1);
    const providerRefund = [...fake.refunds.values()][0];
    await deliverExternal('refund.created', providerRefund, 'evt_app_refund');
    await deliverExternal('refund.updated', providerRefund, 'evt_app_refund_dup');
    expect(fake.stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'REFUNDED'
    );

    const inflight = await paid();
    const amount = orderCents(inflight.totalAmount);
    const paymentIntentId = inflight.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    await prisma.paymentRefund.create({
      data: {
        orderId: inflight.id,
        paymentIntentId,
        amount,
        currency: inflight.currency,
        reason: 'ORDER_REFUND',
        status: 'REQUESTED',
      },
    });
    await deliverExternal('refund.updated', {
      id: 're_external',
      amount,
      currency: inflight.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
      metadata: {},
    });
    expect(fake.stripe.refunds.create).toHaveBeenCalledTimes(1);
    expect(
      await prisma.paymentRefund.findFirstOrThrow({ where: { paymentIntentId } })
    ).toMatchObject({ status: 'SUCCEEDED', stripeRefundId: 're_external', reason: 'ORDER_REFUND' });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: inflight.id } })).toMatchObject({
      status: 'REFUNDED',
      paymentStatus: 'REFUNDED',
    });
    expect(await stock()).toMatchObject({ quantitySold: 0, quantityAvailable: 20 });
  });

  it('leaves a partial or failed dashboard refund paid so the ticket can still scan', async () => {
    const order = await paid();
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    await deliverExternal('refund.failed', {
      id: 're_failed',
      amount,
      currency: order.currency,
      status: 'failed',
      payment_intent: paymentIntentId,
    });
    await deliverExternal('refund.created', {
      id: 're_partial',
      amount: amount - 1,
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
      metadata: {},
    });
    await deliverExternal('charge.refunded', {
      id: 'ch_partial',
      amount,
      amount_refunded: amount - 1,
      currency: order.currency,
      refunded: false,
      payment_intent: paymentIntentId,
    });
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.paymentRefund.findFirst({ where: { orderId: order.id } })).toMatchObject({
      amount: amount - 1,
      status: 'SUCCEEDED',
      stripeRefundId: 're_partial',
    });
    const rows = await prisma.paymentRefundLine.findMany({
      where: { orderId: order.id },
      orderBy: { stripeRefundId: 'asc' },
    });
    expect(rows).toEqual([
      expect.objectContaining({ stripeRefundId: 're_failed', amount, status: 'FAILED' }),
      expect.objectContaining({
        stripeRefundId: 're_partial',
        amount: amount - 1,
        status: 'SUCCEEDED',
      }),
    ]);
    const current = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(current).toMatchObject({ status: 'PAID', refundStatus: 'PARTIALLY_REFUNDED' });
    expect(await stock()).toMatchObject({ quantitySold: 1, quantityAvailable: 19 });
    expect(current.tickets[0]).toMatchObject({ status: 'VALID', inventoryState: 'SOLD' });
    const ticket = current.tickets[0];
    await prisma.event.update({
      where: { id: event.id },
      data: {
        startDatetime: new Date(Date.now() - 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    const admitted = await scannerService.scanTicket({
      scannerId: scanner.id,
      qrData: generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId),
      scanType: 'ENTRY',
    });
    expect(admitted.success).toBe(true);
    expect(admitted.ticket).toMatchObject({ status: 'USED' });
  });

  it('voids tickets when dashboard partial refunds together cover the full charge', async () => {
    const order = await paid();
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    const first = {
      id: 're_part_1',
      amount: Math.floor(amount / 2),
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
    };
    const second = {
      id: 're_part_2',
      amount: amount - first.amount,
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
    };
    fake.refunds.set(first.id, first);
    await deliverExternal('refund.created', first, 'evt_part_1');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PAID',
      refundStatus: 'PARTIALLY_REFUNDED',
    });
    expect(await prisma.paymentRefund.count({ where: { paymentIntentId } })).toBe(1);
    expect(await stock()).toMatchObject({ quantitySold: 1, quantityAvailable: 19 });
    fake.refunds.set(second.id, second);
    await deliverExternal('refund.updated', second, 'evt_part_2');
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(await prisma.paymentRefund.count({ where: { paymentIntentId } })).toBe(1);
    expect(await prisma.paymentRefund.findFirst({ where: { paymentIntentId } })).toMatchObject({
      amount,
      status: 'SUCCEEDED',
    });
    const rows = await prisma.paymentRefundLine.findMany({
      where: { paymentIntentId },
      orderBy: { stripeRefundId: 'asc' },
    });
    expect(rows).toEqual([
      expect.objectContaining({
        stripeRefundId: 're_part_1',
        amount: first.amount,
        status: 'SUCCEEDED',
      }),
      expect.objectContaining({
        stripeRefundId: 're_part_2',
        amount: second.amount,
        status: 'SUCCEEDED',
      }),
    ]);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(amount);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
    });
    expect(await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({
      status: 'CANCELLED',
      inventoryState: 'RELEASED',
    });
    expect(await stock()).toMatchObject({ quantitySold: 0, quantityAvailable: 20 });
  });

  it('stores a 1000 then 1000 refund as two rows, including replay and out-of-order delivery', async () => {
    const order = await paid(2);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    expect(orderCents(order.totalAmount)).toBe(2000);
    const first = {
      id: 're_3UUmp4IxFK3TfP5Q1W0ln7qn',
      amount: 1000,
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
    };
    const second = {
      id: 're_3UUmp4IxFK3TfP5Q1EWNPmKH',
      amount: 1000,
      currency: order.currency,
      status: 'succeeded',
      payment_intent: paymentIntentId,
    };
    fake.refunds.set(second.id, second);
    await deliverExternal('refund.updated', second, 'evt_second_first');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PAID',
      refundStatus: 'PARTIALLY_REFUNDED',
    });
    expect(await prisma.paymentRefund.findMany({ where: { paymentIntentId } })).toEqual([
      expect.objectContaining({ stripeRefundId: second.id, amount: 1000, status: 'SUCCEEDED' }),
    ]);
    expect(await stock()).toMatchObject({ quantitySold: 2, quantityAvailable: 18 });
    fake.refunds.set(first.id, first);
    await deliverExternal('refund.created', first, 'evt_first_later');
    await deliverExternal('refund.created', first, 'evt_first_later');
    await deliverExternal(
      'charge.refunded',
      {
        id: 'ch_two_part',
        amount: 2000,
        amount_refunded: 2000,
        currency: order.currency,
        refunded: true,
        payment_intent: paymentIntentId,
        refunds: { object: 'list', data: [second, first], has_more: false },
      },
      'evt_charge_two'
    );
    await deliverExternal(
      'charge.refunded',
      {
        id: 'ch_two_part',
        amount: 2000,
        amount_refunded: 2000,
        currency: order.currency,
        refunded: true,
        payment_intent: paymentIntentId,
        refunds: { object: 'list', data: [second, first], has_more: false },
      },
      'evt_charge_two'
    );
    expect(await prisma.paymentRefund.count({ where: { paymentIntentId } })).toBe(1);
    expect(await prisma.paymentRefund.findFirst({ where: { paymentIntentId } })).toMatchObject({
      amount: 2000,
      status: 'SUCCEEDED',
    });
    const rows = await prisma.paymentRefundLine.findMany({
      where: { paymentIntentId },
      orderBy: { stripeRefundId: 'asc' },
    });
    expect(rows.map((row) => [row.stripeRefundId, row.amount])).toEqual([
      [second.id, 1000],
      [first.id, 1000],
    ]);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(2000);
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
    });
    expect(await stock()).toMatchObject({ quantitySold: 0, quantityAvailable: 20 });
  });

  it('does not restock a scanned ticket when the refund or the event cancellation completes', async () => {
    const order = await paid(2);
    const tickets = [...order.tickets].sort((a, b) => a.id.localeCompare(b.id));
    const scannedAt = new Date('2026-10-26T10:28:26.000Z');
    await prisma.ticket.update({
      where: { id: tickets[0].id },
      data: { status: 'USED', checkedInAt: scannedAt, checkedInBy: scanner.id },
    });
    const before = await stock();
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    await deliverExternal('charge.refunded', {
      id: 'ch_attended',
      amount,
      amount_refunded: amount,
      currency: order.currency,
      refunded: true,
      payment_intent: paymentIntentId,
      refunds: {
        object: 'list',
        has_more: false,
        data: [
          {
            id: 're_attended_full',
            amount,
            currency: order.currency,
            status: 'succeeded',
            payment_intent: paymentIntentId,
          },
        ],
      },
    });
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } })).toMatchObject({
      status: 'CANCELLED',
      inventoryState: 'SOLD',
      checkedInAt: scannedAt,
    });
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[1].id } })).toMatchObject({
      status: 'CANCELLED',
      inventoryState: 'RELEASED',
    });
    const after = await stock();
    expect(after.quantitySold).toBe(before.quantitySold - 1);
    expect(after.quantityAvailable).toBe(before.quantityAvailable + 1);

    const cancelled = await paid();
    const attended = cancelled.tickets[0];
    await prisma.ticket.update({
      where: { id: attended.id },
      data: { status: 'USED', checkedInAt: scannedAt, checkedInBy: scanner.id },
    });
    const held = await stock();
    await eventService.cancelEvent(event.id);
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: attended.id } })).toMatchObject({
      status: 'CANCELLED',
      inventoryState: 'SOLD',
      checkedInAt: scannedAt,
    });
    expect(await stock()).toMatchObject({
      quantitySold: held.quantitySold,
      quantityAvailable: held.quantityAvailable,
    });
    const cancelledAmount = orderCents(cancelled.totalAmount);
    const cancelledIntent = cancelled.paymentIntentId;
    if (!cancelledIntent) throw new Error('paid order has no payment intent');
    await deliverExternal('charge.refunded', {
      id: 'ch_event_cancel_attended',
      amount: cancelledAmount,
      amount_refunded: cancelledAmount,
      currency: cancelled.currency,
      refunded: true,
      payment_intent: cancelledIntent,
      refunds: {
        object: 'list',
        has_more: false,
        data: [
          {
            id: 're_event_cancel_attended',
            amount: cancelledAmount,
            currency: cancelled.currency,
            status: 'succeeded',
            payment_intent: cancelledIntent,
          },
        ],
      },
    });
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: attended.id } })).toMatchObject({
      status: 'CANCELLED',
      inventoryState: 'SOLD',
    });
    expect(await stock()).toMatchObject({
      quantitySold: held.quantitySold,
      quantityAvailable: held.quantityAvailable,
    });
  });

  async function storeHistoricalUsd(order: { id: string; paymentIntentId: string | null }) {
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    const intent = fake.intents.get(paymentIntentId);
    intent.currency = 'cad';
    await prisma.order.update({ where: { id: order.id }, data: { currency: 'usd' } });
    await prisma.paymentAttempt.update({
      where: { orderId: order.id },
      data: { currency: 'usd' },
    });
    return intent;
  }

  it('refunds a usd-stored order from the cad PaymentIntent and receipts that charge currency', async () => {
    const order = await paid();
    const intent = await storeHistoricalUsd(order);
    const result = await service.refundOrder(order.id);
    expect(result).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
      currency: 'usd',
    });
    expect(fake.stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: order.paymentIntentId,
        amount: intent.amount_received,
      }),
      expect.any(Object)
    );
    expect(fake.stripe.refunds.create.mock.calls[0][0].currency).toBeUndefined();
    expect(
      await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: intent.id } })
    ).toMatchObject({ currency: 'cad', status: 'SUCCEEDED', reason: 'ORDER_REFUND' });
    expect(await prisma.paymentRefundLine.findMany({ where: { orderId: order.id } })).toEqual([
      expect.objectContaining({ currency: 'cad', status: 'SUCCEEDED', reason: 'ORDER_REFUND' }),
    ]);
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { orderId: order.id } })
    ).toMatchObject({
      currency: 'usd',
    });
    (notificationService.sendOrderConfirmation as jest.Mock).mockClear();
    await orderService.sendOrderConfirmationEmail(order.id, true);
    expect(notificationService.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: formatMoney(order.totalAmount, 'cad'),
        organizationName: 'Integrity',
      })
    );
    expect(formatMoney(order.totalAmount, 'cad')).not.toBe(formatMoney(order.totalAmount, 'usd'));
  });

  it('still refuses the refund when the cad PaymentIntent amount does not match', async () => {
    const order = await paid();
    const intent = await storeHistoricalUsd(order);
    intent.amount_received -= 1;
    await expect(service.refundOrder(order.id)).rejects.toThrow(
      'Processor payment needs reconciliation'
    );
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('settles charge.refunded in cad when the order row says usd', async () => {
    const order = await paid();
    await storeHistoricalUsd(order);
    const amount = orderCents(order.totalAmount);
    const paymentIntentId = order.paymentIntentId;
    if (!paymentIntentId) throw new Error('paid order has no payment intent');
    const refund = {
      id: 're_cad_dashboard',
      amount,
      currency: 'cad',
      status: 'succeeded',
      payment_intent: paymentIntentId,
      metadata: {},
    };
    await deliverExternal('charge.refunded', {
      id: 'ch_cad_dashboard',
      amount,
      amount_refunded: amount,
      currency: 'cad',
      refunded: true,
      payment_intent: paymentIntentId,
      refunds: { object: 'list', data: [refund], has_more: false },
    });
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'SUCCEEDED',
      paymentStatus: 'REFUNDED',
      currency: 'usd',
    });
    expect(
      await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId } })
    ).toMatchObject({
      currency: 'cad',
      status: 'SUCCEEDED',
      stripeRefundId: 're_cad_dashboard',
      amount,
    });
    expect(await prisma.paymentRefundLine.findMany({ where: { paymentIntentId } })).toEqual([
      expect.objectContaining({
        stripeRefundId: 're_cad_dashboard',
        currency: 'cad',
        amount,
        status: 'SUCCEEDED',
      }),
    ]);
    const ticket = await prisma.ticket.findFirstOrThrow({ where: { orderId: order.id } });
    expect(ticket).toMatchObject({ status: 'CANCELLED', inventoryState: 'RELEASED' });
  });

  it('does not refund a settled cad charge only because the order row says usd', async () => {
    const order = await paid();
    const intent = await storeHistoricalUsd(order);
    await deliver(intent, 'evt_replay_usd_label');
    expect(fake.stripe.refunds.create).not.toHaveBeenCalled();
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PAID',
      currency: 'usd',
      refundStatus: 'NONE',
    });
  });
});
