process.env.STRIPE_SECRET_KEY = 'sk_test_dispute_void';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dispute_void';

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn((payload: Buffer) => JSON.parse(payload.toString())),
    },
    charges: { retrieve: jest.fn() },
    paymentIntents: { retrieve: jest.fn(), create: jest.fn(), search: jest.fn() },
    refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
  }))
);

jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendWelcomeEmail: jest.fn(),
    sendEmail: jest.fn(),
    sendOrderConfirmation: jest.fn(),
    sendTicketTransfer: jest.fn(),
    sendAdminAlert: jest.fn(),
  },
}));

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { logger } from '../../src/config/logger';
import { paymentService } from '../../src/api/payments/service';
import { orderService } from '../../src/api/orders/service';
import { notificationService } from '../../src/utils/notificationService';
import { generateAccessToken } from '../../src/utils/jwt';
import { DISPUTE_SCAN_REASON, VOID_DISPUTED_CODE } from '../../src/services/ticket-void.service';

jest.setTimeout(30000);

const stripe = (paymentService as unknown as { stripe: { charges: { retrieve: jest.Mock } } })
  .stripe;

function token(user: { id: string; email: string; role: string; organizationId: string | null }) {
  return generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    sessionVersion: 0,
  });
}

async function deliver(type: string, object: object, id: string) {
  const event = { id, type, data: { object } };
  await paymentService.handleWebhook('sig', Buffer.from(JSON.stringify(event)));
  return event;
}

describe('dispute webhooks and staff void', () => {
  const key = `dispute-${randomUUID()}`;
  let organizationId = '';
  let eventId = '';
  let typeId = '';
  let scannerKey = '';
  let owner: { id: string; email: string; role: string; organizationId: string | null };
  let manager: { id: string; email: string; role: string; organizationId: string | null };
  let buyerId = '';
  const userIds: string[] = [];
  const orderIds: string[] = [];
  const extraTypeIds: string[] = [];

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;
    const makeUser = async (
      role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER' | 'CUSTOMER',
      organizationForUser: string | null,
      platform = false,
      label = role.toLowerCase()
    ) => {
      const user = await prisma.user.create({
        data: {
          email: `${label}-${key}@test.invalid`,
          passwordHash: 'test-only',
          firstName: role,
          lastName: 'Dispute',
          role,
          organizationId: organizationForUser,
          isPlatformAdmin: platform,
        },
      });
      userIds.push(user.id);
      return user;
    };
    const ownerRow = await makeUser('OWNER', organizationId);
    owner = {
      id: ownerRow.id,
      email: ownerRow.email,
      role: ownerRow.role,
      organizationId: ownerRow.organizationId,
    };
    const managerRow = await makeUser('MANAGER', organizationId);
    manager = {
      id: managerRow.id,
      email: managerRow.email,
      role: managerRow.role,
      organizationId: managerRow.organizationId,
    };
    await makeUser('PROMOTER', organizationId);
    await makeUser('CUSTOMER', null);
    buyerId = (await makeUser('CUSTOMER', null, false, 'buyer')).id;
    const event = await prisma.event.create({
      data: {
        organizationId,
        name: key,
        slug: key,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86_400_000),
      },
    });
    eventId = event.id;
    const type = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'Admission',
        price: 20,
        quantityTotal: 10,
        quantityAvailable: 8,
        quantitySold: 2,
      },
    });
    typeId = type.id;
    scannerKey = `sk_scanner_${key}`;
    await prisma.scanner.create({
      data: {
        name: 'Gate',
        apiKey: scannerKey,
        organizationId,
        eventId,
        createdBy: owner.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { eventId } });
    await prisma.ticketInventoryReconciliation.deleteMany({
      where: {
        OR: [
          { planFingerprint: { contains: key } },
          { evidence: { contains: key } },
          { ticketTypeId: typeId },
          { actorId: owner?.id || 'missing-owner' },
        ],
      },
    });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.paymentWebhookEvent.deleteMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { id: { contains: key } },
          { paymentIntentId: { contains: key } },
        ],
      },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.scanner.deleteMany({ where: { eventId } });
    await prisma.ticketType.deleteMany({ where: { id: { in: [typeId, ...extraTypeIds] } } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  });

  async function paidOrder(label: string) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${key}-${label}`,
        userId: buyerId,
        eventId,
        totalAmount: 40,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        paymentIntentId: `pi_${key}_${label}`,
        tickets: {
          create: [0, 1].map((index) => ({
            eventId,
            userId: buyerId,
            ticketTypeId: typeId,
            barcode: `${key}-${label}-${index}`,
            pricePaid: 20,
            status: 'VALID',
            inventoryState: 'SOLD',
          })),
        },
      },
      include: { tickets: { orderBy: { barcode: 'asc' } } },
    });
    orderIds.push(order.id);
    return order;
  }

  async function scan(ticket: { id: string; barcode: string }) {
    return request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', `Bearer ${scannerKey}`)
      .send({ qrData: `TICKET:${ticket.id}:${ticket.barcode}:${eventId}`, scanType: 'ENTRY' });
  }

  it('voids tickets on dispute.created, denies the scan, and ignores a replay', async () => {
    const order = await paidOrder('created');
    const disputeId = `dp_${key}_created`;
    const eventIdStripe = `evt_${key}_created`;
    await deliver(
      'charge.dispute.created',
      { id: disputeId, status: 'needs_response', payment_intent: order.paymentIntentId },
      eventIdStripe
    );
    await deliver(
      'charge.dispute.created',
      { id: disputeId, status: 'needs_response', payment_intent: order.paymentIntentId },
      eventIdStripe
    );

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    const stock = await prisma.ticketType.findUniqueOrThrow({ where: { id: typeId } });
    expect(saved.status).toBe('PAID');
    expect(saved.paymentStatus).toBe('SUCCEEDED');
    expect(saved.refundStatus).toBe('DISPUTED');
    expect(saved.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
    expect(saved.tickets.every((ticket) => ticket.inventoryState === 'SOLD')).toBe(true);
    expect(stock).toMatchObject({ quantitySold: 2, quantityAvailable: 8, quantityHeld: 0 });
    const audits = await prisma.ticketInventoryReconciliation.findMany({
      where: { planFingerprint: { contains: disputeId } },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: 'stripe-dispute',
      evidence: `Payment disputed (${disputeId})`,
    });
    expect(audits[0].before).toMatchObject({ inventoryReleased: false });

    const denied = await scan(saved.tickets[0]);
    expect(denied.status).toBe(200);
    expect(denied.body.data).toMatchObject({
      success: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
    expect(denied.body.data.reason).not.toBe('Ticket credential must be reissued');
    expect(
      (await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventIdStripe } })).status
    ).toBe('PROCESSED');
  });

  it('records dispute.closed without restoring tickets', async () => {
    const order = await paidOrder('closed');
    const disputeId = `dp_${key}_closed`;
    await deliver(
      'charge.dispute.created',
      { id: disputeId, status: 'needs_response', payment_intent: order.paymentIntentId },
      `evt_${key}_closed_open`
    );
    await deliver(
      'charge.dispute.closed',
      { id: disputeId, status: 'won', payment_intent: order.paymentIntentId },
      `evt_${key}_closed`
    );
    await deliver(
      'charge.dispute.closed',
      { id: disputeId, status: 'won', payment_intent: order.paymentIntentId },
      `evt_${key}_closed`
    );

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(saved.refundStatus).toBe('DISPUTE_WON');
    expect(saved.status).toBe('PAID');
    expect(saved.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
    const closedAudit = await prisma.ticketInventoryReconciliation.findFirstOrThrow({
      where: { evidence: `Dispute ${disputeId} closed: won` },
    });
    expect(closedAudit.actorId).toBe('stripe-dispute');
    expect(closedAudit.after).toMatchObject({ inventoryReleased: false });
    const denied = await scan(saved.tickets[0]);
    expect(denied.body.data).toMatchObject({
      success: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
    expect(denied.body.data.reason).not.toBe('Ticket credential must be reissued');
    expect(
      await prisma.ticketInventoryReconciliation.count({
        where: { evidence: `Dispute ${disputeId} closed: won` },
      })
    ).toBe(1);
  });

  it('accepts a closed dispute before created and still voids without clearing the outcome', async () => {
    const order = await paidOrder('reorder');
    const disputeId = `dp_${key}_reorder`;
    await deliver(
      'charge.dispute.closed',
      { id: disputeId, status: 'lost', payment_intent: order.paymentIntentId },
      `evt_${key}_reorder_closed`
    );
    let saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(saved.refundStatus).toBe('DISPUTE_LOST');
    expect(saved.tickets.every((ticket) => ticket.status === 'VALID')).toBe(true);
    const early = await scan(saved.tickets[0]);
    expect(early.body.data).toMatchObject({
      success: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
    expect(early.body.data.reason).not.toBe('Ticket credential must be reissued');
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: saved.tickets[0].id } })).status
    ).toBe('VALID');

    await deliver(
      'charge.dispute.created',
      { id: disputeId, status: 'lost', payment_intent: order.paymentIntentId },
      `evt_${key}_reorder_created`
    );
    saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(saved.refundStatus).toBe('DISPUTE_LOST');
    expect(saved.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
    expect(saved.tickets.every((ticket) => ticket.inventoryState === 'SOLD')).toBe(true);
  });

  it('resolves a charge-only dispute and returns 200 for an unknown payment intent', async () => {
    const order = await paidOrder('charge');
    stripe.charges.retrieve.mockResolvedValueOnce({ payment_intent: order.paymentIntentId });
    await deliver(
      'charge.dispute.created',
      { id: `dp_${key}_charge`, status: 'needs_response', charge: `ch_${key}` },
      `evt_${key}_charge`
    );
    expect(stripe.charges.retrieve).toHaveBeenCalledWith(`ch_${key}`);
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(saved.refundStatus).toBe('DISPUTED');
    expect(saved.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);

    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const missing = {
      id: `evt_${key}_missing`,
      type: 'charge.dispute.created',
      data: {
        object: {
          id: `dp_${key}_missing`,
          status: 'needs_response',
          payment_intent: `pi_${key}_missing`,
        },
      },
    };
    const response = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'sig')
      .send(JSON.stringify(missing));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`pi_${key}_missing`));
    expect(
      (await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: missing.id } })).status
    ).toBe('PROCESSED');
    warn.mockRestore();
  });

  it('rejects a disputed ticket on scan, validate, check-in, and offline upload', async () => {
    const order = await paidOrder('gate');
    const ticket = order.tickets[0];
    await deliver(
      'charge.dispute.created',
      { id: `dp_${key}_gate`, status: 'needs_response', payment_intent: order.paymentIntentId },
      `evt_${key}_gate`
    );
    const qrData = `TICKET:${ticket.id}:${ticket.barcode}:${eventId}`;
    const live = await scan(ticket);
    const validation = await request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', `Bearer ${scannerKey}`)
      .send({ qrData, scanType: 'VALIDATION' });
    const checked = await request(app)
      .post('/api/v1/tickets/validate')
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ barcode: ticket.barcode });
    const checkIn = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ barcode: ticket.barcode });
    const offline = await request(app)
      .post('/api/v1/scanners/validate')
      .set('Authorization', `Bearer ${scannerKey}`)
      .send({ scans: [{ qrData, scannedAt: new Date().toISOString(), scanType: 'ENTRY' }] });

    for (const body of [live.body.data, validation.body.data]) {
      expect(body).toMatchObject({
        success: false,
        reason: DISPUTE_SCAN_REASON,
        reasonCode: VOID_DISPUTED_CODE,
      });
      expect(body.reason).not.toBe('Ticket credential must be reissued');
    }
    expect(checked.status).toBe(200);
    expect(checked.body.data).toMatchObject({
      valid: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
    expect(checkIn.status).toBe(400);
    expect(checkIn.body.message).toBe(DISPUTE_SCAN_REASON);
    expect(checkIn.body.errors).toMatchObject({ reasonCode: VOID_DISPUTED_CODE });
    expect(offline.status).toBe(200);
    expect(offline.body.data.success).toBe(0);
    expect(offline.body.data.results[0]).toMatchObject({
      success: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'CANCELLED'
    );
  });

  it('lets a manager void, rejects a promoter, and keeps refunds on owner and admin', async () => {
    const order = await paidOrder('roles');
    const promoter = await prisma.user.findFirstOrThrow({
      where: { email: `promoter-${key}@test.invalid` },
    });
    const promoterVoid = await request(app)
      .post(`/api/v1/orders/${order.id}/void`)
      .set(
        'Authorization',
        `Bearer ${token({
          id: promoter.id,
          email: promoter.email,
          role: promoter.role,
          organizationId: promoter.organizationId,
        })}`
      )
      .send({ reason: 'promoter should not void' });
    expect(promoterVoid.status).toBe(403);
    const managerRefund = await request(app)
      .post(`/api/v1/orders/${order.id}/refund`)
      .set('Authorization', `Bearer ${token(manager)}`)
      .send({});
    expect(managerRefund.status).toBe(403);

    const before = Date.now();
    const voided = await request(app)
      .post(`/api/v1/orders/${order.id}/void`)
      .set('Authorization', `Bearer ${token(manager)}`)
      .send({ reason: 'manager gate hold' });
    expect(voided.status).toBe(200);
    expect(
      voided.body.data.tickets.every((ticket: { status: string }) => ticket.status === 'CANCELLED')
    ).toBe(true);
    const audit = await prisma.ticketInventoryReconciliation.findFirstOrThrow({
      where: { actorId: manager.id, evidence: 'manager gate hold' },
    });
    expect(audit.actorId).toBe(manager.id);
    expect(audit.evidence).toBe('manager gate hold');
    expect(audit.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(audit.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const denied = await scan(order.tickets[0]);
    expect(denied.body.data).toMatchObject({ success: false, reason: 'Ticket has been cancelled' });
    expect(denied.body.data.reason).not.toBe('Ticket credential must be reissued');
    expect(denied.body.data.success).toBe(false);
  });

  it('writes an audit row for an owner void and scan denies that ticket', async () => {
    const order = await paidOrder('staff');
    const [first, second] = order.tickets;
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [`promoter-${key}@test.invalid`, `customer-${key}@test.invalid`],
        },
      },
    });
    for (const user of users) {
      const response = await request(app)
        .post(`/api/v1/orders/${order.id}/void`)
        .set(
          'Authorization',
          `Bearer ${token({
            id: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
          })}`
        )
        .send({ reason: 'gate error', ticketId: first.id });
      expect(response.status).toBe(403);
    }
    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${order.id}/void`)
          .set('Authorization', `Bearer ${token(owner)}`)
          .send({ reason: '   ' })
      ).status
    ).toBe(400);

    const voided = await request(app)
      .post(`/api/v1/orders/${order.id}/void`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ reason: 'duplicate wristband', ticketId: first.id });
    expect(voided.status).toBe(200);
    expect(
      voided.body.data.tickets.find((ticket: { id: string }) => ticket.id === first.id).status
    ).toBe('CANCELLED');
    expect(
      voided.body.data.tickets.find((ticket: { id: string }) => ticket.id === second.id).status
    ).toBe('VALID');
    expect(voided.body.data.status).toBe('PAID');
    const audit = await prisma.ticketInventoryReconciliation.findFirstOrThrow({
      where: { evidence: 'duplicate wristband', actorId: owner.id },
    });
    expect(audit.planFingerprint.startsWith('ticket-void:STAFF_VOID:')).toBe(true);
    expect(audit.before).toMatchObject({ inventoryReleased: false });

    const denied = await scan(first);
    expect(denied.status).toBe(200);
    expect(denied.body.data).toMatchObject({
      success: false,
      reason: 'Ticket has been cancelled',
    });
    expect(denied.body.data.reason).not.toBe('Ticket credential must be reissued');
    expect(audit.createdAt).toBeInstanceOf(Date);
    const admitted = await scan(second);
    expect(admitted.body.data.success).toBe(true);

    const rest = await request(app)
      .post(`/api/v1/orders/${order.id}/void`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ reason: 'clear the rest of the order' });
    expect(rest.status).toBe(200);
    const finalTickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
    expect(finalTickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
    expect(finalTickets.every((ticket) => ticket.inventoryState === 'SOLD')).toBe(true);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: typeId } })).quantitySold
    ).toBe(2);
    expect(
      await prisma.ticketInventoryReconciliation.count({
        where: {
          actorId: owner.id,
          evidence: { in: ['duplicate wristband', 'clear the rest of the order'] },
        },
      })
    ).toBe(2);
  });

  it('S-BUG-8 cancels tickets when dispute.created arrives before payment succeeds', async () => {
    (notificationService.sendOrderConfirmation as jest.Mock).mockResolvedValue(true);
    const localType = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'Disputed hold',
        price: 20,
        quantityTotal: 4,
        quantityAvailable: 2,
        quantityHeld: 2,
        quantitySold: 0,
      },
    });
    extraTypeIds.push(localType.id);
    const label = 'early-dispute';
    const order = await prisma.order.create({
      data: {
        orderNumber: `${key}-${label}`,
        userId: buyerId,
        eventId,
        totalAmount: 40,
        currency: 'cad',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentIntentId: `pi_${key}_${label}`,
        expiresAt: new Date(Date.now() + 600_000),
        tickets: {
          create: [0, 1].map((index) => ({
            eventId,
            userId: buyerId,
            ticketTypeId: localType.id,
            barcode: `${key}-${label}-${index}`,
            pricePaid: 20,
            status: 'VALID',
            inventoryState: 'HELD',
          })),
        },
      },
      include: { tickets: true },
    });
    orderIds.push(order.id);
    const disputeId = `dp_${key}_early`;
    await deliver(
      'charge.dispute.created',
      { id: disputeId, status: 'needs_response', payment_intent: order.paymentIntentId },
      `evt_${key}_early_dispute`
    );
    const held = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    expect(held.status).toBe('PENDING');
    expect(held.refundStatus).toBe('DISPUTED');
    expect(held.tickets.every((ticket) => ticket.status === 'VALID')).toBe(true);

    await deliver(
      'payment_intent.succeeded',
      {
        id: order.paymentIntentId,
        status: 'succeeded',
        amount: 4000,
        amount_received: 4000,
        currency: 'cad',
        metadata: { orderId: order.id },
      },
      `evt_${key}_early_paid`
    );
    await orderService.confirmOrder(order.id);

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tickets: true },
    });
    const stock = await prisma.ticketType.findUniqueOrThrow({ where: { id: localType.id } });
    expect(saved.status).toBe('PAID');
    expect(saved.paymentStatus).toBe('SUCCEEDED');
    expect(saved.refundStatus).toBe('DISPUTED');
    expect(saved.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
    expect(saved.tickets.every((ticket) => ticket.inventoryState === 'SOLD')).toBe(true);
    expect(stock).toMatchObject({ quantitySold: 2, quantityAvailable: 2, quantityHeld: 0 });
    const audits = await prisma.ticketInventoryReconciliation.findMany({
      where: { planFingerprint: { contains: disputeId } },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].before).toMatchObject({ inventoryReleased: false });
    expect(audits[0].after).toMatchObject({ inventoryReleased: false });
    const denied = await scan(saved.tickets[0]);
    expect(denied.body.data).toMatchObject({
      success: false,
      reason: DISPUTE_SCAN_REASON,
      reasonCode: VOID_DISPUTED_CODE,
    });
  });
});
