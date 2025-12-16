import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface DateRangeParams {
  startDate?: Date;
  endDate?: Date;
}

interface SalesAnalytics {
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
    const { startDate, endDate, organizationId } = params;

    // Build where clause
    const where: Prisma.OrderWhereInput = {
      status: 'PAID',
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && {
        event: {
          organizationId,
        },
      }),
    };

    // Get orders with event data
    const orders = await prisma.order.findMany({
      where,
      include: {
        tickets: true,
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate totals
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const totalOrders = orders.length;
    const totalTicketsSold = orders.reduce((sum, order) => sum + order.tickets.length, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Group by day
    const salesByDayMap = new Map<string, { revenue: number; orders: number; tickets: number }>();
    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = salesByDayMap.get(dateKey) || { revenue: 0, orders: 0, tickets: 0 };
      salesByDayMap.set(dateKey, {
        revenue: existing.revenue + Number(order.totalAmount),
        orders: existing.orders + 1,
        tickets: existing.tickets + order.tickets.length,
      });
    });

    const salesByDay = Array.from(salesByDayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by event
    const salesByEventMap = new Map<
      string,
      { eventName: string; revenue: number; ticketsSold: number }
    >();
    orders.forEach((order) => {
      const eventId = order.event.id;
      const existing = salesByEventMap.get(eventId) || {
        eventName: order.event.name,
        revenue: 0,
        ticketsSold: 0,
      };
      salesByEventMap.set(eventId, {
        eventName: existing.eventName,
        revenue: existing.revenue + Number(order.totalAmount),
        ticketsSold: existing.ticketsSold + order.tickets.length,
      });
    });

    const salesByEvent = Array.from(salesByEventMap.entries())
      .map(([eventId, data]) => ({ eventId, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalOrders,
      totalTicketsSold,
      averageOrderValue,
      salesByDay,
      salesByEvent,
    };
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(
    params: DateRangeParams & { organizationId?: string }
  ): Promise<EventAnalytics> {
    const { startDate, endDate, organizationId } = params;

    const where: Prisma.EventWhereInput = {
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(organizationId && { organizationId }),
    };

    // Get event counts by status
    const [totalEvents, events, eventsByStatus] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        include: {
          tickets: {
            where: {
              status: { in: ['VALID', 'USED', 'TRANSFERRED'] },
            },
          },
          orders: {
            where: {
              status: 'PAID',
            },
          },
        },
      }),
      prisma.event.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    const publishedEvents = events.filter((e) => e.status === 'PUBLISHED').length;
    const draftEvents = events.filter((e) => e.status === 'DRAFT').length;
    const cancelledEvents = events.filter((e) => e.status === 'CANCELLED').length;
    const soldOutEvents = events.filter((e) => e.status === 'SOLD_OUT').length;

    // Calculate top events by revenue and tickets sold
    const eventsWithMetrics = events.map((event) => ({
      id: event.id,
      name: event.name,
      ticketsSold: event.tickets.length,
      revenue: event.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
    }));

    const topEvents = eventsWithMetrics.sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    return {
      totalEvents,
      publishedEvents,
      draftEvents,
      cancelledEvents,
      soldOutEvents,
      eventsByStatus: eventsByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      topEvents,
    };
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(
    params: DateRangeParams & { organizationId?: string }
  ): Promise<CustomerAnalytics> {
    const { startDate, endDate, organizationId } = params;

    // Get all customers
    const totalCustomers = await prisma.user.count({
      where: {
        role: 'CUSTOMER',
      },
    });

    // Get new customers in period
    const newCustomersInPeriod = await prisma.user.count({
      where: {
        role: 'CUSTOMER',
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
    });

    // Get customers with orders
    const customersWithOrders = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        orders: {
          some: {
            status: 'PAID',
            ...(organizationId && {
              event: {
                organizationId,
              },
            }),
          },
        },
      },
      include: {
        orders: {
          where: {
            status: 'PAID',
            ...(organizationId && {
              event: {
                organizationId,
              },
            }),
          },
        },
      },
    });

    // Calculate repeat customers (more than 1 order)
    const repeatCustomers = customersWithOrders.filter(
      (customer) => customer.orders.length > 1
    ).length;

    // Calculate top customers
    const topCustomers = customersWithOrders
      .map((customer) => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
        totalOrders: customer.orders.length,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Get customers by registration date
    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
      select: {
        createdAt: true,
      },
    });

    const customersByDateMap = new Map<string, number>();
    customers.forEach((customer) => {
      const dateKey = customer.createdAt.toISOString().split('T')[0];
      customersByDateMap.set(dateKey, (customersByDateMap.get(dateKey) || 0) + 1);
    });

    const customersByRegistrationDate = Array.from(customersByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCustomers,
      newCustomersInPeriod,
      repeatCustomers,
      topCustomers,
      customersByRegistrationDate,
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
