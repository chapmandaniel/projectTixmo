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

describe('Reports API', () => {
  let adminToken: string;
  let orgId: string;
  let eventId: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create admin
    const adminData = await registerUser(app, { email: 'admin@test.com' });
    await prisma.user.update({ where: { id: adminData.user.id }, data: { role: UserRole.ADMIN } });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'SecurePass123!' });
    adminToken = loginRes.body.data.accessToken;

    // Create organization
    const org = await createOrganization(app, adminToken, { name: 'Report Org' });
    orgId = org.id;

    // Create venue
    const venue = await createVenue(app, adminToken, {
      organizationId: org.id,
      name: 'Report Venue',
      capacity: 1000,
    });

    // Create event
    const event = await createEvent(app, adminToken, {
      organizationId: org.id,
      venueId: venue.id,
      status: 'PUBLISHED',
    });
    eventId = event.id;

    // Create ticket type
    const ticketType = await createTicketType(app, adminToken, {
      eventId: event.id,
      price: 50,
      quantity: 100,
    });

    // Create some orders
    const userData = await registerUser(app, { email: 'buyer@test.com' });

    // Order 1: 2 tickets
    const order1 = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
    });
    await prisma.order.update({
      where: { id: order1.id },
      data: { status: 'PAID', totalAmount: 100 },
    });

    // Order 2: 1 ticket
    const order2 = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    });
    await prisma.order.update({
      where: { id: order2.id },
      data: { status: 'PAID', totalAmount: 50 },
    });

    // Mark one ticket as used (checked in)
    const tickets = await prisma.ticket.findMany({ where: { orderId: order1.id } });
    await prisma.ticket.update({
      where: { id: tickets[0].id },
      data: { status: 'USED', checkedInAt: new Date() },
    });

    // Create scanner for logs
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Test Scanner',
        organizationId: org.id,
        eventId: event.id,
        createdBy: 'system',
        apiKey: 'sk_test_123',
      },
    });

    // Create scan log for check-in
    await prisma.scanLog.create({
      data: {
        scannerId: scanner.id,
        ticketId: tickets[0].id,
        eventId: eventId,
        scanType: 'ENTRY',
        success: true,
        scannedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /reports/sales', () => {
    it('should return sales data aggregated by day', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: orgId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1); // All orders today
      expect(res.body.data[0].revenue).toBe(150);
      expect(res.body.data[0].ticketsSold).toBe(3);
      expect(res.body.data[0].ordersCount).toBe(2);
    });
  });

  describe('GET /reports/attendance', () => {
    it('should return attendance metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ eventId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketsSold).toBe(3);
      expect(res.body.data.checkedIn).toBe(1);
      expect(res.body.data.attendanceRate).toBeCloseTo(33.33);
    });
  });

  describe('GET /reports/dashboard', () => {
    it('should return dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: orgId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRevenue).toBe(150);
      expect(res.body.data.totalTicketsSold).toBe(3);
      expect(res.body.data.activeEvents).toBe(1);
      expect(res.body.data.recentOrders).toHaveLength(2);
    });
  });
});
