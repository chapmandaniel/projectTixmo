jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { randomUUID } from 'crypto';
import { Order } from '@prisma/client';
import prisma from '../../src/config/prisma';
import { orderService } from '../../src/api/orders/service';
import { logger } from '../../src/config/logger';
import { startOrderExpiryJob, stopOrderExpiryJob } from '../../src/jobs/order-expiry.job';
const FakeTimers = require('@sinonjs/fake-timers');
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded<T>(p: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Harness deadline')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
const base = Date.parse('2030-06-01T12:00:00Z');
async function fixture() {
  const key = randomUUID();
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const users = await Promise.all(
    [0, 1].map((i) =>
      prisma.user.create({
        data: {
          email: key + i + '@example.test',
          passwordHash: 'inert',
          firstName: 'Buyer',
          lastName: 'Fixture',
        },
      })
    )
  );
  const event = await prisma.event.create({
    data: { name: key, slug: key, organizationId: org.id, tags: [], status: 'ON_SALE' },
  });
  const stock = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 6,
      quantityHeld: 4,
    },
  });
  const orders: Order[] = [];
  for (const [i, user] of users.entries())
    orders.push(
      await prisma.order.create({
        data: {
          orderNumber: key + i,
          userId: user.id,
          eventId: event.id,
          totalAmount: 20,
          expiresAt: new Date(i === 0 ? base + 1000 : Date.parse('2050-01-01T00:00:00Z')),
          tickets: {
            create: [0, 1].map((n) => ({
              userId: user.id,
              eventId: event.id,
              ticketTypeId: stock.id,
              barcode: key + i + n,
              pricePaid: 10,
            })),
          },
        },
      })
    );
  const snapshot = async () => ({
    target: await prisma.order.findUniqueOrThrow({
      where: { id: orders[0].id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    other: await prisma.order.findUniqueOrThrow({
      where: { id: orders[1].id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: stock.id } }),
  });
  return { target: orders[0], snapshot };
}
function jobTick() {
  let tick!: () => Promise<void>;
  const timer = jest.spyOn(global, 'setInterval').mockImplementation(((
    callback: () => Promise<void>,
    delay: number
  ) => {
    expect(delay).toBe(60000);
    tick = callback;
    return {} as NodeJS.Timeout;
  }) as any);
  startOrderExpiryJob();
  stopOrderExpiryJob();
  timer.mockRestore();
  return tick;
}
afterAll(() => prisma.$disconnect());

test('confirmation commits before expiry; actual later job does not cancel paid order', async () => {
  const clock = FakeTimers.install({ now: base, toFake: ['Date'] });
  try {
    const f = await fixture();
    const before = await f.snapshot();
    await orderService.confirmOrder(f.target.id);
    const paid = await f.snapshot();
    expect(paid.target).toMatchObject({ status: 'PAID', paymentStatus: 'SUCCEEDED' });
    expect(paid.target.tickets).toEqual(
      before.target.tickets.map((t) => ({
        ...t,
        inventoryState: 'SOLD',
        updatedAt: expect.any(Date),
      }))
    );
    expect(paid.other).toEqual(before.other);
    expect([
      paid.stock.quantityAvailable,
      paid.stock.quantityHeld,
      paid.stock.quantitySold,
    ]).toEqual([6, 2, 2]);
    clock.setSystemTime(base + 2000);
    await jobTick()();
    expect(await f.snapshot()).toEqual(paid);
  } finally {
    stopOrderExpiryJob();
    clock.uninstall();
  }
});

test.each([
  [0, false],
  [0, true],
  [1, false],
  [1, true],
] as const)(
  'after actual expiry confirm refuses, job releases once (first=%s reverse reads=%s)',
  async (firstIndex, reverseReads) => {
    const clock = FakeTimers.install({ now: base, toFake: ['Date'] });
    const releases = [gate(), gate()];
    const arrived = [gate(), gate()];
    let spy: jest.SpyInstance | undefined;
    let outcomes: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      const f = await fixture();
      const before = await f.snapshot();
      clock.setSystemTime(base + 2000);
      const original = prisma.order.findFirst.bind(prisma.order);
      let reads = 0;
      const trace: string[] = [];
      spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
        const index = args.where.id === f.target.id && reads < 2 ? reads++ : -1;
        if (reverseReads && index === 0) await bounded(arrived[1].promise);
        const row = await original(args);
        if (index >= 0) {
          expect(row?.status).toBe('PENDING');
          trace.push('read' + index);
          arrived[index].resolve();
          await bounded(releases[index].promise);
        }
        return row;
      }) as any);
      jest.mocked(logger.error).mockClear();
      const confirm = orderService.confirmOrder(f.target.id);
      const expiry = jobTick()();
      outcomes = Promise.allSettled([confirm, expiry]);
      await bounded(Promise.all(arrived.map((x) => x.promise)));
      expect(trace).toEqual(reverseReads ? ['read1', 'read0'] : ['read0', 'read1']);
      releases[firstIndex].resolve();
      await Promise.allSettled([[confirm, expiry][firstIndex]]);
      releases[1 - firstIndex].resolve();
      const results = await outcomes;
      expect(results[0]).toMatchObject({
        status: 'rejected',
        reason: { statusCode: 409, message: 'Order can no longer be fulfilled' },
      });
      expect(results[1].status).toBe('fulfilled');
      expect(logger.error).not.toHaveBeenCalled();
      const after = await f.snapshot();
      expect(after.target).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PENDING' });
      expect(after.target.tickets).toEqual(
        before.target.tickets.map((t) => ({
          ...t,
          status: 'CANCELLED',
          inventoryState: 'RELEASED',
          updatedAt: expect.any(Date),
        }))
      );
      expect(after.other).toEqual(before.other);
      expect([
        after.stock.quantityAvailable,
        after.stock.quantityHeld,
        after.stock.quantitySold,
      ]).toEqual([8, 2, 0]);
      await jobTick()();
      expect(await f.snapshot()).toEqual(after);
    } finally {
      releases.forEach((x) => x.resolve());
      if (outcomes) await outcomes;
      spy?.mockRestore();
      stopOrderExpiryJob();
      clock.uninstall();
    }
  },
  20000
);

test('actual expiry job logs stale payment refusal and retries safely on the next scan', async () => {
  const clock = FakeTimers.install({ now: base, toFake: ['Date'] });
  let spy: jest.SpyInstance | undefined;
  try {
    const f = await fixture();
    const before = await f.snapshot();
    clock.setSystemTime(base + 2000);
    const original = prisma.order.findFirst.bind(prisma.order);
    let changed = false;
    let afterMutation: unknown;
    spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
      const observed = await original(args);
      if (args.where.id === f.target.id && !changed) {
        changed = true;
        expect(observed).toMatchObject({ status: 'PENDING', paymentStatus: 'PENDING' });
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: f.target.id },
            data: { paymentStatus: 'PROCESSING' },
          });
        });
        afterMutation = await f.snapshot();
      }
      return observed;
    }) as any);
    jest.mocked(logger.error).mockClear();
    await jobTick()();
    expect(changed).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to cancel order'),
      expect.objectContaining({ statusCode: 400, message: 'Cannot cancel order that has changed' })
    );
    expect(await f.snapshot()).toEqual(afterMutation);
    spy.mockRestore();
    spy = undefined;
    jest.mocked(logger.error).mockClear();
    await jobTick()();
    const after = await f.snapshot();
    expect(after.target).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PROCESSING' });
    expect(after.target.tickets).toEqual(
      before.target.tickets.map((ticket) => ({
        ...ticket,
        status: 'CANCELLED',
        inventoryState: 'RELEASED',
        updatedAt: expect.any(Date),
      }))
    );
    expect(after.other).toEqual(before.other);
    expect([
      after.stock.quantityAvailable,
      after.stock.quantityHeld,
      after.stock.quantitySold,
    ]).toEqual([8, 2, 0]);
    expect(logger.error).not.toHaveBeenCalled();
    await jobTick()();
    expect(await f.snapshot()).toEqual(after);
  } finally {
    spy?.mockRestore();
    stopOrderExpiryJob();
    clock.uninstall();
  }
});
