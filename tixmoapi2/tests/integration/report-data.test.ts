import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { generateAccessToken } from '../../src/utils/jwt';
import { reportService } from '../../src/api/reports/service';
import { analyticsService } from '../../src/api/analytics/service';

describe('Database-aggregated reports', () => {
  let org: any, owner: any, event: any, type: any, token: string;
  beforeEach(async () => {
    await cleanupTestData();
    org = await prisma.organization.create({
      data: { name: 'Report fixture', slug: randomUUID(), type: 'PROMOTER' },
    });
    owner = await prisma.user.create({
      data: {
        email: 'report-owner@test.com',
        firstName: 'Report',
        lastName: 'Owner',
        passwordHash: 'synthetic',
        role: 'OWNER',
        organizationId: org.id,
      },
    });
    event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Same event name',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'UTC',
        tags: [],
      },
    });
    type = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'Admission',
        price: 10,
        quantityTotal: 10000,
        quantityAvailable: 10000,
      },
    });
    token = generateAccessToken({ userId: owner.id, email: owner.email, role: owner.role });
  });
  afterAll(cleanupTestData);
  const order = (
    amount: number,
    createdAt: string,
    currency = 'cad',
    status: 'PAID' | 'PENDING' = 'PAID',
    tickets = 1,
    eventId?: string
  ) =>
    prisma.order.create({
      data: {
        orderNumber: `REPORT-${randomUUID()}`,
        eventId: eventId || event.id,
        userId: owner.id,
        totalAmount: amount,
        currency,
        status,
        createdAt: new Date(createdAt),
        tickets: {
          create: Array.from({ length: tickets }, () => ({
            eventId: eventId || event.id,
            ticketTypeId: type.id,
            userId: owner.id,
            pricePaid: amount / tickets,
            barcode: randomUUID(),
            inventoryState: status === 'PAID' ? 'SOLD' : 'HELD',
          })),
        },
      },
      include: { tickets: true },
    });

  it('groups UTC days, Sunday weeks and months without combining currencies or unrelated records', async () => {
    await order(10, '2026-09-30T23:30:00Z', 'cad', 'PAID', 2);
    await order(20, '2026-10-01T00:30:00Z');
    await order(30, '2026-10-03T23:59:00Z');
    await order(40, '2026-10-04T00:00:00Z');
    await order(1000, '2026-10-04T00:00:00Z', 'usd');
    await order(999, '2026-10-04T00:00:00Z', 'cad', 'PENDING');
    const url = `/api/v1/reports/sales?eventId=${event.id}`;
    const response = await request(app).get(url).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        date: '2026-09-30',
        revenue: 10,
        ticketsSold: 2,
        ordersCount: 1,
        currency: 'cad',
        aggregationTimezone: 'UTC',
      },
      {
        date: '2026-10-01',
        revenue: 20,
        ticketsSold: 1,
        ordersCount: 1,
        currency: 'cad',
        aggregationTimezone: 'UTC',
      },
      {
        date: '2026-10-03',
        revenue: 30,
        ticketsSold: 1,
        ordersCount: 1,
        currency: 'cad',
        aggregationTimezone: 'UTC',
      },
      {
        date: '2026-10-04',
        revenue: 40,
        ticketsSold: 1,
        ordersCount: 1,
        currency: 'cad',
        aggregationTimezone: 'UTC',
      },
    ]);
    const weekly = await reportService.getSalesReport({ eventId: event.id, groupBy: 'week' });
    expect(weekly).toMatchObject([
      { date: '2026-09-27', revenue: 60, ticketsSold: 4, ordersCount: 3 },
      { date: '2026-10-04', revenue: 40, ticketsSold: 1, ordersCount: 1 },
    ]);
    expect(
      await reportService.getSalesReport({ eventId: event.id, groupBy: 'month' })
    ).toMatchObject([
      { date: '2026-09', revenue: 10 },
      { date: '2026-10', revenue: 90 },
    ]);
    expect(
      await reportService.getSalesReport({
        eventId: event.id,
        startDate: '2026-10-01T00:00:00Z',
        endDate: '2026-10-03T23:59:00Z',
      })
    ).toHaveLength(2);
    const usd = await request(app)
      .get(url + '&currency=USD')
      .set('Authorization', `Bearer ${token}`);
    expect(usd.body.data).toMatchObject([{ revenue: 1000, currency: 'usd' }]);
    expect(
      (
        await request(app)
          .get(url + '&currency=bad-value')
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(400);
  });

  it('keeps same-name event groups distinct and applies recorded dashboard currency', async () => {
    const another = await prisma.event.create({
      data: { organizationId: org.id, name: event.name, slug: randomUUID(), tags: [] },
    });
    await order(10, '2026-10-01T00:30:00Z');
    await order(20, '2026-10-01T00:30:00Z', 'cad', 'PAID', 1, another.id);
    await order(100, '2026-10-01T00:30:00Z', 'usd');
    const groups = await reportService.getSalesReport({ organizationId: org.id, groupBy: 'event' });
    expect(groups).toHaveLength(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: event.id, revenue: 10 }),
        expect.objectContaining({ eventId: another.id, revenue: 20 }),
      ])
    );
    const dashboard = await request(app)
      .get('/api/v1/reports/dashboard?currency=usd')
      .set('Authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data).toMatchObject({
      totalRevenue: 100,
      currency: 'usd',
      totalTicketsSold: 1,
      recentOrders: [{ currency: 'usd', eventName: event.name }],
    });
    const unrelatedOrg = await prisma.organization.create({
      data: { name: 'Other fixture', slug: randomUUID(), type: 'PROMOTER' },
    });
    const unrelatedEvent = await prisma.event.create({
      data: {
        organizationId: unrelatedOrg.id,
        name: 'Other fixture',
        slug: randomUUID(),
        tags: [],
      },
    });
    await order(999, '2026-10-01T00:30:00Z', 'cad', 'PAID', 1, unrelatedEvent.id);
    const scoped = await request(app)
      .get('/api/v1/reports/sales?groupBy=event')
      .set('Authorization', `Bearer ${token}`);
    expect(scoped.body.data).toHaveLength(2);
  });

  it('aggregates successful paid admission logs by UTC hour and excludes held/unpaid tickets', async () => {
    const paid = await order(20, '2026-10-01T00:30:00Z', 'cad', 'PAID', 2);
    const unpaid = await order(10, '2026-10-01T00:30:00Z', 'cad', 'PENDING');
    await prisma.ticket.update({ where: { id: paid.tickets[0].id }, data: { status: 'USED' } });
    await prisma.ticket.update({ where: { id: unpaid.tickets[0].id }, data: { status: 'USED' } });
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Owned report fixture',
        apiKey: randomUUID(),
        createdBy: owner.id,
        organizationId: org.id,
        eventId: event.id,
      },
    });
    await prisma.scanLog.createMany({
      data: [
        {
          scannerId: scanner.id,
          eventId: event.id,
          ticketId: paid.tickets[0].id,
          scanType: 'ENTRY',
          success: true,
          scannedAt: new Date('2026-10-01T04:30:00Z'),
        },
        {
          scannerId: scanner.id,
          eventId: event.id,
          ticketId: paid.tickets[0].id,
          scanType: 'EXIT',
          success: true,
        },
        {
          scannerId: scanner.id,
          eventId: event.id,
          ticketId: paid.tickets[0].id,
          scanType: 'ENTRY',
          success: false,
        },
        {
          scannerId: scanner.id,
          eventId: event.id,
          ticketId: unpaid.tickets[0].id,
          scanType: 'ENTRY',
          success: true,
        },
      ],
    });
    expect(await reportService.getAttendanceReport({ eventId: event.id })).toMatchObject({
      ticketsSold: 2,
      checkedIn: 1,
      attendanceRate: 50,
      aggregationTimezone: 'UTC',
      checkInsByHour: [{ time: '2026-10-01T04:00:00.000Z', count: 1 }],
    });
  });

  it('returns exact aggregate totals for 1000 orders and 2000 tickets without order hydration', async () => {
    const rows = Array.from({ length: 1000 }, () => ({
      id: randomUUID(),
      orderNumber: `REPORT-${randomUUID()}`,
      eventId: event.id,
      userId: owner.id,
      totalAmount: 0.1,
      currency: 'cad',
      status: 'PAID' as const,
      createdAt: new Date('2026-10-01T04:30:00Z'),
    }));
    await prisma.order.createMany({ data: rows });
    await prisma.ticket.createMany({
      data: rows.flatMap((row) =>
        Array.from({ length: 2 }, () => ({
          orderId: row.id,
          eventId: event.id,
          ticketTypeId: type.id,
          userId: owner.id,
          pricePaid: 0.05,
          barcode: randomUUID(),
          inventoryState: 'SOLD' as const,
        }))
      ),
    });
    const hydrate = jest.spyOn(prisma.order, 'findMany');
    try {
      expect(await reportService.getSalesReport({ eventId: event.id })).toMatchObject([
        { revenue: 100, ticketsSold: 2000, ordersCount: 1000 },
      ]);
      expect(await analyticsService.getSalesAnalytics({ eventId: event.id })).toMatchObject({
        totalRevenue: 100,
        totalOrders: 1000,
        totalTicketsSold: 2000,
      });
      expect(hydrate).not.toHaveBeenCalled();
    } finally {
      hydrate.mockRestore();
    }
  }, 15000);

  it('uses the event capacity and buckets a half-hour zone across the UTC day', async () => {
    const venue = await prisma.venue.create({
      data: {
        organizationId: org.id,
        name: 'Harbour',
        address: { city: "St. John's" },
        capacity: 100,
        timezone: 'America/Halifax',
      },
    });
    const localEvent = await prisma.event.create({
      data: {
        organizationId: org.id,
        venueId: venue.id,
        name: 'Half hour',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'America/St_Johns',
        capacity: 50,
        tags: [],
      },
    });
    const localType = await prisma.ticketType.create({
      data: {
        eventId: localEvent.id,
        name: 'Door',
        price: 10,
        quantityTotal: 80,
        quantityAvailable: 80,
      },
    });
    const sold = (amount: number, createdAt: string) =>
      prisma.order.create({
        data: {
          orderNumber: `REPORT-${randomUUID()}`,
          eventId: localEvent.id,
          userId: owner.id,
          totalAmount: amount,
          currency: 'cad',
          status: 'PAID',
          createdAt: new Date(createdAt),
          tickets: {
            create: {
              eventId: localEvent.id,
              ticketTypeId: localType.id,
              userId: owner.id,
              pricePaid: amount,
              barcode: randomUUID(),
              inventoryState: 'SOLD',
            },
          },
        },
        include: { tickets: true },
      });
    const lateEvening = await sold(15, '2026-10-02T02:00:00.000Z');
    await sold(5, '2026-10-02T02:45:00.000Z');
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Harbour gate',
        apiKey: randomUUID(),
        createdBy: owner.id,
        organizationId: org.id,
        eventId: localEvent.id,
      },
    });
    await prisma.scanLog.createMany({
      data: [
        {
          scannerId: scanner.id,
          eventId: localEvent.id,
          ticketId: lateEvening.tickets[0].id,
          scanType: 'ENTRY',
          success: true,
          scannedAt: new Date('2026-10-02T02:15:00.000Z'),
        },
        {
          scannerId: scanner.id,
          eventId: localEvent.id,
          ticketId: lateEvening.tickets[0].id,
          scanType: 'ENTRY',
          success: true,
          scannedAt: new Date('2026-10-02T02:45:00.000Z'),
        },
      ],
    });

    expect(await reportService.getSalesReport({ eventId: localEvent.id })).toEqual([
      expect.objectContaining({
        date: '2026-10-01',
        revenue: 15,
        ordersCount: 1,
        aggregationTimezone: 'America/St_Johns',
      }),
      expect.objectContaining({
        date: '2026-10-02',
        revenue: 5,
        ordersCount: 1,
        aggregationTimezone: 'America/St_Johns',
      }),
    ]);
    expect(await reportService.getAttendanceReport({ eventId: localEvent.id })).toMatchObject({
      totalCapacity: 50,
      aggregationTimezone: 'America/St_Johns',
      checkInsByHour: [
        { time: '2026-10-01T23:00:00.000-02:30', count: 1 },
        { time: '2026-10-02T00:00:00.000-02:30', count: 1 },
      ],
    });
  });

  it('falls back to ticket quantities when the event has no capacity of its own', async () => {
    const venue = await prisma.venue.create({
      data: {
        organizationId: org.id,
        name: 'Open hall',
        address: { city: 'Test' },
        capacity: 100,
        timezone: 'UTC',
      },
    });
    const openEvent = await prisma.event.create({
      data: {
        organizationId: org.id,
        venueId: venue.id,
        name: 'Open',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'UTC',
        tags: [],
      },
    });
    await prisma.ticketType.createMany({
      data: [
        {
          eventId: openEvent.id,
          name: 'A',
          price: 1,
          quantityTotal: 30,
          quantityAvailable: 30,
        },
        {
          eventId: openEvent.id,
          name: 'B',
          price: 1,
          quantityTotal: 20,
          quantityAvailable: 20,
        },
      ],
    });
    expect(await reportService.getAttendanceReport({ eventId: openEvent.id })).toMatchObject({
      totalCapacity: 50,
      aggregationTimezone: 'UTC',
    });
  });

  it('buckets org-wide sales in the org timezone, a shared venue timezone, or UTC', async () => {
    const stamp = '2026-10-02T02:00:00.000Z';
    const londonOrg = await prisma.organization.create({
      data: {
        name: 'London books',
        slug: randomUUID(),
        type: 'PROMOTER',
        settings: { timezone: 'Europe/London' },
      },
    });
    await prisma.venue.create({
      data: {
        organizationId: londonOrg.id,
        name: 'Ignored venue zone',
        address: {},
        capacity: 100,
        timezone: 'America/St_Johns',
      },
    });
    const londonEvent = await prisma.event.create({
      data: {
        organizationId: londonOrg.id,
        name: 'London night',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'UTC',
        tags: [],
      },
    });
    const londonType = await prisma.ticketType.create({
      data: {
        eventId: londonEvent.id,
        name: 'Seat',
        price: 10,
        quantityTotal: 10,
        quantityAvailable: 10,
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: `REPORT-${randomUUID()}`,
        eventId: londonEvent.id,
        userId: owner.id,
        totalAmount: 10,
        currency: 'cad',
        status: 'PAID',
        createdAt: new Date('2026-10-01T23:30:00.000Z'),
        tickets: {
          create: {
            eventId: londonEvent.id,
            ticketTypeId: londonType.id,
            userId: owner.id,
            pricePaid: 10,
            barcode: randomUUID(),
            inventoryState: 'SOLD',
          },
        },
      },
    });
    expect(await reportService.getSalesReport({ organizationId: londonOrg.id })).toMatchObject([
      { date: '2026-10-02', aggregationTimezone: 'Europe/London' },
    ]);

    const venueOrg = await prisma.organization.create({
      data: { name: 'Venue books', slug: randomUUID(), type: 'PROMOTER' },
    });
    await prisma.venue.create({
      data: {
        organizationId: venueOrg.id,
        name: 'One zone',
        address: {},
        capacity: 100,
        timezone: 'America/St_Johns',
      },
    });
    const venueEvent = await prisma.event.create({
      data: {
        organizationId: venueOrg.id,
        name: 'Venue night',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'UTC',
        tags: [],
      },
    });
    const venueType = await prisma.ticketType.create({
      data: {
        eventId: venueEvent.id,
        name: 'Seat',
        price: 8,
        quantityTotal: 10,
        quantityAvailable: 10,
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: `REPORT-${randomUUID()}`,
        eventId: venueEvent.id,
        userId: owner.id,
        totalAmount: 8,
        currency: 'cad',
        status: 'PAID',
        createdAt: new Date(stamp),
        tickets: {
          create: {
            eventId: venueEvent.id,
            ticketTypeId: venueType.id,
            userId: owner.id,
            pricePaid: 8,
            barcode: randomUUID(),
            inventoryState: 'SOLD',
          },
        },
      },
    });
    expect(await reportService.getSalesReport({ organizationId: venueOrg.id })).toMatchObject([
      { date: '2026-10-01', aggregationTimezone: 'America/St_Johns' },
    ]);

    const mixedOrg = await prisma.organization.create({
      data: { name: 'Mixed books', slug: randomUUID(), type: 'PROMOTER' },
    });
    for (const timezone of ['America/St_Johns', 'Europe/London']) {
      await prisma.venue.create({
        data: {
          organizationId: mixedOrg.id,
          name: timezone,
          address: {},
          capacity: 100,
          timezone,
        },
      });
    }
    const mixedEvent = await prisma.event.create({
      data: {
        organizationId: mixedOrg.id,
        name: 'Mixed night',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'America/St_Johns',
        tags: [],
      },
    });
    const mixedType = await prisma.ticketType.create({
      data: {
        eventId: mixedEvent.id,
        name: 'Seat',
        price: 4,
        quantityTotal: 10,
        quantityAvailable: 10,
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: `REPORT-${randomUUID()}`,
        eventId: mixedEvent.id,
        userId: owner.id,
        totalAmount: 4,
        currency: 'cad',
        status: 'PAID',
        createdAt: new Date(stamp),
        tickets: {
          create: {
            eventId: mixedEvent.id,
            ticketTypeId: mixedType.id,
            userId: owner.id,
            pricePaid: 4,
            barcode: randomUUID(),
            inventoryState: 'SOLD',
          },
        },
      },
    });
    expect(await reportService.getSalesReport({ organizationId: mixedOrg.id })).toMatchObject([
      { date: '2026-10-02', aggregationTimezone: 'UTC' },
    ]);
  });
});
