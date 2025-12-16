import request from 'supertest';
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
    });
  });
});
