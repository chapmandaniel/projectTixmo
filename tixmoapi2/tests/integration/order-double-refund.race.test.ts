// Task 121: local bookkeeping only; no payment-provider call.
// Timeouts below bound harness failures; they never choose operation ordering.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import { Prisma } from '@prisma/client';
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
test.each([false, true])('overlapping refund applies inventory once and preserves other paid and pending buyers (reverse release=%s)', async reverseSchedule => {
  const key = `race121-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const users = await Promise.all(['target', 'paid', 'pending'].map(suffix => prisma.user.create({ data: { email: `${key}-${suffix}@example.test`, passwordHash: 'test-only', firstName: suffix, lastName: 'Fixture' } })));
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 4, quantityHeld: 2, quantitySold: 4 } });
  const makeOrder = (index: number, paid: boolean) => prisma.order.create({ data: { orderNumber: `${key}-${index}`, userId: users[index].id, eventId: event.id, totalAmount: 20,
    status: paid ? 'PAID' : 'PENDING', paymentStatus: paid ? 'SUCCEEDED' : 'PENDING',
    tickets: { create: [0, 1].map(i => ({ eventId: event.id, userId: users[index].id, ticketTypeId: type.id, barcode: `${key}-${index}-${i}`, pricePaid: 10 })) } }, include: { tickets: { orderBy: { id: 'asc' } } } });
  const target = await makeOrder(0, true);
  const paidBefore = await makeOrder(1, true);
  const pendingBefore = await makeOrder(2, false);
  expect(new Set([target.userId, paidBefore.userId, pendingBefore.userId]).size).toBe(3);
  expect([type.quantityAvailable, type.quantityHeld, type.quantitySold]).toEqual([4, 2, 4]);
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
    const snapshot = await original(args) as Prisma.OrderGetPayload<{ include: { tickets: true } }> | null;
    if (index >= 0) {
      expect(snapshot?.status).toBe('PAID');
      expect(snapshot?.tickets).toHaveLength(2);
      expect(snapshot?.tickets.every((t: any) => ['VALID', 'TRANSFERRED'].includes(t.status))).toBe(true);
      trace.push(`read-${index}-PAID`);
      arrived[index].resolve();
      await bounded(release[index].promise);
    }
    return snapshot;
  }) as any);
  const service = new OrderService();
  const first = service.refundOrder(target.id);
  const second = service.refundOrder(target.id);
  // Attach rejection handlers immediately; gate failures cannot become unhandled.
  const outcomes = Promise.allSettled([first, second]);
  try {
    await bounded(Promise.all(arrived.map(g => g.promise)));
    if (reverseSchedule) expect(trace).toEqual(['read-1-PAID', 'read-0-PAID']);
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
    const b = await prisma.order.findUniqueOrThrow({ where: { id: pendingBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: paidBefore.id }, include: { tickets: { orderBy: { id: 'asc' } } } });
    const counters = [inventory.quantityAvailable, inventory.quantityHeld, inventory.quantitySold];
    console.log('TASK121_OBSERVED', JSON.stringify({ trace, outcomes: settled.map(r => r.status), counters, target: a.status, payment: a.paymentStatus, otherPending: b.status, otherPaid: paid.status, ticketStates: a.tickets.map(t => t.status) }));
    expect(reads).toBe(2);
    expect(counters.every(n => n >= 0)).toBe(true);
    expect(counters.reduce((sum, n) => sum + n, 0)).toBe(10);
    expect(b).toEqual(pendingBefore);
    expect(paid).toEqual(paidBefore);
    expect(a.status).toBe('REFUNDED');
    expect(a.paymentStatus).toBe(target.paymentStatus);
    expect(a.tickets).toEqual(target.tickets.map(ticket => ({ ...ticket, status: 'CANCELLED', updatedAt: expect.any(Date) })));
    expect(counters).toEqual([6, 2, 2]);
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
