import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../src/config/prisma';
import { paidSalesSource } from '../../src/services/paid-sales-query';

const timezones = ['UTC', 'America/St_Johns'] as const;
afterAll(() => prisma.$disconnect());

async function inTimezone<T>(timezone: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    // Transaction-local only: pool/global/session defaults remain untouched.
    await tx.$queryRaw`SELECT set_config('TimeZone', ${timezone}, true)`;
    const settings = await tx.$queryRaw<
      Array<{ timezone: string }>
    >`SELECT current_setting('TimeZone') AS timezone`;
    expect(settings[0].timezone).toBe(timezone);
    return work(tx);
  });
}
async function fixture(tx: Prisma.TransactionClient, instants: Date[]) {
  const key = randomUUID();
  const organization = await tx.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const foreign = await tx.organization.create({
    data: { name: key + '-foreign', slug: key + '-foreign', type: 'PROMOTER' },
  });
  const event = await tx.event.create({
    data: { name: key, slug: key, organizationId: organization.id, tags: [] },
  });
  const otherEvent = await tx.event.create({
    data: { name: key + '-other', slug: key + '-other', organizationId: foreign.id, tags: [] },
  });
  const buyer = await tx.user.create({
    data: {
      email: key + '@example.test',
      passwordHash: 'inert',
      firstName: 'UTC',
      lastName: 'Fixture',
    },
  });
  const orders = [];
  for (const [i, createdAt] of instants.entries()) {
    orders.push(
      await tx.order.create({
        data: {
          orderNumber: key + i,
          userId: buyer.id,
          eventId: event.id,
          totalAmount: 10,
          currency: 'cad',
          status: 'PAID',
          createdAt,
        },
      })
    );
  }
  // Date inclusion must not broaden existing status/currency/tenant filters.
  for (const [i, override] of [
    { status: 'PENDING' as const },
    { currency: 'usd' },
    { eventId: otherEvent.id },
  ].entries()) {
    await tx.order.create({
      data: {
        orderNumber: key + '-excluded' + i,
        userId: buyer.id,
        eventId: event.id,
        totalAmount: 10,
        currency: 'cad',
        status: 'PAID',
        createdAt: instants[1],
        ...override,
      },
    });
  }
  return { orders, organization, event };
}
async function ids(tx: Prisma.TransactionClient, params: Parameters<typeof paidSalesSource>[0]) {
  const source = paidSalesSource(params);
  return (
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`${source} SELECT id FROM scoped ORDER BY id`
    )
  )
    .map((row) => row.id)
    .sort();
}

test.each(timezones)(
  'inclusive UTC instant bounds and millisecond exclusions in %s',
  async (timezone) => {
    await inTimezone(timezone, async (tx) => {
      const start = new Date('2026-10-21T08:00:00.000Z');
      const end = new Date('2026-10-21T09:00:00.000Z');
      const f = await fixture(tx, [
        new Date(start.getTime() - 1),
        start,
        end,
        new Date(end.getTime() + 1),
      ]);
      const scope = { organizationId: f.organization.id, eventId: f.event.id, currency: 'CAD' };
      expect(await ids(tx, { ...scope, startDate: start, endDate: end })).toEqual(
        [f.orders[1].id, f.orders[2].id].sort()
      );
      expect(await ids(tx, { ...scope, startDate: start, endDate: start })).toEqual([
        f.orders[1].id,
      ]);
      expect(await ids(tx, { ...scope, startDate: end, endDate: end })).toEqual([f.orders[2].id]);
      expect(await ids(tx, { ...scope, startDate: start })).toEqual(
        f.orders
          .slice(1)
          .map((order) => order.id)
          .sort()
      );
      expect(await ids(tx, { ...scope, endDate: end })).toEqual(
        f.orders
          .slice(0, 3)
          .map((order) => order.id)
          .sort()
      );
    });
  }
);

test.each(timezones)(
  'Newfoundland repeated 01:30 first/second instants stay distinct in %s',
  async (timezone) => {
    await inTimezone(timezone, async (tx) => {
      // Fall-back 2026-11-01: 01:30 NDT (-02:30) and 01:30 NST (-03:30).
      const first = new Date('2026-11-01T04:00:00.000Z');
      const second = new Date('2026-11-01T05:00:00.000Z');
      const wall = await tx.$queryRaw<
        Array<{ first: string; second: string }>
      >`SELECT to_char(${first}::timestamptz AT TIME ZONE 'America/St_Johns', 'YYYY-MM-DD HH24:MI') AS first, to_char(${second}::timestamptz AT TIME ZONE 'America/St_Johns', 'YYYY-MM-DD HH24:MI') AS second`;
      expect(wall).toEqual([{ first: '2026-11-01 01:30', second: '2026-11-01 01:30' }]);
      const f = await fixture(tx, [
        new Date(first.getTime() - 1),
        first,
        second,
        new Date(second.getTime() + 1),
      ]);
      const scope = { organizationId: f.organization.id, currency: 'cad' };
      expect(await ids(tx, { ...scope, startDate: first, endDate: first })).toEqual([
        f.orders[1].id,
      ]);
      expect(await ids(tx, { ...scope, startDate: second, endDate: second })).toEqual([
        f.orders[2].id,
      ]);
      expect(await ids(tx, { ...scope, startDate: first, endDate: second })).toEqual(
        [f.orders[1].id, f.orders[2].id].sort()
      );
    });
  }
);
