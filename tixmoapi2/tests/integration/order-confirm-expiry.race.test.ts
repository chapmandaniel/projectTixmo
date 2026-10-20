jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { startOrderExpiryJob, stopOrderExpiryJob } from '../../src/jobs/order-expiry.job';
import { logger } from '../../src/config/logger';
import { OrderService } from '../../src/api/orders/service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function bounded(promise: Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});
test.each([
  [0, false],
  [0, true],
  [1, false],
  [1, true],
] as const)(
  'confirm versus actual expiry job preserves single winner (winner=%s, reverse reads=%s)',
  async (winnerIndex, reverseReads) => {
    const key = `race128-${Date.now()}`;
    const org = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    const user = await prisma.user.create({
      data: {
        email: `${key}@example.test`,
        passwordHash: 'test-only',
        firstName: 'Race',
        lastName: 'Fixture',
      },
    });
    const event = await prisma.event.create({
      data: { organizationId: org.id, name: key, slug: key, tags: [] },
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
    const otherUser = await prisma.user.create({
      data: {
        email: `${key}-other@example.test`,
        passwordHash: 'test-only',
        firstName: 'Other',
        lastName: 'Buyer',
      },
    });
    const makeOrder = (suffix: string, buyer = user.id) =>
      prisma.order.create({
        data: {
          orderNumber: `${key}-${suffix}`,
          userId: buyer,
          eventId: event.id,
          totalAmount: 20,
          expiresAt: new Date(Date.now() + (suffix === 'a' ? -60000 : 60000)),
          tickets: {
            create: [0, 1].map((i) => ({
              eventId: event.id,
              userId: buyer,
              ticketTypeId: type.id,
              barcode: `${key}-${suffix}-${i}`,
              pricePaid: 10,
            })),
          },
        },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
    const target = await makeOrder('a');
    const otherBefore = await makeOrder('b', otherUser.id);
    const original = prisma.order.findFirst.bind(prisma.order);
    const arrived = [deferred(), deferred()];
    const release = [deferred(), deferred()];
    const trace: string[] = [];
    let reads = 0;
    const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
      // Bind the gate to invocation order, never database completion order.
      const index = args.where.id === target.id && reads < 2 ? reads++ : -1;
      // Force query 1 to complete before query 0 without sleeps or fake results.
      if (reverseReads && index === 0) await bounded(arrived[1].promise);
      const snapshot = await original(args);
      if (index >= 0) {
        expect(snapshot?.status).toBe('PENDING');
        trace.push(`read-${index}-PENDING`);
        arrived[index].resolve();
        await bounded(release[index].promise);
      }
      return snapshot;
    }) as any);
    const service = new OrderService();
    const selected = deferred();
    const releaseSelection = deferred();
    const originalMany = prisma.order.findMany.bind(prisma.order);
    const selectionSpy = jest.spyOn(prisma.order, 'findMany').mockImplementation((async (
      args: any
    ) => {
      const rows = await originalMany(args);
      expect(args).toMatchObject({
        where: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
        take: 50,
      });
      expect(rows.map((r: any) => r.id)).toContain(target.id);
      expect(rows.map((r: any) => r.id)).not.toContain(otherBefore.id);
      trace.push('expiry-selected');
      selected.resolve();
      await bounded(releaseSelection.promise);
      return rows;
    }) as any);
    let tick!: () => Promise<void>;
    const timerSpy = jest.spyOn(global, 'setInterval').mockImplementation(((
      callback: () => Promise<void>,
      delay: number
    ) => {
      expect(delay).toBe(60000);
      tick = callback;
      return {} as NodeJS.Timeout;
    }) as any);
    startOrderExpiryJob();
    stopOrderExpiryJob();
    timerSpy.mockRestore();
    jest.mocked(logger.error).mockClear();
    const second = tick();
    await bounded(selected.promise);
    const first = service.confirmOrder(target.id);
    releaseSelection.resolve();
    // Attach rejection handlers immediately; gate failures cannot become unhandled.
    const outcomes = Promise.allSettled([first, second]);
    try {
      await bounded(Promise.all(arrived.map((g) => g.promise)));
      if (reverseReads)
        expect(trace).toEqual(['expiry-selected', 'read-1-PENDING', 'read-0-PENDING']);
      const loserIndex = 1 - winnerIndex;
      release[winnerIndex].resolve();
      await [first, second][winnerIndex];
      trace.push(`call-${winnerIndex}-committed`);
      release[loserIndex].resolve();
      const settled = await outcomes;
      trace.push('both-settled');
      spy.mockRestore();
      const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
      const a = await prisma.order.findUniqueOrThrow({
        where: { id: target.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const b = await prisma.order.findUniqueOrThrow({
        where: { id: otherBefore.id },
        include: { tickets: { orderBy: { id: 'asc' } } },
      });
      const counters = [
        inventory.quantityAvailable,
        inventory.quantityHeld,
        inventory.quantitySold,
      ];
      console.log(
        'TASK128_OBSERVED',
        JSON.stringify({
          winnerIndex,
          reverseReads,
          trace,
          outcomes: settled.map((r) => r.status),
          counters,
          target: a.status,
          payment: a.paymentStatus,
          other: b.status,
          ticketStates: a.tickets.map((t) => t.status),
        })
      );
      expect(reads).toBe(2);
      expect(counters.every((n) => n >= 0)).toBe(true);
      expect(counters.reduce((sum, n) => sum + n, 0)).toBe(10);
      expect(b).toEqual(otherBefore);
      expect(a.status).toBe(winnerIndex === 0 ? 'PAID' : 'CANCELLED');
      expect(a.paymentStatus).toBe(winnerIndex === 0 ? 'SUCCEEDED' : 'PENDING');
      expect(a.tickets).toHaveLength(2);
      expect(b.tickets).toHaveLength(2);
      expect(await prisma.ticket.count({ where: { ticketTypeId: type.id } })).toBe(4);
      expect(a.tickets).toEqual(
        winnerIndex === 0
          ? target.tickets
          : target.tickets.map((ticket) => ({
              ...ticket,
              status: 'CANCELLED',
              updatedAt: expect.any(Date),
            }))
      );
      expect(counters).toEqual(winnerIndex === 0 ? [6, 2, 2] : [8, 2, 0]);
      expect(settled[winnerIndex].status).toBe('fulfilled');
      // The expiry job catches cancellation errors: its promise always fulfills.
      expect(settled[1].status).toBe('fulfilled');
      if (winnerIndex === 0) {
        expect(settled[0].status).toBe('fulfilled');
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to cancel order'),
          expect.objectContaining({
            statusCode: 400,
            message: 'Cannot cancel order that has changed',
          })
        );
      } else {
        expect(settled[0]).toMatchObject({
          status: 'rejected',
          reason: { statusCode: 400, message: 'Cannot confirm order that is no longer pending' },
        });
        expect(logger.error).not.toHaveBeenCalled();
      }
      const confirmation = settled[0];
      if (confirmation.status === 'fulfilled')
        expect(confirmation.value).toMatchObject({
          id: target.id,
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          tickets: expect.any(Array),
          event: expect.any(Object),
          user: expect.any(Object),
        });
    } finally {
      releaseSelection.resolve();
      selectionSpy.mockRestore();
      stopOrderExpiryJob();
      release.forEach((g) => g.resolve());
      await outcomes;
      spy.mockRestore();
    }
  },
  20000
);
