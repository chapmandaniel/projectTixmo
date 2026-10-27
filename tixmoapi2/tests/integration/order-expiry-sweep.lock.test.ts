jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));

import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { logger } from '../../src/config/logger';
import { orderService } from '../../src/api/orders/service';
import { sweepExpiredOrders } from '../../src/jobs/order-expiry.job';

afterAll(async () => {
  await prisma.$disconnect();
});

async function fixture(expiredCount: number) {
  const key = `sweep-${randomUUID()}`;
  const organization = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'test-only',
      firstName: 'Expiry',
      lastName: 'Fixture',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: key,
      slug: key,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 86400000),
    },
  });
  const ticketsPerOrder = 2;
  const orderCount = expiredCount + 1;
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: orderCount * ticketsPerOrder,
      quantityAvailable: 0,
      quantityHeld: orderCount * ticketsPerOrder,
    },
  });
  const reserve = (suffix: string, expiresAt: Date) =>
    prisma.order.create({
      data: {
        orderNumber: `${key}-${suffix}`,
        userId: user.id,
        eventId: event.id,
        totalAmount: 20,
        currency: 'cad',
        expiresAt,
        tickets: {
          create: [0, 1].map((i) => ({
            eventId: event.id,
            userId: user.id,
            ticketTypeId: type.id,
            barcode: `${key}-${suffix}-${i}`,
            pricePaid: 10,
            inventoryState: 'HELD',
          })),
        },
      },
      include: { tickets: { orderBy: { id: 'asc' } } },
    });
  const expired = [];
  for (let index = 0; index < expiredCount; index += 1) {
    expired.push(await reserve(`expired-${index}`, new Date(1_000 + index)));
  }
  const live = await reserve('live', new Date(Date.now() + 60_000));
  return { expired, live, type, key };
}

test('two sweeps cancel each expired order once and release its inventory once', async () => {
  const { expired, live, type } = await fixture(4);
  const ours = new Set(expired.map((order) => order.id));
  const intruders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
      id: { notIn: [...ours] },
    },
    select: { id: true, expiresAt: true },
  });
  if (intruders.length) {
    await prisma.order.updateMany({
      where: { id: { in: intruders.map((order) => order.id) } },
      data: { expiresAt: new Date(Date.now() + 3_600_000) },
    });
  }

  let release!: () => void;
  const releaseLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked!: () => void;
  const lockHeld = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const oldest = expired[0];
  const holder = prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${oldest.id}, 0)) AS locked
    `;
    expect(rows[0]?.locked).toBe(true);
    locked();
    await releaseLock;
  });

  const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
  try {
    await lockHeld;
    const skipped = await orderService.claimNextExpiredOrder();
    expect(skipped).toMatchObject({ status: 'skipped', id: oldest.id });
    const claimed = await orderService.claimNextExpiredOrder([oldest.id]);
    expect(claimed.status).toBe('cancelled');
    if (claimed.status !== 'cancelled') throw new Error('expected a claimed order');
    expect(claimed.id).not.toBe(oldest.id);
    expect(ours.has(claimed.id)).toBe(true);

    release();
    await holder;

    const [left, right] = await Promise.all([sweepExpiredOrders(), sweepExpiredOrders()]);
    const swept = [...left, ...right];
    const sweptOurs = swept.filter((orderNumber) =>
      expired.some((order) => order.orderNumber === orderNumber)
    );
    expect(new Set(sweptOurs).size).toBe(sweptOurs.length);
    expect(sweptOurs.sort()).toEqual(
      expired
        .filter((order) => order.id !== claimed.id)
        .map((order) => order.orderNumber)
        .sort()
    );
    const cancelledLines = info.mock.calls
      .map((call) => (typeof call[0] === 'string' ? call[0] : ''))
      .filter((line) => line.includes('Cancelled expired order'));
    expect(cancelledLines.filter((line) => line.includes(claimed.orderNumber))).toHaveLength(0);
    for (const order of expired.filter((order) => order.id !== claimed.id)) {
      expect(cancelledLines.filter((line) => line.includes(order.orderNumber))).toEqual([
        `  ✓ Cancelled expired order ${order.orderNumber}`,
      ]);
    }
  } finally {
    release?.();
    await holder.catch(() => undefined);
    info.mockRestore();
    if (intruders.length) {
      await prisma.$transaction(
        intruders.map((order) =>
          prisma.order.update({ where: { id: order.id }, data: { expiresAt: order.expiresAt } })
        )
      );
    }
  }

  const stored = await prisma.order.findMany({
    where: { id: { in: expired.map((order) => order.id) } },
    include: { tickets: true },
  });
  expect(stored).toHaveLength(expired.length);
  for (const order of stored) {
    expect(order.status).toBe('CANCELLED');
    expect(order.tickets.map((ticket) => ticket.inventoryState).sort()).toEqual([
      'RELEASED',
      'RELEASED',
    ]);
  }
  expect(
    await prisma.order.findUniqueOrThrow({
      where: { id: live.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    })
  ).toEqual(live);
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([
    8, 2, 0,
  ]);
});
