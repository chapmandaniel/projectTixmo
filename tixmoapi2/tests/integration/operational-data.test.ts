import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { generateAccessToken } from '../../src/utils/jwt';
import { analyticsService } from '../../src/api/analytics/service';

describe('Recorded operational data', () => {
  let org: any, event: any, type: any, owner: any, customer: any, token: string;
  beforeEach(async () => {
    await cleanupTestData();
    org = await prisma.organization.create({
      data: { name: 'Operations fixture', slug: randomUUID(), type: 'PROMOTER' },
    });
    owner = await prisma.user.create({
      data: {
        organizationId: org.id,
        role: 'OWNER',
        email: 'ops-owner@test.com',
        firstName: 'Alice',
        lastName: 'Owner',
        passwordHash: 'synthetic',
      },
    });
    customer = await prisma.user.create({
      data: {
        organizationId: org.id,
        role: 'CUSTOMER',
        email: 'ops-customer@test.com',
        firstName: 'Alice',
        lastName: 'Customer',
        passwordHash: 'synthetic',
      },
    });
    token = generateAccessToken({ userId: owner.id, email: owner.email, role: owner.role });
    event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Recorded event',
        slug: randomUUID(),
        status: 'ON_SALE',
        tags: [],
      },
    });
    type = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Admission',
        price: 10,
        quantityTotal: 100,
        quantityAvailable: 100,
      },
    });
  });
  afterAll(cleanupTestData);
  const order = (
    currency: string,
    amount: number,
    status: 'PAID' | 'PENDING',
    tickets = 1,
    userId?: string
  ) =>
    prisma.order.create({
      data: {
        orderNumber: `REC-${randomUUID()}`,
        eventId: event.id,
        userId: userId || owner.id,
        status,
        currency,
        totalAmount: amount,
        paymentStatus: status === 'PAID' ? 'SUCCEEDED' : 'PENDING',
        createdAt: new Date('2026-10-04T03:05:00Z'),
        tickets: {
          create: Array.from({ length: tickets }, () => ({
            eventId: event.id,
            ticketTypeId: type.id,
            userId: userId || owner.id,
            pricePaid: amount / tickets,
            barcode: randomUUID(),
            inventoryState: status === 'PAID' ? 'SOLD' : 'HELD',
          })),
        },
      },
    });

  it('keeps currencies separate, measures actual UTC hours, and excludes pending sales and admissions', async () => {
    await order('cad', 120, 'PAID', 2);
    await order('cad', 30, 'PAID');
    await order('usd', 400, 'PAID');
    await order('cad', 999, 'PENDING', 5);
    const response = await request(app)
      .get(`/api/v1/analytics/sales?eventId=${event.id}&currency=CAD`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      currency: 'cad',
      aggregationTimezone: 'UTC',
      totalRevenue: 150,
      totalOrders: 2,
      totalTicketsSold: 3,
      averageOrderValue: 75,
      salesByDay: [{ date: '2026-10-04', revenue: 150, orders: 2, tickets: 3 }],
      ordersByHour: [{ day: 0, hour: 3, orders: 2 }],
    });
    expect(
      (await analyticsService.getSalesAnalytics({ eventId: event.id, currency: 'usd' }))
        .totalRevenue
    ).toBe(400);
    expect(
      (
        await analyticsService.getSalesAnalytics({
          eventId: event.id,
          startDate: new Date('2026-10-05T00:00:00Z'),
        })
      ).totalOrders
    ).toBe(0);
    const stats = await request(app)
      .get(`/api/v1/events/${event.id}/stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.data.ticketsSold).toBe(4);
    expect(stats.body.data.ticketsValid).toBe(4);
    expect(stats.body.data.ticketsUsed).toBe(0);
  });

  it('searches recorded customers while preserving the customer ownership filter', async () => {
    const own = await order('cad', 10, 'PAID', 1, customer.id);
    await order('cad', 20, 'PAID');
    const customerToken = generateAccessToken({
      userId: customer.id,
      email: customer.email,
      role: customer.role,
    });
    const response = await request(app)
      .get(`/api/v1/orders?eventId=${event.id}&search=alice`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.orders.map((item: any) => item.id)).toEqual([own.id]);
    const staff = await request(app)
      .get(`/api/v1/orders?eventId=${event.id}&search=alice&status=PAID`)
      .set('Authorization', `Bearer ${token}`);
    expect(staff.body.data.pagination.total).toBe(2);
    const customers = await analyticsService.getCustomerAnalytics({ eventId: event.id });
    expect(customers).toMatchObject({
      totalCustomers: 1,
      repeatCustomers: 0,
      topCustomers: [{ id: customer.id, totalSpent: 10, totalOrders: 1 }],
    });
    expect((await analyticsService.getEventAnalytics({ eventId: event.id })).topEvents).toEqual([
      { id: event.id, name: event.name, revenue: 30, ticketsSold: 2 },
    ]);
  });

  it('deletes and restores an empty event, searches the real recycle bin, and rejects ticket-bearing deletion', async () => {
    const deleted = await request(app)
      .delete(`/api/v1/events/${event.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    const list = await request(app)
      .get(`/api/v1/events/deleted?organizationId=${org.id}&search=recorded`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.events.map((item: any) => item.id)).toEqual([event.id]);
    const invalidPage = await request(app)
      .get('/api/v1/events/deleted?page=NaN')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidPage.status).toBe(400);
    const restored = await request(app)
      .post(`/api/v1/events/${event.id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restored.body.data).toMatchObject({ status: 'DRAFT', deletedAt: null });
    await order('cad', 10, 'PENDING');
    const refused = await request(app)
      .delete(`/api/v1/events/${event.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(refused.status).toBe(400);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).deletedAt
    ).toBeNull();
  });
});
