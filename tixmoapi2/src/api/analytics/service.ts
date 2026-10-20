import { Prisma } from '@prisma/client';

import prisma from '../../config/prisma';
import { paidSalesSource } from '../../services/paid-sales-query';

interface DateRangeParams {
  startDate?: Date;
  endDate?: Date;
  eventId?: string;
  currency?: string;
}

interface SalesAnalytics {
  currency: string;
  aggregationTimezone: string;
  ordersByHour: Array<{ day: number; hour: number; orders: number }>;
  totalRevenue: number;
  totalOrders: number;
  totalTicketsSold: number;
  averageOrderValue: number;
  salesByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
    tickets: number;
  }>;
  salesByEvent: Array<{
    eventId: string;
    eventName: string;
    revenue: number;
    orders: number;
    ticketsSold: number;
  }>;
}

interface EventAnalytics {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  cancelledEvents: number;
  soldOutEvents: number;
  eventsByStatus: Array<{
    status: string;
    count: number;
  }>;
  topEvents: Array<{
    id: string;
    name: string;
    ticketsSold: number;
    revenue: number;
  }>;
}

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomersInPeriod: number;
  repeatCustomers: number;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    totalOrders: number;
  }>;
  customersByRegistrationDate: Array<{
    date: string;
    count: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get sales analytics
   */
  async getSalesAnalytics(
    params: DateRangeParams & { organizationId?: string }
  ): Promise<SalesAnalytics> {
    const { startDate, endDate, organizationId, eventId, currency = 'cad' } = params;
    const selectedCurrency = currency.toLowerCase();
    const source = paidSalesSource({
      startDate,
      endDate,
      organizationId,
      eventId,
      currency: selectedCurrency,
    });
    // Aggregate in PostgreSQL; never hydrate every order and ticket into API memory.
    type Day = { date: string; revenue: Prisma.Decimal; orders: bigint; tickets: bigint };
    type EventRow = {
      eventId: string;
      eventName: string;
      revenue: Prisma.Decimal;
      orders: bigint;
      ticketsSold: bigint;
    };
    type Hour = { day: number; hour: number; orders: bigint };
    const [days, events, hours] = await prisma.$transaction(
      [
        prisma.$queryRaw<Day[]>(Prisma.sql`${source}
        SELECT to_char(created_at, 'YYYY-MM-DD') AS date, SUM(total_amount) AS revenue,
          COUNT(*) AS orders, SUM(tickets) AS tickets FROM scoped GROUP BY date ORDER BY date`),
        prisma.$queryRaw<EventRow[]>(Prisma.sql`${source}
        SELECT event_id AS "eventId", event_name AS "eventName", SUM(total_amount) AS revenue,
          COUNT(*) AS orders, SUM(tickets) AS "ticketsSold" FROM scoped
        GROUP BY event_id, event_name ORDER BY revenue DESC, event_id`),
        prisma.$queryRaw<Hour[]>(Prisma.sql`${source}
        SELECT EXTRACT(DOW FROM created_at)::int AS day, EXTRACT(HOUR FROM created_at)::int AS hour,
          COUNT(*) AS orders FROM scoped GROUP BY day, hour ORDER BY day, hour`),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
    const salesByDay = days.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      tickets: Number(row.tickets),
    }));
    const totalRevenue = days
      .reduce((sum, day) => sum.plus(day.revenue), new Prisma.Decimal(0))
      .toNumber();
    const totalOrders = salesByDay.reduce((sum, day) => sum + day.orders, 0);
    return {
      currency: selectedCurrency,
      aggregationTimezone: 'UTC',
      totalRevenue,
      totalOrders,
      totalTicketsSold: salesByDay.reduce((sum, day) => sum + day.tickets, 0),
      averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      salesByDay,
      salesByEvent: events.map((row) => ({
        eventId: row.eventId,
        eventName: row.eventName,
        revenue: Number(row.revenue),
        orders: Number(row.orders),
        ticketsSold: Number(row.ticketsSold),
      })),
      ordersByHour: hours.map((row) => ({ ...row, orders: Number(row.orders) })),
    };
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(
    params: DateRangeParams & { organizationId?: string }
  ): Promise<EventAnalytics> {
    const { startDate, endDate, organizationId, eventId } = params;
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      ...(eventId && { id: eventId }),
      ...(organizationId && { organizationId }),
      ...((startDate || endDate) && {
        createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) },
      }),
    };
    const [groups, sales] = await Promise.all([
      prisma.event.groupBy({ by: ['status'], where, _count: true }),
      this.getSalesAnalytics(params),
    ]);
    const count = (...statuses: string[]) =>
      groups
        .filter((group) => statuses.includes(group.status))
        .reduce((sum, group) => sum + group._count, 0);
    return {
      totalEvents: groups.reduce((sum, group) => sum + group._count, 0),
      publishedEvents: count('PUBLISHED', 'ON_SALE', 'SOLD_OUT'),
      draftEvents: count('DRAFT'),
      cancelledEvents: count('CANCELLED'),
      soldOutEvents: count('SOLD_OUT'),
      eventsByStatus: groups.map((group) => ({ status: group.status, count: group._count })),
      topEvents: sales.salesByEvent.slice(0, 10).map((event) => ({
        id: event.eventId,
        name: event.eventName,
        revenue: event.revenue,
        ticketsSold: event.ticketsSold,
      })),
    };
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(
    params: DateRangeParams & { organizationId?: string }
  ): Promise<CustomerAnalytics> {
    const { startDate, endDate, organizationId, eventId, currency = 'cad' } = params;
    const orderConditions = [
      Prisma.sql`o.status = 'PAID'`,
      Prisma.sql`o.currency = ${currency.toLowerCase()}`,
    ];
    if (eventId) orderConditions.push(Prisma.sql`o.event_id = ${eventId}`);
    if (organizationId) orderConditions.push(Prisma.sql`e.organization_id = ${organizationId}`);
    const periodConditions = [Prisma.sql`true`];
    if (startDate) periodConditions.push(Prisma.sql`u.created_at >= ${startDate}`);
    if (endDate) periodConditions.push(Prisma.sql`u.created_at <= ${endDate}`);
    const period = Prisma.join(periodConditions, ' AND ');
    const source = Prisma.sql`WITH paid AS (
      SELECT o.user_id, o.total_amount FROM orders o JOIN events e ON e.id = o.event_id
      WHERE ${Prisma.join(orderConditions, ' AND ')}
    ), customers AS (
      SELECT u.id, u.first_name, u.last_name, u.email, u.created_at FROM users u
      WHERE u.role = 'CUSTOMER' ${organizationId || eventId ? Prisma.sql`AND EXISTS (SELECT 1 FROM paid p WHERE p.user_id = u.id)` : Prisma.empty}
    )`;
    type Totals = { total: bigint; recent: bigint };
    type Top = {
      id: string;
      name: string;
      email: string;
      totalSpent: Prisma.Decimal;
      totalOrders: bigint;
    };
    type Registration = { date: string; count: bigint };
    const [totals, repeat, top, registrations] = await prisma.$transaction(
      [
        prisma.$queryRaw<Totals[]>(
          Prisma.sql`${source} SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ${period}) AS recent FROM customers u`
        ),
        prisma.$queryRaw<
          Array<{ count: bigint }>
        >(Prisma.sql`${source} SELECT COUNT(*) AS count FROM (
        SELECT u.id FROM customers u JOIN paid p ON p.user_id = u.id GROUP BY u.id HAVING COUNT(*) > 1
      ) repeated`),
        prisma.$queryRaw<
          Top[]
        >(Prisma.sql`${source} SELECT u.id, concat_ws(' ', u.first_name, u.last_name) AS name, u.email,
        SUM(p.total_amount) AS "totalSpent", COUNT(*) AS "totalOrders" FROM customers u JOIN paid p ON p.user_id = u.id
        GROUP BY u.id, u.first_name, u.last_name, u.email ORDER BY "totalSpent" DESC, u.id LIMIT 10`),
        prisma.$queryRaw<
          Registration[]
        >(Prisma.sql`${source} SELECT to_char(u.created_at, 'YYYY-MM-DD') AS date, COUNT(*) AS count
        FROM customers u WHERE ${period} GROUP BY date ORDER BY date`),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
    return {
      totalCustomers: Number(totals[0]?.total || 0),
      newCustomersInPeriod: Number(totals[0]?.recent || 0),
      repeatCustomers: Number(repeat[0]?.count || 0),
      topCustomers: top.map((row) => ({
        ...row,
        totalSpent: Number(row.totalSpent),
        totalOrders: Number(row.totalOrders),
      })),
      customersByRegistrationDate: registrations.map((row) => ({
        date: row.date,
        count: Number(row.count),
      })),
    };
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(organizationId?: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [sales, events, customers] = await Promise.all([
      this.getSalesAnalytics({ startDate: thirtyDaysAgo, endDate: now, organizationId }),
      this.getEventAnalytics({ startDate: thirtyDaysAgo, endDate: now, organizationId }),
      this.getCustomerAnalytics({ startDate: thirtyDaysAgo, endDate: now, organizationId }),
    ]);

    return {
      period: {
        startDate: thirtyDaysAgo.toISOString(),
        endDate: now.toISOString(),
        days: 30,
      },
      sales: {
        totalRevenue: sales.totalRevenue,
        totalOrders: sales.totalOrders,
        totalTicketsSold: sales.totalTicketsSold,
        averageOrderValue: sales.averageOrderValue,
      },
      events: {
        totalEvents: events.totalEvents,
        publishedEvents: events.publishedEvents,
      },
      customers: {
        totalCustomers: customers.totalCustomers,
        newCustomers: customers.newCustomersInPeriod,
        repeatCustomers: customers.repeatCustomers,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
