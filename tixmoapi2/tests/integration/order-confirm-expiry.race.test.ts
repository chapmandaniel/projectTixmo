jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { startOrderExpiryJob, stopOrderExpiryJob } from '../../src/jobs/order-expiry.job';
import { OrderService } from '../../src/api/orders/service';

afterAll(async () => {
  await prisma.$disconnect();
});

async function fixture(expired: boolean) {
  const key = `expiry-${randomUUID()}`;
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
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 6,
      quantityHeld: 4,
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
  const target = await reserve('target', new Date(Date.now() + (expired ? -60000 : 60000)));
  const other = await reserve('other', new Date(Date.now() + 60000));
  return { target, other, type };
}

function expiryTick() {
  let tick!: () => Promise<void>;
  const timer = jest.spyOn(global, 'setInterval').mockImplementation(((
    callback: () => Promise<void>,
    delay: number
  ) => {
    expect(delay).toBe(60000);
    tick = callback;
    return {} as NodeJS.Timeout;
  }) as any);
  try {
    startOrderExpiryJob();
    stopOrderExpiryJob();
  } finally {
    timer.mockRestore();
  }
  return tick;
}

test.each([false, true])(
  'expired reservations never fulfill when confirmation/expiry overlap (expiry starts first=%s)',
  async (reverse) => {
    const { target, other, type } = await fixture(true);
    const tick = expiryTick();
    const confirm = () => new OrderService().confirmOrder(target.id);
    const outcomes = await Promise.allSettled(reverse ? [tick(), confirm()] : [confirm(), tick()]);
    expect(outcomes[reverse ? 1 : 0]).toMatchObject({
      status: 'rejected',
      reason: { statusCode: 409 },
    });
    const actual = await prisma.order.findUniqueOrThrow({
      where: { id: target.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    });
    expect(actual).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PENDING' });
    expect(actual.tickets).toEqual(
      target.tickets.map((ticket) => ({
        ...ticket,
        status: 'CANCELLED',
        inventoryState: 'RELEASED',
        updatedAt: expect.any(Date),
      }))
    );
    expect(
      await prisma.order.findUniqueOrThrow({
        where: { id: other.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      })
    ).toEqual(other);
    const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([
      8, 2, 0,
    ]);
  }
);

test('confirmation before expiry stays paid when the real expiry job later runs', async () => {
  const { target, other, type } = await fixture(false);
  await new OrderService().confirmOrder(target.id);
  await prisma.order.update({ where: { id: target.id }, data: { expiresAt: new Date(0) } });
  await expiryTick()();
  expect(await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
  });
  expect(
    await prisma.order.findUniqueOrThrow({
      where: { id: other.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    })
  ).toEqual(other);
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold]).toEqual([
    6, 2, 2,
  ]);
});
