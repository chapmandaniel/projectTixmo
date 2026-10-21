import { Prisma } from '@prisma/client';

export function paidSalesSource(params: {
  organizationId?: string;
  eventId?: string;
  startDate?: Date;
  endDate?: Date;
  currency?: string;
}) {
  const conditions = [
    Prisma.sql`o.status = 'PAID'`,
    Prisma.sql`o.currency = ${(params.currency || 'cad').toLowerCase()}`,
  ];
  // Prisma stores DateTime as UTC-naive timestamp. Normalize only bound
  // instants, independent of session TimeZone, keeping the indexed column bare.
  if (params.startDate)
    conditions.push(
      Prisma.sql`o.created_at >= (${params.startDate}::timestamptz AT TIME ZONE 'UTC')`
    );
  if (params.endDate)
    conditions.push(
      Prisma.sql`o.created_at <= (${params.endDate}::timestamptz AT TIME ZONE 'UTC')`
    );
  if (params.eventId) conditions.push(Prisma.sql`o.event_id = ${params.eventId}`);
  if (params.organizationId)
    conditions.push(Prisma.sql`e.organization_id = ${params.organizationId}`);
  // One scoped ticket aggregation, rather than a table scan for every order.
  return Prisma.sql`WITH scoped_orders AS (
    SELECT o.id, o.event_id, o.created_at, o.total_amount, e.name AS event_name
    FROM orders o JOIN events e ON e.id = o.event_id
    WHERE ${Prisma.join(conditions, ' AND ')}
  ), ticket_counts AS (
    SELECT t.order_id, COUNT(*) AS tickets
    FROM tickets t JOIN scoped_orders o ON o.id = t.order_id
    WHERE t.inventory_state = 'SOLD'
    GROUP BY t.order_id
  ), scoped AS (
    SELECT o.*, COALESCE(t.tickets, 0)::bigint AS tickets
    FROM scoped_orders o LEFT JOIN ticket_counts t ON t.order_id = o.id
  )`;
}
