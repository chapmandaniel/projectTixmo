import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { scannerService } from '../../src/api/scanners/service';
import { DOORS_BEFORE_START_MS } from '../../src/config/doors';
import { generateTicketQRData } from '../../src/utils/qrcode';
import {
  cleanupTestData,
  confirmOrderForTest,
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

    await confirmOrderForTest(orderId);

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

    it('includes holder name and email for owner, admin, and manager only', async () => {
      const customer = await request(app)
        .get(`/api/v1/tickets?eventId=${eventId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(customer.status).toBe(200);
      expect(customer.body.data.tickets.length).toBeGreaterThan(0);
      expect(
        customer.body.data.tickets.every((ticket: { user?: unknown }) => ticket.user === undefined)
      ).toBe(true);

      const mine = await request(app)
        .get('/api/v1/tickets/mine')
        .set('Authorization', `Bearer ${authToken}`);
      expect(
        mine.body.data.tickets.every((ticket: { user?: unknown }) => ticket.user === undefined)
      ).toBe(true);

      const promoter = await request(app)
        .get(`/api/v1/tickets?eventId=${eventId}&includeHolder=true`)
        .set('Authorization', `Bearer ${promoterToken}`);
      expect(promoter.status).toBe(200);
      expect(
        promoter.body.data.tickets.every((ticket: { user?: unknown }) => ticket.user === undefined)
      ).toBe(true);

      expect(
        await prisma.staffActionAudit.count({
          where: { action: 'STAFF_PII_VIEW', subjectId: eventId },
        })
      ).toBe(0);

      const holder = {
        firstName: 'Tickets',
        lastName: 'Test',
        email: 'tickets-test@example.com',
      };
      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as const) {
        const staff = await registerUser(app, {
          role,
          email: `tickets-holder-${role.toLowerCase()}-${Date.now()}@example.com`,
        });
        if (role !== 'ADMIN') {
          await prisma.user.update({
            where: { id: staff.user.id },
            data: { organizationId },
          });
        }
        const res = await request(app)
          .get(`/api/v1/tickets?eventId=${eventId}`)
          .set('Authorization', `Bearer ${staff.accessToken}`);
        expect(res.status).toBe(200);
        const row = res.body.data.tickets.find((ticket: { id: string }) => ticket.id === ticketId);
        expect(row.user).toEqual(holder);
        expect(Object.keys(row.user).sort()).toEqual(['email', 'firstName', 'lastName']);
        const listAudit = await prisma.staffActionAudit.findFirst({
          where: {
            action: 'STAFF_PII_VIEW',
            subjectType: 'EVENT',
            subjectId: eventId,
            actorId: staff.user.id,
          },
        });
        expect(listAudit?.reason).toBe('Staff ticket list');
        expect(listAudit?.createdAt).toEqual(expect.any(Date));
      }

      const customerOrder = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(customerOrder.status).toBe(200);
      expect(
        await prisma.staffActionAudit.count({
          where: { action: 'STAFF_PII_VIEW', subjectType: 'ORDER', subjectId: orderId },
        })
      ).toBe(0);
    });

    it('does not let staff from another organization list tickets by eventId', async () => {
      const outsider = await registerUser(app, {
        role: 'OWNER',
        email: `tickets-other-org-${Date.now()}@example.com`,
      });
      await createOrganization(app, outsider.accessToken, {
        name: 'Other Tickets Org',
        slug: `other-tickets-org-${Date.now()}`,
      });
      const denied = await request(app)
        .get(`/api/v1/tickets?eventId=${eventId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);
      expect(denied.status).toBe(403);
      expect(denied.body.data).toBeUndefined();

      const missing = await request(app)
        .get(`/api/v1/tickets?eventId=${randomUUID()}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);
      expect(missing.status).toBe(404);

      const unfiltered = await request(app)
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${outsider.accessToken}`);
      expect(unfiltered.status).toBe(200);
      expect(
        unfiltered.body.data.tickets.every(
          (ticket: { eventId: string }) => ticket.eventId !== eventId
        )
      ).toBe(true);

      const insider = await registerUser(app, {
        role: 'MANAGER',
        email: `tickets-same-org-${Date.now()}@example.com`,
      });
      await prisma.user.update({
        where: { id: insider.user.id },
        data: { organizationId },
      });
      const allowed = await request(app)
        .get(`/api/v1/tickets?eventId=${eventId}`)
        .set('Authorization', `Bearer ${insider.accessToken}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.tickets.length).toBeGreaterThan(0);
      expect(
        allowed.body.data.tickets.every((ticket: { eventId: string }) => ticket.eventId === eventId)
      ).toBe(true);
    });

    it('records admitted and denied scan reason codes', async () => {
      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      const scanner = await prisma.scanner.create({
        data: {
          name: 'Audit gate',
          apiKey: `sk_scanner_${randomUUID()}`,
          organizationId,
          eventId,
          createdBy: userId,
          status: 'ACTIVE',
        },
      });
      const qr = generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);
      const admitted = await scannerService.scanTicket({
        scannerId: scanner.id,
        qrData: qr,
        scanType: 'VALIDATION',
      });
      expect(admitted.success).toBe(true);
      expect(admitted.scanLog.failureReason).toBe('ADMITTED');

      const otherEvent = await prisma.event.create({
        data: { organizationId, name: 'Other gate', slug: randomUUID(), status: 'DRAFT', tags: [] },
      });
      await prisma.scanner.update({ where: { id: scanner.id }, data: { eventId: otherEvent.id } });
      await expect(
        scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'VALIDATION' })
      ).rejects.toMatchObject({ statusCode: 403, data: { reason: 'WRONG_EVENT' } });
      const wrong = await prisma.scanLog.findFirst({
        where: { scannerId: scanner.id, failureReason: 'WRONG_EVENT' },
      });
      expect(wrong?.success).toBe(false);
      expect(wrong?.ticketId).toBe(ticket.id);

      await prisma.scanner.update({
        where: { id: scanner.id },
        data: { eventId, status: 'REVOKED' },
      });
      await expect(
        scannerService.scanTicket({ scannerId: scanner.id, qrData: qr, scanType: 'ENTRY' })
      ).rejects.toThrow('not active');
      const revoked = await prisma.scanLog.findFirst({
        where: { scannerId: scanner.id, failureReason: 'REVOKED' },
      });
      expect(revoked?.success).toBe(false);
    });

    it('checks in from start minus two hours and refuses earlier', async () => {
      const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
      const spare = await prisma.ticket.findFirstOrThrow({
        where: { orderId, status: 'VALID', id: { not: ticketId } },
      });
      const originalStart = event.startDatetime;
      try {
        await prisma.event.update({
          where: { id: eventId },
          data: { startDatetime: new Date(Date.now() + DOORS_BEFORE_START_MS + 60_000) },
        });
        const early = await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: spare.barcode });
        expect(early.status).toBe(400);
        expect(early.body.message).toBe('Event has not started yet');

        await prisma.event.update({
          where: { id: eventId },
          data: { startDatetime: new Date(Date.now() + DOORS_BEFORE_START_MS) },
        });
        const open = await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: spare.barcode });
        expect(open.status).toBe(200);
        expect(open.body.data.status).toBe('USED');
        const checkInAudit = await prisma.staffActionAudit.findFirst({
          where: { action: 'CHECK_IN', subjectId: spare.id },
        });
        const promoter = await prisma.user.findUnique({
          where: { email: 'tickets-promoter@example.com' },
        });
        expect(checkInAudit).toMatchObject({
          actorId: promoter?.id,
          reason: 'Attendee check-in',
          subjectType: 'TICKET',
        });
        expect(checkInAudit?.createdAt).toEqual(expect.any(Date));
      } finally {
        if (originalStart) {
          await prisma.event.update({
            where: { id: eventId },
            data: { startDatetime: originalStart },
          });
        }
      }
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

  describe('ticket payment gates', () => {
    it('should reject QR access for unpaid tickets', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });

      const orderDetails = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const ticket = orderDetails.body.data.tickets[0];

      const res = await request(app)
        .get(`/api/v1/tickets/${ticket.id}/qr`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('payment is completed');

      await request(app)
        .post(`/api/v1/orders/${orderRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      const cancelled = await request(app)
        .get(`/api/v1/tickets/${ticket.id}/qr`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(cancelled.status).toBe(400);
      expect(cancelled.body.message).toContain('cancelled');
      expect(cancelled.body.message).not.toContain('payment is completed');
    });

    it('should name a refunded ticket instead of an unpaid payment', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });
      await confirmOrderForTest(orderRes.body.data.id);
      const orderDetails = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const ticket = orderDetails.body.data.tickets[0];
      await prisma.order.update({
        where: { id: orderRes.body.data.id },
        data: { status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
      });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CANCELLED', inventoryState: 'RELEASED' },
      });

      const res = await request(app)
        .get(`/api/v1/tickets/${ticket.id}/qr`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('refunded');
      expect(res.body.message).not.toContain('payment is completed');
    });

    it('should reject transfers for unpaid tickets', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });

      const orderDetails = await request(app)
        .get(`/api/v1/orders/${orderRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const ticket = orderDetails.body.data.tickets[0];

      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/transfer`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail: 'tickets-recipient@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('payment is completed');

      await request(app)
        .post(`/api/v1/orders/${orderRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);
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

      await confirmOrderForTest(orderRes.body.data.id);

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
      await prisma.ticket.update({
        where: { id: transferTicketId },
        data: { status: 'CANCELLED' },
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
      // Free orders can be cancelled without inventing a Stripe payment.
      // Monetary refund success/failure is covered by the processor-ledger suite.
      await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { price: 0 } });
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ ticketTypeId, quantity: 1 }],
        });

      cancelOrderId = orderRes.body.data.id;
      await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { price: 10 } });

      await confirmOrderForTest(cancelOrderId);

      const orderDetails = await request(app)
        .get(`/api/v1/orders/${cancelOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      cancelTicketId = orderDetails.body.data.tickets[0].id;
    });

    it('should reject a buyer ticket cancellation that would refund the order', async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${cancelTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('All sales are final. Refunds are issued by Tixmo staff.');
      expect(res.body.errors).toMatchObject({ code: 'BUYER_REFUNDS_DISABLED' });

      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: cancelTicketId } });
      expect(ticket.status).toBe('VALID');
      const order = await prisma.order.findUniqueOrThrow({ where: { id: cancelOrderId } });
      expect(order.status).toBe('PAID');
      expect(order.refundStatus).toBe('NONE');
    });

    it('should keep rejecting a buyer when the ticket is already cancelled', async () => {
      await prisma.ticket.update({
        where: { id: cancelTicketId },
        data: { status: 'CANCELLED' },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${cancelTicketId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.errors).toMatchObject({ code: 'BUYER_REFUNDS_DISABLED' });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: cancelOrderId } });
      expect(order.status).toBe('PAID');
      expect(order.refundStatus).toBe('NONE');
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
    let unpaidBarcode: string;

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

      await confirmOrderForTest(orderValRes.body.data.id);

      const orderValDetails = await request(app)
        .get(`/api/v1/orders/${orderValRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      validateBarcode = orderValDetails.body.data.tickets[0].barcode;

      const orderCheckRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ ticketTypeId: ticketType2Id, quantity: 1 }] });

      await confirmOrderForTest(orderCheckRes.body.data.id);

      const orderCheckDetails = await request(app)
        .get(`/api/v1/orders/${orderCheckRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      checkInBarcode = orderCheckDetails.body.data.tickets[0].barcode;

      const unpaidOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ ticketTypeId: ticketType2Id, quantity: 1 }] });

      const unpaidOrderDetails = await request(app)
        .get(`/api/v1/orders/${unpaidOrderRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      unpaidBarcode = unpaidOrderDetails.body.data.tickets[0].barcode;

      // advance clock to after event start (3 minutes)
      clock.tick(3 * 60 * 1000);
    });

    afterAll(async () => {
      // restore real timers
      if (clock) clock.uninstall();

      // cleanup test data created during these tests
      try {
        await cleanupTestData();
      } catch (e) {}
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

        expect(res.status).toBe(404);
        expect(res.body.message).toContain('not found');
      });

      it('should reject unpaid tickets', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/validate')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: unpaidBarcode });

        expect(res.status).toBe(200);
        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toContain('payment is completed');
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

      it('should reject unpaid tickets at check-in', async () => {
        const res = await request(app)
          .post('/api/v1/tickets/check-in')
          .set('Authorization', `Bearer ${promoterToken}`)
          .send({ barcode: unpaidBarcode });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('payment is completed');
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
