import request from 'supertest';

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
  process.env.STRIPE_SECRET_KEY = 'sk_test_payments_integration';
}
if (isPlaceholderCredential(process.env.STRIPE_PUBLISHABLE_KEY)) {
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_payments_integration';
}
if (isPlaceholderCredential(process.env.STRIPE_WEBHOOK_SECRET)) {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_payments_integration';
}

import app from '../../src/app';
import {
  prisma,
  cleanupTestData,
  registerUser,
  createEvent,
  createTicketType,
  createOrder,
  createOrganization,
  createVenue,
} from '../utils/testUtils';
import { UserRole } from '@prisma/client';
import { notificationService } from '../../src/utils/notificationService';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock_123456',
        client_secret: 'pi_mock_123456_secret_123456',
        metadata: {
          orderId: 'mock_order_id',
        },
      }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_mock_succeeded',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_123456',
            metadata: {
              orderId: 'mock_order_id',
            },
          },
        },
      }),
    },
  }));
});

describe('Payment Routes', () => {
  let token: string;
  let order: any;

  beforeAll(async () => {
    await cleanupTestData();

    // Create user
    const userData = await registerUser(app, { email: 'payer@test.com' });
    token = userData.accessToken;

    // Create admin for setup
    const adminData = await registerUser(app, { email: 'admin@test.com' });
    await prisma.user.update({ where: { id: adminData.user.id }, data: { role: UserRole.ADMIN } });

    // Login to get fresh token with ADMIN role
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'SecurePass123!' });
    const adminToken = loginRes.body.data.accessToken;

    // Create organization
    const org = await createOrganization(app, adminToken, { name: 'Test Org' });

    // Create venue
    const venue = await createVenue(app, adminToken, {
      organizationId: org.id,
      name: 'Test Venue',
    });

    // Create event
    const event = await createEvent(app, adminToken, {
      organizationId: org.id,
      venueId: venue.id,
      status: 'PUBLISHED',
    });

    // Create ticket type
    const ticketType = await createTicketType(app, adminToken, {
      eventId: event.id,
      price: 10,
      quantity: 100,
    });

    // Create order
    order = await createOrder(app, token, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /payments/create-intent', () => {
    it('should create a payment intent for a valid order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: order.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.clientSecret).toBeDefined();
      expect(res.body.data.paymentIntentId).toBeDefined();

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.paymentIntentId).toBe('pi_mock_123456');
      expect(updatedOrder?.paymentStatus).toBe('PROCESSING');
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /payments/webhook', () => {
    it('should handle payment_intent.succeeded event', async () => {
      // Mock the constructEvent on the service instance
      const { paymentService } = require('../../src/api/payments/service');
      const stripeMock = paymentService.stripe;

      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: 'evt_mock_success_once',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_123456',
            metadata: {
              orderId: order.id,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({ type: 'payment_intent.succeeded' }); // Body doesn't matter much as we mock constructEvent

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      // Verify order status updated
      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder?.status).toBe('PAID');

      const webhookEvent = await prisma.paymentWebhookEvent.findUnique({
        where: { id: 'evt_mock_success_once' },
      });
      expect(webhookEvent?.status).toBe('PROCESSED');
    });

    it('should skip duplicate webhook event ids without double-processing', async () => {
      const { paymentService } = require('../../src/api/payments/service');
      const stripeMock = paymentService.stripe;
      const confirmOrderSpy = jest.spyOn(require('../../src/api/orders/service').orderService, 'confirmOrder');

      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: 'evt_mock_duplicate_success',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_123456',
            metadata: {
              orderId: order.id,
            },
          },
        },
      });

      await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({ type: 'payment_intent.succeeded' });

      const secondRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({ type: 'payment_intent.succeeded' });

      expect(secondRes.status).toBe(200);
      expect(confirmOrderSpy).not.toHaveBeenCalled();
      expect(await prisma.paymentWebhookEvent.count({
        where: { id: 'evt_mock_duplicate_success' },
      })).toBe(1);
      confirmOrderSpy.mockRestore();
    });

    it('should notify the customer email when payment fails', async () => {
      const { paymentService } = require('../../src/api/payments/service');
      const stripeMock = paymentService.stripe;
      const sendEmailSpy = jest.spyOn(notificationService, 'sendEmail').mockResolvedValue(true);
      const ticketType = await prisma.ticketType.findFirstOrThrow();
      const failedOrder = await createOrder(app, token, {
        items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      });

      stripeMock.webhooks.constructEvent.mockReturnValue({
        id: 'evt_mock_payment_failed',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_mock_failed',
            last_payment_error: { message: 'Card declined' },
            metadata: {
              orderId: failedOrder.id,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('stripe-signature', 'mock_signature')
        .send({ type: 'payment_intent.payment_failed' });

      expect(res.status).toBe(200);
      expect(sendEmailSpy).toHaveBeenCalledWith(expect.objectContaining({
        to: 'payer@test.com',
        subject: 'Payment Failed',
      }));

      sendEmailSpy.mockRestore();
    });
  });
});
