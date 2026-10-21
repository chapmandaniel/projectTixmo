jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { eventService } from '../../src/api/events/service';
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
  const foreignEvent = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: key + 'foreign',
      slug: key + 'foreign',
      tags: [],
      status: 'ON_SALE',
    },
  });
  const foreignType = await prisma.ticketType.create({
    data: {
      eventId: foreignEvent.id,
      name: key + 'foreign',
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 8,
      quantityHeld: 2,
    },
  });
  const other = await prisma.order.create({
    data: {
      orderNumber: key + 'foreign',
      userId: otherBuyer.id,
      eventId: foreignEvent.id,
      totalAmount: 20,
      tickets: {
        create: [0, 1].map((i) => ({
          userId: otherBuyer.id,
          eventId: foreignEvent.id,
          ticketTypeId: foreignType.id,
          barcode: key + 'foreign' + i,
          pricePaid: 10,
        })),
      },
    },
  });
  await prisma.ticketType.update({
    where: { id: type.id },
    data: { quantityAvailable: 8, quantityHeld: 2 },
  });
  const snapshot = async () => ({
    event: await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
    foreignEvent: await prisma.event.findUniqueOrThrow({ where: { id: foreignEvent.id } }),
    foreignStock: await prisma.ticketType.findUniqueOrThrow({ where: { id: foreignType.id } }),
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
  return { event, target, buyer, otherBuyer, snapshot };
}
afterAll(() => prisma.$disconnect());

// SQL qualification PREPARED ONLY: do not infer a runtime pass from source review.
test('event cancellation propagates stale refusal and stable reentry releases once', async () => {
  const f = await fixture();
  const before = await f.snapshot();
  const arrived = gate();
  const release = gate();
  const original = prisma.order.findFirst.bind(prisma.order);
  let gated = false;
  const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
    const row = await original(args);
    if (args.where.id === f.target.id && !gated) {
      gated = true;
      expect(row).toMatchObject({ status: 'PENDING', paymentStatus: 'PENDING' });
      arrived.resolve();
      await bounded(release.promise);
    }
    return row;
  }) as any);
  const result = eventService.cancelEvent(f.event.id);
  const settled = Promise.allSettled([result]);
  try {
    await bounded(arrived.promise);
    const atObservation = await f.snapshot();
    expect(atObservation.event.status).toBe('CANCELLED');
    expect(atObservation.target).toEqual(before.target);
    expect(atObservation.stock).toEqual(before.stock);
    await prisma.$transaction((tx) =>
      tx.order.update({ where: { id: f.target.id }, data: { paymentStatus: 'PROCESSING' } })
    );
    const afterMutation = await f.snapshot();
    release.resolve();
    await expect(result).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot cancel order that has changed',
    });
    const afterFailure = await f.snapshot();
    expect(afterFailure).toEqual(afterMutation);
    spy.mockRestore();
    await eventService.cancelEvent(f.event.id);
    const recovered = await f.snapshot();
    expect(recovered.event.status).toBe('CANCELLED');
    expect(recovered.target).toEqual({
      ...afterFailure.target,
      status: 'CANCELLED',
      updatedAt: expect.any(Date),
      tickets: afterFailure.target.tickets.map((t) => ({
        ...t,
        status: 'CANCELLED',
        inventoryState: 'RELEASED',
        updatedAt: expect.any(Date),
      })),
    });
    expect(recovered.stock).toEqual({
      ...before.stock,
      quantityAvailable: 10,
      quantityHeld: 0,
      updatedAt: expect.any(Date),
    });
    for (const snapshot of [atObservation, afterMutation, afterFailure, recovered]) {
      expect(snapshot.other).toEqual(before.other);
      expect(snapshot.foreignEvent).toEqual(before.foreignEvent);
      expect(snapshot.foreignStock).toEqual(before.foreignStock);
    }
    await eventService.cancelEvent(f.event.id);
    const replay = await f.snapshot();
    // Event update can refresh updatedAt even on reentry; all order/inventory effects remain identical.
    expect({ ...replay, event: { ...replay.event, updatedAt: recovered.event.updatedAt } }).toEqual(
      recovered
    );
    console.log(
      'TASK341_SNAPSHOTS',
      JSON.stringify({
        before,
        atObservation,
        afterMutation,
        afterFailure,
        recovered,
        replay,
        error: { statusCode: 400, message: 'Cannot cancel order that has changed' },
      })
    );
  } finally {
    release.resolve();
    await settled;
    spy.mockRestore();
  }
}, 20000);
