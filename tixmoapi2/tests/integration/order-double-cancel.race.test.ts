// Task 115 real-read reproduction; task 118 guards the cancellation transition.
// Timeouts below bound harness failures; they never choose operation ordering.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function bounded(promise: Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try { await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Barrier timeout (harness failure)')), 5000);
  })]); } finally { if (timer) clearTimeout(timer); }
}

afterAll(async () => { await prisma.$disconnect(); });
test.each([false, true])('overlapping cancel applies inventory once and preserves another pending hold (reverse release=%s)', async reverseSchedule => {
  const key = `race115-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'Race', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 6, quantityHeld: 4 } });
  const makeOrder = (suffix: string) => prisma.order.create({ data: { orderNumber: `${key}-${suffix}`, userId: user.id, eventId: event.id, totalAmount: 20,
    tickets: { create: [0, 1].map(i => ({ eventId: event.id, userId: user.id, ticketTypeId: type.id, barcode: `${key}-${suffix}-${i}`, pricePaid: 10 })) } }, include: { tickets: { orderBy: { id: 'asc' } } } });
  const target = await makeOrder('a');
  const otherBefore = await makeOrder('b');
  const original = prisma.order.findFirst.bind(prisma.order);
  const arrived = [deferred(), deferred()];
  const release = [deferred(), deferred()];
  const trace: string[] = [];
  let reads = 0;
  const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementation((async (args: any) => {
    // Bind the gate to invocation order, never database completion order.
    const index = args.where.id === target.id && reads < 2 ? reads++ : -1;
    // Force query 1 to complete before query 0 without sleeps or fake results.
    if (reverseSchedule && index === 0) await bounded(arrived[1].promise);
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
  const first = service.cancelOrder(target.id);
  const second = service.cancelOrder(target.id);
  // Attach rejection handlers immediately; gate failures cannot become unhandled.
  const outcomes = Promise.allSettled([first, second]);
  try {
    await bounded(Promise.all(arrived.map(g => g.promise)));
    if (reverseSchedule) expect(trace).toEqual(['read-1-PENDING', 'read-0-PENDING']);
    const winnerIndex = reverseSchedule ? 1 : 0;
    const loserIndex = 1 - winnerIndex;
    release[winnerIndex].resolve();
    await [first, second][winnerIndex];
    trace.push(`call-${winnerIndex}-committed`);
    release[loserIndex].resolve();
    const settled = await outcomes;
    trace.push('both-settled');
    spy.mockRestore();
    const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
    const a = await prisma.order.findUniqueOrThrow({ where: { id: target.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const b = await prisma.order.findUniqueOrThrow({ where: { id: otherBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const counters = [inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold];
    console.log('TASK115_OBSERVED', JSON.stringify({ trace, outcomes: settled.map(r => r.status), counters, target: a.status, payment: a.paymentStatus, other: b.status, ticketStates: a.tickets.map(t => t.status) }));
    expect(reads).toBe(2);
    expect(counters.every(n => n >= 0)).toBe(true);
    expect(counters.reduce((sum, n) => sum + n, 0)).toBe(10);
    expect(b).toEqual(otherBefore);
    expect(a.status).toBe('CANCELLED');
    expect(a.paymentStatus).toBe(target.paymentStatus);
    expect(a.tickets).toEqual(target.tickets.map(ticket => ({ ...ticket, status: 'CANCELLED', updatedAt: expect.any(Date) })));
    expect(counters).toEqual([8, 2, 0]);
    expect(settled[winnerIndex].status).toBe('fulfilled');
    expect(settled[loserIndex].status).toBe('rejected');
    expect(settled.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter(r => r.status === 'rejected')).toHaveLength(1);
    const loser = settled.find(r => r.status === 'rejected');
    if (loser?.status === 'rejected') expect(loser.reason).toMatchObject({ statusCode: 400 });
  } finally {
    release.forEach(g => g.resolve());
    await outcomes;
    spy.mockRestore();
  }
}, 20000);


test('inconsistent hold rolls back cancellation claim and leaves tickets and inventory unchanged', async () => {
  const key = `rollback118-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'Rollback', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 10, quantityHeld: 0 } });
  const before = await prisma.order.create({ data: { orderNumber: key, userId: user.id, eventId: event.id, totalAmount: 10,
    tickets: { create: [{ eventId: event.id, userId: user.id, ticketTypeId: type.id, barcode: key, pricePaid: 10 }] } }, include: { tickets: true } });
  await expect(new OrderService().cancelOrder(before.id)).rejects.toMatchObject({ statusCode: 500, message: 'Order inventory hold is inconsistent' });
  expect(await prisma.order.findUniqueOrThrow({ where: { id: before.id }, include: { tickets: true } })).toEqual(before);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
});

test.each(['PAID', 'PROCESSING'] as const)('stale cancellation cannot overwrite concurrent %s transition', async change => {
  const key = `stale118-${change}-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'Stale', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 9, quantityHeld: 1 } });
  const order = await prisma.order.create({ data: { orderNumber: key, userId: user.id, eventId: event.id, totalAmount: 10,
    tickets: { create: [{ eventId: event.id, userId: user.id, ticketTypeId: type.id, barcode: key, pricePaid: 10 }] } }, include: { tickets: true } });
  const original = prisma.order.findFirst.bind(prisma.order);
  let changed: unknown;
  const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementationOnce((async (args: any) => {
    const snapshot = await original(args);
    // Actual concurrent persisted transition after the real pending snapshot.
    changed = await prisma.order.update({ where: { id: order.id },
      data: change === 'PAID' ? { status: 'PAID', paymentStatus: 'SUCCEEDED' } : { paymentStatus: 'PROCESSING' }, include: { tickets: true } });
    return snapshot;
  }) as any);
  try {
    await expect(new OrderService().cancelOrder(order.id)).rejects.toMatchObject({ statusCode: 400 });
  } finally { spy.mockRestore(); }
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: true } })).toEqual(changed);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
});
