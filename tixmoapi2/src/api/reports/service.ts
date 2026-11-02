import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

import prisma from '../../config/prisma';
import { paidSalesSource } from '../../services/paid-sales-query';
import {
  effectiveEventCapacity,
  firstValidZone,
  organizationTimeZone,
  sharedTimeZone,
  withZoneDesignator,
} from './time-zone';

interface SalesReportParams {
  organizationId?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'event';
  currency?: string;
}

interface AttendanceReportParams {
  eventId: string;
}

interface DashboardStatsParams {
  organizationId?: string;
  currency?: string;
}

export class ReportService {
  /**
   * Get sales report
   */
  async getSalesReport(params: SalesReportParams) {
    const {
      organizationId,
      eventId,
      startDate,
      endDate,
      groupBy = 'day',
      currency = 'cad',
    } = params;
    const selectedCurrency = currency.toLowerCase();
    const zone = await this.aggregationZone({ organizationId, eventId });
    const zonedCreatedAt = () => Prisma.sql`((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${zone})`;
    const source = paidSalesSource({
      organizationId,
      eventId,
      currency: selectedCurrency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    type Row = {
      date: string;
      eventId?: string;
      revenue: Prisma.Decimal;
      ticketsSold: bigint;
      ordersCount: bigint;
    };
    // Sunday-start weeks, grouped in the resolved IANA zone rather than UTC.
    const date =
      groupBy === 'month'
        ? Prisma.sql`to_char(${zonedCreatedAt()}, 'YYYY-MM')`
        : groupBy === 'week'
          ? Prisma.sql`to_char(date_trunc('week', ${zonedCreatedAt()} + interval '1 day') - interval '1 day', 'YYYY-MM-DD')`
          : Prisma.sql`to_char(${zonedCreatedAt()}, 'YYYY-MM-DD')`;
    const rows = await prisma.$queryRaw<Row[]>(
      groupBy === 'event'
        ? Prisma.sql`${source} SELECT event_id AS "eventId", event_name AS date,
          SUM(total_amount) AS revenue, SUM(tickets) AS "ticketsSold", COUNT(*) AS "ordersCount"
        FROM scoped GROUP BY event_id, event_name ORDER BY MIN(created_at), event_id`
        : Prisma.sql`${source} SELECT ${date} AS date,
          SUM(total_amount) AS revenue, SUM(tickets) AS "ticketsSold", COUNT(*) AS "ordersCount"
        FROM scoped GROUP BY date ORDER BY date`
    );
    return rows.map((row) => ({
      ...row,
      revenue: Number(row.revenue),
      ticketsSold: Number(row.ticketsSold),
      ordersCount: Number(row.ordersCount),
      currency: selectedCurrency,
      aggregationTimezone: zone,
    }));
  }

  // One event uses that event's timezone. An org-wide or multi-event report
  // uses the organization timezone, then a single shared venue timezone.
  private async aggregationZone(params: {
    organizationId?: string;
    eventId?: string;
  }): Promise<string> {
    if (params.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: params.eventId },
        select: { timezone: true, venue: { select: { timezone: true } } },
      });
      return firstValidZone(event?.timezone, event?.venue?.timezone);
    }
    if (params.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: params.organizationId },
        select: { settings: true, venues: { select: { timezone: true } } },
      });
      return (
        organizationTimeZone(organization?.settings) ||
        sharedTimeZone(organization?.venues.map((venue) => venue.timezone) ?? []) ||
        'UTC'
      );
    }
    return 'UTC';
  }

  /**
   * Get attendance report
   */
  async getAttendanceReport(params: AttendanceReportParams) {
    const { eventId } = params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        name: true,
        capacity: true,
        timezone: true,
        venue: { select: { timezone: true } },
        ticketTypes: { select: { quantityTotal: true } },
      },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }
    const zone = firstValidZone(event.timezone, event.venue?.timezone);

    // Get valid tickets count (sold)
    const ticketsSold = await prisma.ticket.count({
      where: {
        eventId,
        status: { in: ['VALID', 'USED'] },
        inventoryState: 'SOLD',
        order: { status: 'PAID' },
      },
    });

    // Get checked in count
    const checkedIn = await prisma.ticket.count({
      where: {
        eventId,
        status: 'USED',
        inventoryState: 'SOLD',
        order: { status: 'PAID' },
      },
    });

    // Get scan logs over time for check-in velocity
    const checkInsByHour = await prisma.$queryRaw<Array<{ time: string; count: bigint }>>`
      SELECT to_char(date_trunc('hour', (s.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE ${zone}), 'YYYY-MM-DD"T"HH24:00:00.000') AS time,
        COUNT(*) AS count
      FROM scan_logs s JOIN tickets t ON t.id = s.ticket_id JOIN orders o ON o.id = t.order_id
      WHERE s.event_id = ${eventId} AND s.scan_type = 'ENTRY' AND s.success = true
        AND o.status = 'PAID' AND t.inventory_state = 'SOLD'
      GROUP BY time ORDER BY time`;

    return {
      eventName: event.name,
      totalCapacity: effectiveEventCapacity(
        event.capacity,
        event.ticketTypes.map((ticketType) => ticketType.quantityTotal)
      ),
      ticketsSold,
      checkedIn,
      attendanceRate: ticketsSold > 0 ? (checkedIn / ticketsSold) * 100 : 0,
      aggregationTimezone: zone,
      checkInsByHour: checkInsByHour.map((row) => ({
        time: withZoneDesignator(row.time, zone),
        count: Number(row.count),
      })),
    };
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(params: DashboardStatsParams) {
    const { organizationId, currency = 'cad' } = params;

    // Filter by org if provided
    const eventWhere: Prisma.EventWhereInput = organizationId ? { organizationId } : {};

    // Recorded paid revenue in the selected currency.
    const orderWhere: Prisma.OrderWhereInput = { status: 'PAID', currency: currency.toLowerCase() };
    if (organizationId) {
      orderWhere.event = { organizationId };
    }

    const result = await prisma.order.aggregate({
      where: orderWhere,
      _sum: {
        totalAmount: true,
      },
    });
    const totalRevenue = Number(result._sum.totalAmount) || 0;

    // 2. Tickets Sold
    const ticketWhere: Prisma.TicketWhereInput = { status: { in: ['VALID', 'USED'] } };
    ticketWhere.inventoryState = 'SOLD';
    ticketWhere.order = { status: 'PAID', currency: currency.toLowerCase() };
    if (organizationId) {
      ticketWhere.event = { organizationId };
    }
    const totalTicketsSold = await prisma.ticket.count({ where: ticketWhere });

    // 3. Active Events
    const activeEvents = await prisma.event.count({
      where: {
        ...eventWhere,
        status: { in: ['PUBLISHED', 'ON_SALE'] },
        endDatetime: { gte: new Date() },
      },
    });

    // 4. Recent Sales (Last 5 orders)
    const recentOrders = await prisma.order.findMany({
      where: orderWhere,
      take: 5,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        event: { select: { name: true } },
      },
    });

    return {
      totalRevenue,
      currency: currency.toLowerCase(),
      totalTicketsSold,
      activeEvents,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        customer: `${o.user.firstName} ${o.user.lastName}`,
        amount: o.totalAmount,
        currency: o.currency,
        date: o.createdAt,
        eventName: o.event?.name || 'Unknown',
      })),
    };
  }
}

export const reportService = new ReportService();
