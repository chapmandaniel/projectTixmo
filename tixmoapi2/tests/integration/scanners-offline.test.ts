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

describe('Scanner Offline Sync', () => {
  let adminToken: string;
  let scannerApiKey: string;
  let eventId: string;
  let ticket: any;

  beforeAll(async () => {
    await cleanupTestData();

    // Create admin
    const adminData = await registerUser(app, { email: 'admin@test.com' });
    await prisma.user.update({ where: { id: adminData.user.id }, data: { role: UserRole.ADMIN } });

    // Login to get fresh token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'SecurePass123!' });
    adminToken = loginRes.body.data.accessToken;

    // Create organization
    const org = await createOrganization(app, adminToken, { name: 'Test Org' });

    // Create venue
    const venue = await createVenue(app, adminToken, {
      organizationId: org.id,
      name: 'Test Venue',
      capacity: 1000,
    });

    // Create event
    const event = await createEvent(app, adminToken, {
      organizationId: org.id,
      venueId: venue.id,
      status: 'PUBLISHED',
    });
    eventId = event.id;

    // Create scanner
    const scannerRes = await request(app)
      .post('/api/v1/scanners/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Offline Scanner',
        organizationId: org.id,
        eventId: event.id,
      });
    // console.log('Scanner Register Response:', JSON.stringify(scannerRes.body, null, 2));
    scannerApiKey = scannerRes.body.data.apiKey;

    // Create ticket type
    const ticketType = await createTicketType(app, adminToken, {
      eventId: event.id,
      quantity: 100,
    });

    // Create user and order ticket
    const userData = await registerUser(app, { email: 'attendee@test.com' });
    const order = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    });

    // Confirm order (simulate payment)
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });

    // Get ticket
    const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
    ticket = tickets[0];
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /scanners/sync', () => {
    it('should download valid tickets', async () => {
      const res = await request(app)
        .get('/api/v1/scanners/sync')
        .set('Authorization', `Bearer ${scannerApiKey}`)
        .query({ eventId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toHaveLength(1);
      expect(res.body.data.tickets[0].barcode).toBe(ticket.barcode);
      expect(res.body.data.tickets[0].hash).toBeDefined();
    });

    it('should filter by since timestamp', async () => {
      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));
      const since = new Date().toISOString();

      const res = await request(app)
        .get('/api/v1/scanners/sync')
        .set('Authorization', `Bearer ${scannerApiKey}`)
        .query({ eventId, since });

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toHaveLength(0); // No updates since now
    });
  });

  describe('POST /scanners/validate', () => {
    it('should process offline scans', async () => {
      const scans = [
        {
          qrData: `TICKET:${ticket.id}:${ticket.barcode}:${eventId}`,
          scannedAt: new Date().toISOString(),
          scanType: 'ENTRY',
        },
      ];

      const res = await request(app)
        .post('/api/v1/scanners/validate')
        .set('Authorization', `Bearer ${scannerApiKey}`)
        .send({ scans });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processed).toBe(1);
      expect(res.body.data.success).toBe(1);

      // Verify ticket status updated
      const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updatedTicket?.status).toBe('USED');
      expect(updatedTicket?.checkedInAt).toBeDefined();
    });
  });
});
