jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
import { randomUUID } from 'crypto';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Harness deadline')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function fixture(paymentStatus: 'PENDING' | 'PROCESSING' = 'PENDING') {
  const key = randomUUID();
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const buyer = await prisma.user.create({
    data: {
      email: key + '@example.test',
      passwordHash: 'inert',
      firstName: 'Buyer',
      lastName: 'Fixture',
    },
  });
  const otherBuyer = await prisma.user.create({
    data: {
      email: key + '-other@example.test',
      passwordHash: 'inert',
      firstName: 'Other',
      lastName: 'Buyer',
    },
  });
  const event = await prisma.event.create({
    data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'ON_SALE' },
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
  const makeOrder = (userId: string, suffix: string) =>
    prisma.order.create({
      data: {
        orderNumber: key + suffix,
        userId,
        eventId: event.id,
        totalAmount: 20,
        currency: 'cad',
        paymentStatus,
        tickets: {
          create: [0, 1].map((i) => ({
            userId,
            eventId: event.id,
            ticketTypeId: type.id,
            barcode: key + suffix + i,
            pricePaid: 10,
          })),
        },
      },
    });
  const target = await makeOrder(buyer.id, 'target');
  const other = await makeOrder(otherBuyer.id, 'other');
  const snapshot = async () => ({
    target: await prisma.order.findUniqueOrThrow({
      where: { id: target.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    other: await prisma.order.findUniqueOrThrow({
      where: { id: other.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
  });
  return { target, buyer, otherBuyer, snapshot };
}
afterAll(() => prisma.$disconnect());

test.each(['PROCESSING', 'PAID'] as const)(
  'refuses committed %s transition after actual authorized public observation',
  async (change) => {
    const f = await fixture();
    const arrived = gate();
    const release = gate();
    const original = prisma.order.findFirst.bind(prisma.order);
    let gated = false;
    const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
      const row = await original(args);
      if (args.where.id === f.target.id && !gated) {
        gated = true;
        expect(row).toMatchObject({
          status: 'PENDING',
          paymentStatus: 'PENDING',
          userId: f.buyer.id,
        });
        arrived.resolve();
        await bounded(release.promise);
      }
      return row;
    }) as any);
    const result = new OrderService().cancelOrder(f.target.id, f.buyer.id, f.buyer.id);
    const settled = Promise.allSettled([result]);
    try {
      await bounded(arrived.promise);
      // Separate actual SQL transaction commits before the cancellation gets its lock.
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: f.target.id },
          data:
            change === 'PAID'
              ? { status: 'PAID', paymentStatus: 'SUCCEEDED' }
              : { paymentStatus: 'PROCESSING' },
        });
      });
      const afterMutation = await f.snapshot();
      release.resolve();
      await expect(result).rejects.toMatchObject({ statusCode: 400 });
      expect(await f.snapshot()).toEqual(afterMutation);
    } finally {
      release.resolve();
      await settled;
      spy.mockRestore();
    }
  }
);

test.each(['PENDING', 'PROCESSING'] as const)(
  'stable %s remains eligible and repeat cancellation is idempotent',
  async (paymentStatus) => {
    const f = await fixture(paymentStatus);
    const before = await f.snapshot();
    const service = new OrderService();
    await service.cancelOrder(f.target.id, f.buyer.id, f.buyer.id);
    const after = await f.snapshot();
    expect(after.target.status).toBe('CANCELLED');
    expect(after.target.paymentStatus).toBe(paymentStatus);
    expect(after.target.tickets).toEqual(
      before.target.tickets.map((ticket) => ({
        ...ticket,
        inventoryState: 'RELEASED',
        status: 'CANCELLED',
        updatedAt: expect.any(Date),
      }))
    );
    expect(after.other).toEqual(before.other);
    expect([
      after.stock.quantityAvailable,
      after.stock.quantityHeld,
      after.stock.quantitySold,
    ]).toEqual([8, 2, 0]);
    await service.cancelOrder(f.target.id, f.buyer.id, f.buyer.id);
    expect(await f.snapshot()).toEqual(after);
  }
);

test('scope denial cannot mutate another buyer', async () => {
  const f = await fixture();
  const before = await f.snapshot();
  await expect(
    new OrderService().cancelOrder(f.target.id, undefined, f.otherBuyer.id)
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(await f.snapshot()).toEqual(before);
});

test('inverse schedule holds an actual SQL lock before cancellation effects', async () => {
  const f = await fixture();
  const before = await f.snapshot();
  const service = new OrderService();
  const arrived = gate();
  const release = gate();
  const original = service.cancelOrderInTransaction.bind(service);
  const spy = jest
    .spyOn(service, 'cancelOrderInTransaction')
    .mockImplementation(async (...args) => {
      arrived.resolve();
      await bounded(release.promise);
      return original(...args);
    });
  const result = service.cancelOrder(f.target.id, f.buyer.id, f.buyer.id);
  const settled = Promise.allSettled([result]);
  try {
    await bounded(arrived.promise);
    // NOWAIT refusal proves the public transaction already owns the row lock.
    await expect(
      prisma.$transaction((tx) =>
        tx.$queryRawUnsafe('SELECT id FROM orders WHERE id = $1 FOR UPDATE NOWAIT', f.target.id)
      )
    ).rejects.toMatchObject({ code: 'P2010', meta: expect.objectContaining({ code: '55P03' }) });
    release.resolve();
    await result;
    await prisma.order.update({
      where: { id: f.target.id },
      data: { paymentStatus: 'PROCESSING' },
    });
    const after = await f.snapshot();
    expect(after.target).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PROCESSING' });
    expect(after.other).toEqual(before.other);
    expect([
      after.stock.quantityAvailable,
      after.stock.quantityHeld,
      after.stock.quantitySold,
    ]).toEqual([8, 2, 0]);
  } finally {
    release.resolve();
    await settled;
    spy.mockRestore();
  }
});

test('trusted transactional cancellation still releases expired holds', async () => {
  const f = await fixture('PROCESSING');
  const before = await f.snapshot();
  await prisma.order.update({ where: { id: f.target.id }, data: { expiresAt: new Date(0) } });
  await prisma.$transaction((tx) => new OrderService().cancelOrderInTransaction(tx, f.target.id));
  const after = await f.snapshot();
  expect(after.target.status).toBe('CANCELLED');
  expect(after.other).toEqual(before.other);
  expect([
    after.stock.quantityAvailable,
    after.stock.quantityHeld,
    after.stock.quantitySold,
  ]).toEqual([8, 2, 0]);
});
