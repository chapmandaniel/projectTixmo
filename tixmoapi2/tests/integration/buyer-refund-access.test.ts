// Buyer self-service refunds are closed. OWNER/ADMIN keep request-refund and the staff refund route.
const isPlaceholderCredential = (value?: string) => {
  const lowerValue = value?.trim().toLowerCase() || '';
  return (
    !lowerValue ||
    lowerValue.includes('your_') ||
    lowerValue.includes('_your') ||
    lowerValue.includes('change-this') ||
    lowerValue.includes('placeholder')
  );
};

if (isPlaceholderCredential(process.env.STRIPE_SECRET_KEY)) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_buyer_refund_access';
}
if (isPlaceholderCredential(process.env.STRIPE_WEBHOOK_SECRET)) {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_buyer_refund_access';
}

jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
    sendOrderConfirmation: jest.fn().mockResolvedValue(true),
    sendTicketTransfer: jest.fn().mockResolvedValue(true),
    sendAdminAlert: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: { retrieve: jest.fn() },
    refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  }))
);

import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { paymentService } from '../../src/api/payments/service';
import { registerUser } from '../utils/testUtils';

const provider = (paymentService as any).stripe;
const allowedIntents = new Set<string>();

async function paidOrder(userId: string, organizationId: string) {
  const key = `buyer-refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 25,
      quantityTotal: 10,
      quantityAvailable: 9,
      quantitySold: 1,
    },
  });
  return prisma.order.create({
    data: {
      orderNumber: key,
      userId,
      eventId: event.id,
      totalAmount: 25,
      currency: 'cad',
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      paymentIntentId: `pi_${key}`,
      tickets: {
        create: [
          {
            eventId: event.id,
            userId,
            ticketTypeId: type.id,
            barcode: `${key}-0`,
            pricePaid: 25,
            status: 'VALID',
            inventoryState: 'SOLD',
          },
        ],
      },
    },
    include: { tickets: true },
  });
}

function armProvider(paymentIntentId: string) {
  allowedIntents.add(paymentIntentId);
  provider.paymentIntents.retrieve.mockImplementation((id: string) =>
    allowedIntents.has(id)
      ? { id, status: 'succeeded', amount: 2500, amount_received: 2500, currency: 'cad' }
      : { id, status: 'canceled', amount: 0, amount_received: 0, currency: 'cad' }
  );
  provider.refunds.list.mockResolvedValue({ data: [] });
  provider.refunds.create.mockImplementation((params: any) => ({
    id: `re_${params.metadata.refundId}`,
    status: 'pending',
    amount: params.amount,
    currency: 'cad',
    payment_intent: params.payment_intent,
    metadata: params.metadata,
    failure_reason: null,
  }));
  provider.refunds.retrieve.mockImplementation(async (id: string) => {
    const row = await prisma.paymentRefund.findFirst({ where: { stripeRefundId: id } });
    if (!row || !allowedIntents.has(row.paymentIntentId)) {
      return {
        id,
        status: 'pending',
        amount: 1,
        currency: 'usd',
        payment_intent: 'pi_unrelated',
        metadata: {},
        failure_reason: null,
      };
    }
    return {
      id,
      status: 'succeeded',
      amount: row.amount,
      currency: row.currency,
      payment_intent: row.paymentIntentId,
      metadata: { refundId: row.id, orderId: row.orderId },
      failure_reason: null,
    };
  });
}

async function settleThroughWebhook(orderId: string) {
  await prisma.paymentRefund.updateMany({
    where: { orderId },
    data: { updatedAt: new Date(Date.now() - 60_001) },
  });
  const eventId = `evt_${orderId}`;
  provider.webhooks.constructEvent.mockReturnValue({
    id: eventId,
    type: 'refund.updated',
    data: { object: { id: `re_${eventId}` } },
  });
  const webhook = await request(app)
    .post('/api/v1/payments/webhook')
    .set('stripe-signature', 'test-signature')
    .send({ id: eventId, type: 'refund.updated' });
  expect(webhook.status).toBe(200);
  expect(webhook.body.received).toBe(true);

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { tickets: true },
  });
  expect(order.status).toBe('REFUNDED');
  expect(order.refundStatus).toBe('SUCCEEDED');
  expect(order.tickets.every((ticket) => ticket.status === 'CANCELLED')).toBe(true);
  expect(order.tickets.every((ticket) => ticket.inventoryState === 'RELEASED')).toBe(true);
  const refund = await prisma.paymentRefund.findFirstOrThrow({ where: { orderId } });
  expect(refund).toMatchObject({
    status: 'SUCCEEDED',
    amount: 2500,
    currency: 'cad',
    reason: 'ORDER_REFUND',
  });
  expect(provider.refunds.create).toHaveBeenCalledWith(
    expect.objectContaining({ payment_intent: order.paymentIntentId, amount: 2500 }),
    expect.objectContaining({ idempotencyKey: `refund-${refund.id}` })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('buyer refund access', () => {
  let organizationId: string;

  beforeAll(async () => {
    const key = `buyer-refund-org-${Date.now()}`;
    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER', status: 'ACTIVE' },
    });
    organizationId = organization.id;
  });

  test('a buyer is rejected on request-refund before any processor refund', async () => {
    const buyer = await registerUser(app, {
      email: `buyer-refund-customer-${Date.now()}@example.com`,
      password: 'Test123!',
    });
    const order = await paidOrder(buyer.user.id, organizationId);
    armProvider(order.paymentIntentId!);

    const response = await request(app)
      .post(`/api/v1/orders/${order.id}/request-refund`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      message: 'All sales are final. Refunds are issued by Tixmo staff.',
      errors: { code: 'BUYER_REFUNDS_DISABLED' },
    });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: 'PAID',
      refundStatus: 'NONE',
    });
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
    expect(provider.refunds.create).not.toHaveBeenCalled();
    expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();

    const staffRoute = await request(app)
      .post(`/api/v1/orders/${order.id}/refund`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(staffRoute.status).toBe(403);
    expect(staffRoute.body.message).toBe('Insufficient permissions');
    expect(provider.refunds.create).not.toHaveBeenCalled();
  });

  test.each(['MANAGER', 'PROMOTER', 'CUSTOMER'] as const)(
    '%s cannot use request-refund',
    async (role) => {
      const user = await registerUser(app, {
        email: `buyer-refund-${role.toLowerCase()}-${Date.now()}@example.com`,
        password: 'Test123!',
        role,
      });
      const response = await request(app)
        .post('/api/v1/orders/00000000-0000-0000-0000-000000000000/request-refund')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(response.status).toBe(403);
      expect(response.body.errors).toMatchObject({ code: 'BUYER_REFUNDS_DISABLED' });
      expect(provider.refunds.create).not.toHaveBeenCalled();
    }
  );

  test.each(['OWNER', 'ADMIN'] as const)(
    '%s can still request-refund an order they own, including Stripe and webhook settlement',
    async (role) => {
      const staff = await registerUser(app, {
        email: `buyer-refund-${role.toLowerCase()}-self-${Date.now()}@example.com`,
        password: 'Test123!',
        role,
      });
      if (role === 'OWNER') {
        await prisma.user.update({
          where: { id: staff.user.id },
          data: { organizationId, isPlatformAdmin: false },
        });
      }
      const order = await paidOrder(staff.user.id, organizationId);
      armProvider(order.paymentIntentId!);

      const response = await request(app)
        .post(`/api/v1/orders/${order.id}/request-refund`)
        .set('Authorization', `Bearer ${staff.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
      expect(response.body.message).toBe('Refund processing');
      await settleThroughWebhook(order.id);
    }
  );

  test.each(['OWNER', 'ADMIN'] as const)(
    '%s can still refund a buyer order on the staff route, including Stripe and webhook settlement',
    async (role) => {
      const buyer = await registerUser(app, {
        email: `buyer-refund-customer-staff-${role.toLowerCase()}-${Date.now()}@example.com`,
        password: 'Test123!',
      });
      const staff = await registerUser(app, {
        email: `buyer-refund-${role.toLowerCase()}-staff-${Date.now()}@example.com`,
        password: 'Test123!',
        role,
      });
      if (role === 'OWNER') {
        await prisma.user.update({
          where: { id: staff.user.id },
          data: { organizationId, isPlatformAdmin: false },
        });
      }
      const order = await paidOrder(buyer.user.id, organizationId);
      armProvider(order.paymentIntentId!);

      const response = await request(app)
        .post(`/api/v1/orders/${order.id}/refund`)
        .set('Authorization', `Bearer ${staff.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
      expect(response.body.message).toBe('Refund processing');
      await settleThroughWebhook(order.id);
    }
  );
});
