import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';

describe('Orders API', () => {
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let venueId: string;
  let eventId: string;
  let ticketTypeId: string;

  beforeAll(async () => {
    // Clean up database in correct order (respecting foreign keys)
    await cleanupTestData();

    // Create test user with PROMOTER role
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      email: 'orders-test@example.com',
      password: 'Test123!',
      firstName: 'Orders',
      lastName: 'Test',
      role: 'PROMOTER',
    });

    authToken = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;

    // Create organization
    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Event Org',
        slug: 'test-event-org',
        type: 'PROMOTER',
        contactEmail: 'org@example.com',
      });

    organizationId = orgRes.body.data.id;

    // Create venue
    const venueRes = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        organizationId,
        name: 'Test Venue',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          country: 'USA',
          postalCode: '12345',
        },
        capacity: 1000,
      });

    if (!venueRes.body.data || !venueRes.body.data.id) {
      throw new Error(`Failed to create venue: ${JSON.stringify(venueRes.body)}`);
    }
    venueId = venueRes.body.data.id;

    // Create event
    const eventRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        organizationId,
        venueId,
        title: 'Test Event',
        description: 'Test event description',
        startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        status: 'DRAFT',
        capacity: 1000,
      });

    eventId = eventRes.body.data.id;

    // Publish event
    await request(app)
      .post(`/api/v1/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${authToken}`);

    // Create ticket type
    const ticketTypeRes = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        eventId,
        name: 'General Admission',
        price: 50.0,
        quantity: 100,
        maxPerOrder: 10,
      });

    ticketTypeId = ticketTypeRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/orders', () => {
    it('should create an order successfully', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId,
              quantity: 2,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('orderNumber');
      expect(res.body.data.status).toBe('PENDING');
      expect(parseFloat(res.body.data.totalAmount)).toBe(100.0);
      expect(res.body.data.userId).toBe(userId);
      expect(res.body.data.eventId).toBe(eventId);
    });

    it('should create an order with multiple ticket types', async () => {
      // Create another ticket type
      const vipTicketRes = await request(app)
        .post('/api/v1/ticket-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventId,
          name: 'VIP',
          price: 100.0,
          quantity: 50,
          maxPerOrder: 5,
        });

      const vipTicketTypeId = vipTicketRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { ticketTypeId, quantity: 1 },
            { ticketTypeId: vipTicketTypeId, quantity: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(parseFloat(res.body.data.totalAmount)).toBe(150.0);
    });

    it('should fail if ticket type not found', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId: '00000000-0000-0000-0000-000000000000',
              quantity: 1,
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should fail if quantity exceeds available', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId,
              quantity: 200,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('available');
    });

    it('should fail if quantity exceeds max per order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId,
              quantity: 15,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Maximum');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          items: [
            {
              ticketTypeId,
              quantity: 1,
            },
          ],
        });

      expect(res.status).toBe(401);
    });

    it('should fail with invalid ticket type ID format', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId: 'invalid-uuid',
              quantity: 1,
            },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('should fail with zero quantity', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              ticketTypeId,
              quantity: 0,
            },
          ],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    let orderId: string;

    beforeAll(async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });
      orderId = orderRes.body.data.id;
    });

    it('should get order by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data).toHaveProperty('tickets');
      expect(res.body.data).toHaveProperty('event');
      expect(res.body.data).toHaveProperty('user');
    });

    it('should fail if order not found', async () => {
      const res = await request(app)
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get(`/api/v1/orders/${orderId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/orders/:id/confirm', () => {
    let orderId: string;

    beforeEach(async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 2 }],
        });
      orderId = orderRes.body.data.id;
    });

    it('should confirm an order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
    });

    it('should fail to confirm already confirmed order', async () => {
      await request(app)
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post(`/api/v1/orders/${orderId}/confirm`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/orders/:id/cancel', () => {
    let orderId: string;

    beforeEach(async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });
      orderId = orderRes.body.data.id;
    });

    it('should cancel a pending order', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should fail to cancel confirmed order', async () => {
      await request(app)
        .post(`/api/v1/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot cancel');
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post(`/api/v1/orders/${orderId}/cancel`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/orders', () => {
    beforeAll(async () => {
      // Create a few orders
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            items: [{ ticketTypeId, quantity: 1 }],
          });
      }
    });

    it('should list user orders', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toBeInstanceOf(Array);
      expect(res.body.data.orders.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/orders?status=PENDING')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.every((o: any) => o.status === 'PENDING')).toBe(true);
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/v1/orders?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.limit).toBe(2);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/orders');

      expect(res.status).toBe(401);
    });
  });
});
