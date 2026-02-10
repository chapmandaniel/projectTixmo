import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

import prisma from '../../config/prisma';

interface SalesReportParams {
  organizationId?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'event';
}

interface AttendanceReportParams {
  eventId: string;
}

interface DashboardStatsParams {
  organizationId?: string;
}

export class ReportService {
  /**
   * Get sales report
   */
  async getSalesReport(params: SalesReportParams) {
    const { organizationId, eventId, startDate, endDate, groupBy = 'day' } = params;

    const where: Prisma.OrderWhereInput = {
      status: 'PAID',
    };

    if (organizationId) {
      // Find events for this org first
      const events = await prisma.event.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const eventIds = events.map((e) => e.id);

      // Orders don't have organizationId directly, but tickets do (via event)
      // Actually, Order has no direct link to Event/Org except through items -> TicketType -> Event
      // This makes querying tricky without raw SQL or complex joins.
      // For simplicity in this phase, let's assume we filter by eventId if provided,
      // or if organizationId is provided, we find all orders containing tickets for that org's events.

      // Optimization: If we have eventIds, we can filter orders that have tickets with ticketTypes in those events.
      where.tickets = {
        some: {
          ticketType: {
            eventId: { in: eventIds },
          },
        },
      };
    }

    if (eventId) {
      where.tickets = {
        some: {
          ticketType: {
            eventId,
          },
        },
      };
    }

    if (startDate) {
      where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), lte: new Date(endDate) };
    }

    // Aggregate data
    const orders = await prisma.order.findMany({
      where,
      include: {
        tickets: {
          include: {
            ticketType: {
              select: {
                eventId: true,
                price: true,
                event: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Grouping logic
    const groupedData: Record<
      string,
      { date: string; revenue: number; ticketsSold: number; ordersCount: number }
    > = {};

    for (const order of orders) {
      let key = '';
      const date = new Date(order.createdAt);

      if (groupBy === 'event') {
        // If grouping by event, we need to split the order if it has tickets from multiple events (rare but possible)
        // For now, take the first ticket's event
        const eventName = order.tickets[0]?.ticketType?.event?.name || 'Unknown Event';
        key = eventName;
      } else {
        if (groupBy === 'day') key = date.toISOString().split('T')[0];
        else if (groupBy === 'month')
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        else if (groupBy === 'week') {
          const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
          key = firstDay.toISOString().split('T')[0];
        }
      }

      if (!groupedData[key]) {
        groupedData[key] = { date: key, revenue: 0, ticketsSold: 0, ordersCount: 0 };
      }

      groupedData[key].revenue += Number(order.totalAmount);
      groupedData[key].ordersCount += 1;
      groupedData[key].ticketsSold += order.tickets.length;
    }

    return Object.values(groupedData);
  }

  /**
   * Get attendance report
   */
  async getAttendanceReport(params: AttendanceReportParams) {
    const { eventId } = params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!event) {
      throw ApiError.notFound('Event not found');
    }

    // Get valid tickets count (sold)
    const ticketsSold = await prisma.ticket.count({
      where: {
        eventId,
        status: { in: ['VALID', 'USED'] },
      },
    });

    // Get checked in count
    const checkedIn = await prisma.ticket.count({
      where: {
        eventId,
        status: 'USED',
      },
    });

    // Get scan logs over time for check-in velocity
    const scanLogs = await prisma.scanLog.findMany({
      where: {
        eventId,
        scanType: 'ENTRY',
        success: true,
      },
      orderBy: { scannedAt: 'asc' },
    });

    // Group scans by hour
    const checkInsByHour: Record<string, number> = {};
    for (const log of scanLogs) {
      const hour = new Date(log.scannedAt).toISOString().substring(0, 13) + ':00:00.000Z';
      checkInsByHour[hour] = (checkInsByHour[hour] || 0) + 1;
    }

    return {
      eventName: event.name,
      totalCapacity: event.venueId
        ? (await prisma.venue.findUnique({ where: { id: event.venueId } }))?.capacity
        : 0,
      ticketsSold,
      checkedIn,
      attendanceRate: ticketsSold > 0 ? (checkedIn / ticketsSold) * 100 : 0,
      checkInsByHour: Object.entries(checkInsByHour).map(([time, count]) => ({ time, count })),
    };
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(params: DashboardStatsParams) {
    const { organizationId } = params;

    // Filter by org if provided
    const eventWhere: Prisma.EventWhereInput = organizationId ? { organizationId } : {};

    // 1. Total Revenue (Approximate via paid orders)
    // Need to filter orders by org events
    const orderWhere: Prisma.OrderWhereInput = { status: 'PAID' };
    if (organizationId) {
      const events = await prisma.event.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const eventIds = events.map((e) => e.id);
      orderWhere.tickets = { some: { ticketType: { eventId: { in: eventIds } } } };
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
    if (organizationId) {
      ticketWhere.event = { organizationId };
    }
    const totalTicketsSold = await prisma.ticket.count({ where: ticketWhere });

    // 3. Active Events
    const activeEvents = await prisma.event.count({
      where: {
        ...eventWhere,
        status: 'PUBLISHED',
        endDatetime: { gte: new Date() },
      },
    });

    // 4. Recent Sales (Last 5 orders)
    const recentOrders = await prisma.order.findMany({
      where: orderWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        tickets: {
          include: {
            ticketType: {
              select: { name: true, event: { select: { name: true } } },
            },
          },
        },
      },
    });

    return {
      totalRevenue,
      totalTicketsSold,
      activeEvents,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        customer: `${o.user.firstName} ${o.user.lastName}`,
        amount: o.totalAmount,
        date: o.createdAt,
        eventName: o.tickets[0]?.ticketType?.event?.name || 'Unknown',
      })),
    };
  }
}

export const reportService = new ReportService();
