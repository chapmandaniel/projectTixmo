jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));

import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';

afterAll(async () => {
  await prisma.$disconnect();
});

test('expiry claims treat Prisma expiresAt as UTC when the session TimeZone is not UTC', async () => {
  const key = `expiry-tz-${randomUUID()}`;
  const organization = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'test-only',
      firstName: 'Expiry',
      lastName: 'Timezone',
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
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 2,
      quantityAvailable: 0,
      quantityHeld: 2,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: key,
      userId: user.id,
      eventId: event.id,
      totalAmount: 20,
      currency: 'cad',
      expiresAt: new Date(Date.now() - 60_000),
      tickets: {
        create: [0, 1].map((i) => ({
          eventId: event.id,
          userId: user.id,
          ticketTypeId: type.id,
          barcode: `${key}-${i}`,
          pricePaid: 10,
          inventoryState: 'HELD',
        })),
      },
    },
  });

  const comparison = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone', 'America/St_Johns', true)`;
    const rows = await tx.$queryRaw<Array<{ naive_now: boolean; utc_now: boolean }>>`
      SELECT
        expires_at < NOW() AS naive_now,
        expires_at < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS utc_now
      FROM orders
      WHERE id = ${order.id}
    `;
    return rows[0];
  });
  expect(comparison).toEqual({ naive_now: false, utc_now: true });

  const others = (
    await prisma.order.findMany({
      where: { id: { not: order.id }, status: 'PENDING' },
      select: { id: true },
    })
  ).map((row) => row.id);

  const originalTransaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = ((
    arg: Parameters<typeof prisma.$transaction>[0],
    options?: Parameters<typeof prisma.$transaction>[1]
  ) => {
    if (typeof arg !== 'function') return originalTransaction(arg, options);
    return originalTransaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('TimeZone', 'America/St_Johns', true)`;
      return arg(tx);
    }, options);
  }) as typeof prisma.$transaction;
  try {
    await expect(orderService.claimNextExpiredOrder(others)).resolves.toMatchObject({
      status: 'cancelled',
      id: order.id,
    });
  } finally {
    prisma.$transaction = originalTransaction;
  }

  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
    status: 'CANCELLED',
    paymentStatus: 'PENDING',
  });
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([
    2, 0, 0,
  ]);
});
