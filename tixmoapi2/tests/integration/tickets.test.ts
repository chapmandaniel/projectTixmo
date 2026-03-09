import request from 'supertest';
import app from '../../src/app';
import {
  cleanupTestData,
  createEvent,
  createOrganization,
  createVenue,
  prisma,
  registerUser,
} from '../utils/testUtils';

describe('Tickets API', () => {
  let authToken: string;
  let promoterToken: string;
  let userId: string;
  let secondUserId: string;
  let organizationId: string;
  let eventId: string;
  let ticketTypeId: string;
  let orderId: string;
  let ticketId: string;

  beforeAll(async () => {
    await cleanupTestData();

    const customerData = await registerUser(app, {
      email: 'tickets-test@example.com',
      password: 'Test123!',
      firstName: 'Tickets',
      lastName: 'Test',
    });

    authToken = customerData.accessToken;
    userId = customerData.user.id;

    const promoterData = await registerUser(app, {
      email: 'tickets-promoter@example.com',
      password: 'Test123!',
      firstName: 'Tickets',
      lastName: 'Promoter',
      role: 'PROMOTER',
    });

    promoterToken = promoterData.accessToken;

    const recipientData = await registerUser(app, {
      email: 'tickets-recipient@example.com',
      password: 'Test123!',
      firstName: 'Recipient',
      lastName: 'User',
    });

    secondUserId = recipientData.user.id;

    const org = await createOrganization(app, promoterToken, {
      name: 'Test Tickets Org',
      slug: 'test-tickets-org',
      type: 'PROMOTER',
    });
    organizationId = org.id;

    const venue = await createVenue(app, promoterToken, {
      organizationId,
      name: 'Test Venue',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        country: 'USA',
        postalCode: '12345',
      },
      capacity: 500,
    });

    const event = await createEvent(app, promoterToken, {
      organizationId,
      venueId: venue.id,
      title: 'Test Event for Tickets',
      description: 'Test event description',
      startDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      status: 'PUBLISHED',
      capacity: 1000,
    });
    eventId = event.id;

    // Create ticket type
    const ticketTypeRes = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        eventId,
        name: 'General Admission',
        price: 50.0,
        quantity: 100,
        maxPerOrder: 10,
      });

    ticketTypeId = ticketTypeRes.body.data.id;

    // Create order with tickets
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ ticketTypeId, quantity: 2 }],
      });

    if (!orderRes.body.data || !orderRes.body.data.id) {
      throw new Error(`Failed to create order: ${JSON.stringify(orderRes.body)}`);
    }
    orderId = orderRes.body.data.id;

    // Confirm order to generate tickets
    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${promoterToken}`)
      .send({
        paymentMethodId: 'pm_test_success',
      });

    // Get tickets from order
    const orderDetails = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`);

    if (
      !orderDetails.body.data ||
      !orderDetails.body.data.tickets ||
      orderDetails.body.data.tickets.length === 0
    ) {
      throw new Error(`Order has no tickets: ${JSON.stringify(orderDetails.body)}`);
    }
    ticketId = orderDetails.body.data.tickets[0].id;
  });

  afterAll(async () => {
    // Disconnect Prisma client used by tests
    await prisma.$disconnect();
  });

  describe('GET /api/v1/tickets', () => {
    it('should list user tickets', async () => {
      const res = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toBeInstanceOf(Array);
      expect(res.body.data.tickets.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter tickets by event', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets?eventId=${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.every((t: any) => t.eventId === eventId)).toBe(true);
    });

    it('should filter tickets by status', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?status=VALID')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.every((t: any) => t.status === 'VALID')).toBe(true);
    });

    it('should paginate tickets', async () => {
      const res = await request(app)
        .get('/api/v1/tickets?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets.length).toBeLessThanOrEqual(1);
      expect(res.body.data.pagination.limit).toBe(1);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/tickets');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/tickets/:id', () => {
    it('should get ticket by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(ticketId);
      expect(res.body.data).toHaveProperty('barcode');
      expect(res.body.data).toHaveProperty('event');
      expect(res.body.data).toHaveProperty('ticketType');
      expect(res.body.data).toHaveProperty('order');
    });

    it('should fail if ticket not found', async () => {
      const res = await request(app)
        .get('/api/v1/tickets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get(`/api/v1/tickets/${ticketId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/tickets/:id/transfer', () => {
    let transferTicketId: string;

    beforeEach(async () => {
      // Create fresh order for transfer tests
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });

      // Confirm order to generate tickets
      await request(app)
        .post(`/api/v1/orders/${orderRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${promoterToken}`)
        .send({
          paymentMethodId: 'pm_test_success',
        });

      const orderDetails = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      transferTicketId = orderDetails.body.data.tickets[0].id;
    });

    it('should transfer ticket to another user', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'tickets-recipient@example.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('VALID');
      expect(res.body.data.userId).toBe(secondUserId);
      expect(res.body.data.transferredFrom).toBe(userId);
    });

    it('should fail to transfer to non-existent user', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'nonexistent@example.com',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should fail to transfer to self', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'tickets-test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('yourself');
    });

    it('should fail to transfer cancelled ticket', async () => {
      await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethodId: 'pm_test_success',
        });

      const res = await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'tickets-recipient@example.com',
        });

      expect(res.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post(`/api/v1/tickets/${transferTicketId}/transfer`).send({
        recipientEmail: 'tickets-recipient@example.com',
      });

      expect(res.status).toBe(401);
    });

    it('should fail with invalid email format', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${transferTicketId}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'invalid-email',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/tickets/:id/cancel', () => {
    let cancelTicketId: string;
    let cancelOrderId: string;

    beforeEach(async () => {
      // Create and confirm order
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });

      cancelOrderId = orderRes.body.data.id;

      await request(app)
        .post(`/api/v1/orders/${cancelOrderId}/confirm`)
        .set('Authorization', `Bearer ${promoterToken}`)
        .send({
          paymentMethodId: 'pm_test_success',
        });

      const orderDetails = await request(app)
        .get(`/api/v1/orders/${cancelOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      cancelTicketId = orderDetails.body.data.tickets[0].id;
    });

    it('should cancel a ticket', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${cancelTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should fail to cancel already cancelled ticket', async () => {
      await request(app)
        .post(`/api/v1/tickets/${cancelTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post(`/api/v1/tickets/${cancelTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already cancelled');
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post(`/api/v1/tickets/${cancelTicketId}/cancel`);

      expect(res.status).toBe(401);
    });
  });

  // Time-sensitive ticket validation & check-in tests
  describe('Time-sensitive ticket validation & check-in', () => {
    // use fake timers to control server time (server runs in same process)
    const FakeTimers = require('@sinonjs/fake-timers');
    let clock: any;
    let event2Id: string;
    let ticketType2Id: string;
    let validateBarcode: string;
    let checkInBarcode: string;

    beforeAll(async () => {
      clock = FakeTimers.install({ now: Date.now(), toFake: ['Date'] });

      const venue = await createVenue(app, authToken, {
        organizationId,
        name: 'Time Test Venue',
        address: {
          street: '1 Time St',
          city: 'Time City',
          state: 'TS',
          country: 'USA',
          postalCode: '00000',
        },
        capacity: 100,
      });

      const event = await createEvent(app, authToken, {
        organizationId,
        venueId: venue.id,
        title: 'Time Test Event',
        description: 'Event for time-sensitive tests',
        startDateTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        endDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        status: 'PUBLISHED',
        capacity: 1000,
      });
      event2Id = event.id;

      // create ticket type for this event
      const ttRes = await request(app)
        .post('/api/v1/ticket-types')
        .set('Authorization', `Bearer ${promoterToken}`)
        .send({
          eventId: event2Id,
          name: 'Time GA',
          price: 10.0,
          quantity: 10,
          maxPerOrder: 5,
        });

      ticketType2Id = ttRes.body.data.id;

      // create two orders (one for validate test, one for check-in)
      const orderValRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ ticketTypeId: ticketType2Id, quantity: 1 }] });

      await request(app)
        .post(`/api/v1/orders/${orderValRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${promoterToken}`)
        .send({ paymentMethodId: 'pm_test_success' });

      const orderValDetails = await request(app)
        .get(`/api/v1/orders/${orderValRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      validateBarcode = orderValDetails.body.data.tickets[0].barcode;

      const orderCheckRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ ticketTypeId: ticketType2Id, quantity: 1 }] });

      await request(app)
        .post(`/api/v1/orders/${orderCheckRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${promoterToken}`)
        .send({ paymentMethodId: 'pm_test_success' });

      const orderCheckDetails = await request(app)
        .get(`/api/v1/orders/${orderCheckRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      checkInBarcode = orderCheckDetails.body.data.tickets[0].barcode;

      // advance clock to after event start (3 minutes)
      clock.tick(3 * 60 * 1000);
    });

    afterAll(async () => {
      // restore real timers
      if (clock) clock.uninstall();

      // cleanup test data created during these tests
      try {
        await cleanupTestData();
      } catch (e) { }
    });

    describe('POST /api/v1/tickets/validate', () => {
      it('should validate a valid ticket', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/validate')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: validateBarcode });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.valid).toBe(true);
        expect(res.body.data).toHaveProperty('ticket');
      });

      it('should fail for invalid barcode', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/validate')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: 'INVALID-BARCODE' });

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toContain('not found');
      });

      it('should fail without authentication', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/validate')
          .send({ barcode: validateBarcode });

        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/v1/tickets/check-in', () => {
      it('should check in a valid ticket', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: checkInBarcode });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('USED');
        expect(res.body.data).toHaveProperty('checkedInAt');
      });

      it('should fail to check in already used ticket', async () => {
        await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: checkInBarcode });

        const res = await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: checkInBarcode });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('already been used');
      });

      it('should fail without authentication', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/check-in')
          .send({ barcode: checkInBarcode });

        expect(res.status).toBe(401);
      });
    });
  });
});
