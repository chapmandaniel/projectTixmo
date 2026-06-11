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

  const paidOrder = async (orderId: string, createdAt: string) => {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
    });
  };

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
      title: 'Neon Nights',
      status: 'ON_SALE',
    });
    eventId = event.id;

    const secondEvent = await createEvent(app, adminToken, {
      organizationId: org.id,
      venueId: venue.id,
      title: 'Harbor Afterparty',
      status: 'PUBLISHED',
    });

    const otherOrg = await createOrganization(app, adminToken, { name: 'Other Report Org' });
    const otherVenue = await createVenue(app, adminToken, {
      organizationId: otherOrg.id,
      name: 'Other Report Venue',
      capacity: 500,
    });
    const otherEvent = await createEvent(app, adminToken, {
      organizationId: otherOrg.id,
      venueId: otherVenue.id,
      title: 'Other Org Gala',
      status: 'ON_SALE',
    });

    const generalAdmission = await createTicketType(app, adminToken, {
      eventId: event.id,
      name: 'General Admission',
      price: 45,
      quantity: 100,
    });
    const vipBalcony = await createTicketType(app, adminToken, {
      eventId: event.id,
      name: 'VIP Balcony',
      price: 120,
      quantity: 20,
    });
    const afterpartyTicket = await createTicketType(app, adminToken, {
      eventId: secondEvent.id,
      name: 'Afterparty Entry',
      price: 75,
      quantity: 60,
    });
    const otherOrgTicket = await createTicketType(app, adminToken, {
      eventId: otherEvent.id,
      name: 'Other Org Entry',
      price: 320,
      quantity: 10,
    });

    const userData = await registerUser(app, { email: 'buyer@test.com' });

    const neonOrder = await createOrder(app, userData.accessToken, {
      items: [
        { ticketTypeId: generalAdmission.id, quantity: 2 },
        { ticketTypeId: vipBalcony.id, quantity: 1 },
      ],
    });
    await paidOrder(neonOrder.id, '2026-06-01T18:30:00.000Z');

    const afterpartyOrder = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: afterpartyTicket.id, quantity: 2 }],
    });
    await paidOrder(afterpartyOrder.id, '2026-06-02T02:15:00.000Z');

    const pendingOrder = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: generalAdmission.id, quantity: 1 }],
    });
    await prisma.order.update({
      where: { id: pendingOrder.id },
      data: { createdAt: new Date('2026-06-02T03:00:00.000Z') },
    });

    const otherOrgOrder = await createOrder(app, userData.accessToken, {
      items: [{ ticketTypeId: otherOrgTicket.id, quantity: 1 }],
    });
    await paidOrder(otherOrgOrder.id, '2026-06-02T04:00:00.000Z');

    const tickets = await prisma.ticket.findMany({ where: { orderId: neonOrder.id } });
    await prisma.ticket.update({
      where: { id: tickets[0].id },
      data: { status: 'USED', checkedInAt: new Date('2026-06-07T23:05:00.000Z') },
    });
    const pendingTickets = await prisma.ticket.findMany({ where: { orderId: pendingOrder.id } });
    await prisma.ticket.update({
      where: { id: pendingTickets[0].id },
      data: { status: 'USED', checkedInAt: new Date('2026-06-07T23:10:00.000Z') },
    });

    const scanner = await prisma.scanner.create({
      data: {
        name: 'Test Scanner',
        organizationId: org.id,
        eventId: event.id,
        createdBy: 'system',
        apiKey: 'sk_test_123',
      },
    });

    await prisma.scanLog.createMany({
      data: [
        {
          scannerId: scanner.id,
          ticketId: tickets[0].id,
          eventId: eventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: new Date('2026-06-07T23:05:00.000Z'),
        },
        {
          scannerId: scanner.id,
          ticketId: pendingTickets[0].id,
          eventId: eventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: new Date('2026-06-07T23:10:00.000Z'),
        },
        {
          scannerId: scanner.id,
          ticketId: tickets[1].id,
          eventId: eventId,
          scanType: 'ENTRY',
          success: false,
          failureReason: 'Already scanned',
          scannedAt: new Date('2026-06-07T23:20:00.000Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /reports/sales', () => {
    it('returns paid sales data aggregated by day and scoped to the organization', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: orgId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([
        {
          date: '2026-06-01',
          revenue: 210,
          ticketsSold: 3,
          ordersCount: 1,
        },
        {
          date: '2026-06-02',
          revenue: 150,
          ticketsSold: 2,
          ordersCount: 1,
        },
      ]);
    });

    it('returns event-grouped sales and respects date filters', async () => {
      const byEvent = await request(app)
        .get('/api/v1/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: orgId, groupBy: 'event' });

      expect(byEvent.status).toBe(200);
      expect(byEvent.body.data).toEqual([
        {
          date: 'Neon Nights',
          revenue: 210,
          ticketsSold: 3,
          ordersCount: 1,
        },
        {
          date: 'Harbor Afterparty',
          revenue: 150,
          ticketsSold: 2,
          ordersCount: 1,
        },
      ]);

      const filtered = await request(app)
        .get('/api/v1/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          organizationId: orgId,
          startDate: '2026-06-02T00:00:00.000Z',
          endDate: '2026-06-02T23:59:59.999Z',
        });

      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toEqual([
        {
          date: '2026-06-02',
          revenue: 150,
          ticketsSold: 2,
          ordersCount: 1,
        },
      ]);
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
      expect(res.body.data.totalCapacity).toBe(1000);
      expect(res.body.data.checkInsByHour).toEqual([
        { time: '2026-06-07T23:00:00.000Z', count: 1 },
      ]);
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
      expect(res.body.data.totalRevenue).toBe(360);
      expect(res.body.data.totalTicketsSold).toBe(5);
      expect(res.body.data.activeEvents).toBe(2);
      expect(res.body.data.recentOrders).toHaveLength(2);
      expect(res.body.data.recentOrders.map((order: any) => order.eventName)).toEqual([
        'Harbor Afterparty',
        'Neon Nights',
      ]);
    });
  });
});
