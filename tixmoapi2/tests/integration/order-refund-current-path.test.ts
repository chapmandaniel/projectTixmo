// Current-path qualification only. Historical stale-request assertions remain untouched.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: { retrieve: jest.fn() },
  refunds: { list: jest.fn(), create: jest.fn(), retrieve: jest.fn() },
})));
import prisma from '../../src/config/prisma';
import { paymentService } from '../../src/api/payments/service';
import { OrderService } from '../../src/api/orders/service';

const provider = (paymentService as any).stripe;
async function fixture(status: 'VALID' | 'USED' | 'TRANSFERRED' = 'VALID') {
  const key = `refund325-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'synthetic', firstName: 'Fixture', lastName: '325' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [], status: 'ON_SALE', startDatetime: new Date(Date.now()+86400000) } });
  const type = await prisma.ticketType.create({ data: { eventId: event.id, name: key, price: 10, quantityTotal: 10, quantityAvailable: 8, quantitySold: 2 } });
  const order = await prisma.order.create({ data: { orderNumber: key, userId: user.id, eventId: event.id, totalAmount: 20, currency: 'cad', status: 'PAID', paymentStatus: 'SUCCEEDED', paymentIntentId: `pi_${key}`, tickets: { create: [0,1].map(i => ({ eventId: event.id, userId: user.id, ticketTypeId: type.id, barcode: `${key}-${i}`, pricePaid: 10, status, inventoryState: 'SOLD' })) } }, include: { tickets: { orderBy: { id: 'asc' } } } });
  provider.paymentIntents.retrieve.mockResolvedValue({ id: order.paymentIntentId, status: 'succeeded', amount: 2000, amount_received: 2000, currency: 'cad' });
  provider.refunds.list.mockResolvedValue({ data: [] });
  provider.refunds.create.mockImplementation(async (params: any) => ({ id: `re_${key}`, status: 'succeeded', amount: params.amount, currency: 'cad', payment_intent: params.payment_intent, metadata: params.metadata }));
  return { order, type };
}
beforeEach(() => jest.clearAllMocks());
afterAll(async () => prisma.$disconnect());
test.each(['USED', 'TRANSFERRED'] as const)('denied %s remains unchanged before provider operations', async status => {
  const { order, type } = await fixture(status);
  await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({ statusCode: 400 });
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(order);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});
test('matching inert provider success finalizes SOLD inventory once and retry is idempotent', async () => {
  const { order, type } = await fixture();
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({ status: 'REFUNDED' });
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } });
  expect([after.quantityAvailable, after.quantityHeld, after.quantitySold]).toEqual([10,0,0]);
  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
  expect(tickets).toHaveLength(2);
  expect(tickets.every(t => t.status === 'CANCELLED' && t.inventoryState === 'RELEASED')).toBe(true);
  const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: order.paymentIntentId! } });
  expect(refund).toMatchObject({ status: 'SUCCEEDED', amount: 2000, reason: 'ORDER_REFUND' });
  expect(provider.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000 }), { idempotencyKey: `refund-${refund.id}` });
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({ status: 'REFUNDED' });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(after);
});
test('pending inert refund does not finalize financial or inventory state', async () => {
  const { order, type } = await fixture();
  provider.refunds.create.mockImplementation(async (p: any) => ({ id: 're_pending325', status: 'pending', amount: p.amount, currency: 'cad', payment_intent: p.payment_intent }));
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
  expect(await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: order.paymentIntentId! } })).toMatchObject({ orderId: order.id, paymentIntentId: order.paymentIntentId, amount: 2000, currency: 'cad', reason: 'ORDER_REFUND', status: 'PROCESSING', stripeRefundId: 're_pending325', errorMessage: null });
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.ticket.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })).toEqual(order.tickets);
});

// Actual authorized request observation followed by a committed competing write.
test('stale scoped refund payment observation refuses before provider or ledger writes', async () => {
  const { order, type } = await fixture();
  await prisma.user.update({ where: { id: order.userId }, data: { role: 'ADMIN', organizationId: (await prisma.event.findUniqueOrThrow({ where: { id: order.eventId } })).organizationId } });
  const original = prisma.order.findFirst.bind(prisma.order);
  let changed: any;
  const spy = jest.spyOn(prisma.order, 'findFirst').mockImplementationOnce((async (args: any) => {
    const observed = await original(args);
    expect(observed?.paymentStatus).toBe('SUCCEEDED');
    changed = await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' }, include: { tickets: { orderBy: { id: 'asc' } } } });
    return observed;
  }) as any);
  try {
    await expect(new OrderService().refundOrder(order.id, order.userId)).rejects.toMatchObject({ statusCode: 400 });
  } finally { spy.mockRestore(); }
  expect(changed).toBeDefined();
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(changed);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});

test('stable FAILED local payment status is not a new categorical refund prohibition', async () => {
  const { order } = await fixture();
  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
  await expect(new OrderService().refundOrder(order.id)).resolves.toMatchObject({ status: 'REFUNDED', paymentStatus: 'FAILED' });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
});

test('direct payment ingress refuses committed change after its real preflight', async () => {
  const { order, type } = await fixture();
  const original = prisma.order.findUnique.bind(prisma.order);
  let changed: any;
  const spy = jest.spyOn(prisma.order, 'findUnique').mockImplementationOnce((async (args: any) => {
    const observed = await original(args);
    changed = await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' }, include: { tickets: { orderBy: { id: 'asc' } } } });
    return observed;
  }) as any);
  try { await expect(paymentService.refundOrder(order.id)).rejects.toMatchObject({ statusCode: 400 }); }
  finally { spy.mockRestore(); }
  expect(changed).toBeDefined();
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: { orderBy: { id: 'asc' } } } })).toEqual(changed);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } })).toEqual(type);
  expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(0);
  expect(provider.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(provider.refunds.create).not.toHaveBeenCalled();
});

async function snapshot(orderId: string, typeId: string) {
  return {
    order: await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { tickets: { orderBy: { id: 'asc' } } } }),
    event: await prisma.event.findFirstOrThrow({ where: { orders: { some: { id: orderId } } } }),
    stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: typeId } }),
    refunds: await prisma.paymentRefund.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
  };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
test('real SQL blocked row locks and overlapping provider calls share one key/effect and finalize once; foreign buyer unchanged', async () => {
  const foreign = await fixture();
  const foreignBefore = await snapshot(foreign.order.id, foreign.type.id);
  const { order, type } = await fixture();
  const locked = gate(), unlock = gate(), bothProviderCalls = gate(), finishProvider = gate();
  const blocker = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
    locked.release();
    await unlock.promise;
  }, { timeout: 15000 });
  await locked.promise;
  let calls = 0;
  const effects = new Map<string, any>();
  provider.refunds.create.mockImplementation(async (p: any, options: any) => {
    calls++;
    const key = options.idempotencyKey;
    if (!effects.has(key)) effects.set(key, { id: 're_overlap325', status: 'succeeded', amount: p.amount, currency: 'cad', payment_intent: p.payment_intent, metadata: p.metadata });
    if (calls === 2) bothProviderCalls.release();
    await finishProvider.promise;
    return effects.get(key);
  });
  const first = new OrderService().refundOrder(order.id);
  const second = new OrderService().refundOrder(order.id);
  const settled = Promise.allSettled([first, second]);
  let blocked = 0;
  try {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0 AND query LIKE '%SELECT id FROM orders%'`;
      blocked = Number(rows[0].count);
      if (blocked >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBeGreaterThanOrEqual(2);
    expect(provider.refunds.create).not.toHaveBeenCalled();
    unlock.release();
    await blocker;
    await bothProviderCalls.promise;
    expect(effects.size).toBe(1);
    expect(await prisma.paymentRefund.count({ where: { orderId: order.id } })).toBe(1);
    expect((await snapshot(order.id, type.id)).stock).toEqual(type);
  } finally {
    unlock.release();
    finishProvider.release();
    // A rejected blocker must not bypass draining either owned request.
    const drained = await Promise.allSettled([blocker, settled]);
    if (drained[0].status === 'rejected') throw drained[0].reason;
  }
  const results = await settled;
  expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(calls).toBe(2);
  const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentIntentId: order.paymentIntentId! } });
  expect(provider.refunds.create.mock.calls.map((call: any[]) => call[1].idempotencyKey)).toEqual([`refund-${refund.id}`, `refund-${refund.id}`]);
  const after = await snapshot(order.id, type.id);
  expect(after.order).toMatchObject({ status: 'REFUNDED', refundStatus: 'SUCCEEDED' });
  expect([after.stock.quantityAvailable, after.stock.quantityHeld, after.stock.quantitySold]).toEqual([10, 0, 0]);
  expect(after.order.tickets).toHaveLength(order.tickets.length);
  expect(after.order.tickets.map(t => t.id)).toEqual(order.tickets.map(t => t.id));
  expect(after.order.tickets).toEqual(order.tickets.map(t => ({
    ...t, status: 'CANCELLED', inventoryState: 'RELEASED', updatedAt: expect.any(Date),
  })));
  expect(after.refunds).toHaveLength(1);
  expect(after.refunds[0]).toMatchObject({ status: 'SUCCEEDED', stripeRefundId: 're_overlap325', amount: 2000 });
  await new OrderService().refundOrder(order.id);
  expect(await snapshot(order.id, type.id)).toEqual(after);
  expect(calls).toBe(2);
  expect(await snapshot(foreign.order.id, foreign.type.id)).toEqual(foreignBefore);
}, 15000);

test('insufficient SOLD stock rolls back local finalization but preserves durable provider success and other buyer', async () => {
  const foreign = await fixture();
  const foreignBefore = await snapshot(foreign.order.id, foreign.type.id);
  const { order, type } = await fixture();
  await prisma.ticketType.update({ where: { id: type.id }, data: { quantitySold: 1 } });
  const before = await snapshot(order.id, type.id);
  await expect(new OrderService().refundOrder(order.id)).rejects.toMatchObject({ statusCode: 409 });
  const after = await snapshot(order.id, type.id);
  expect(after.stock).toEqual(before.stock);
  expect(after.order.tickets).toEqual(before.order.tickets);
  expect(after.order).toEqual({ ...before.order, refundStatus: 'PROCESSING', updatedAt: expect.any(Date) });
  expect(after.refunds).toHaveLength(1);
  expect(after.refunds[0]).toMatchObject({ status: 'SUCCEEDED', orderId: order.id, paymentIntentId: order.paymentIntentId, amount: 2000, reason: 'ORDER_REFUND' });
  expect(provider.refunds.create).toHaveBeenCalledTimes(1);
  expect(await snapshot(foreign.order.id, foreign.type.id)).toEqual(foreignBefore);
});

// Both calls reach the real provider seam before success; only response order varies.
test.each([0, 1])('slow pending response cannot regress terminal success (successful caller %i)', async fastIndex => {
  const { order, type } = await fixture();
  const entered = [gate(), gate()], finish = [gate(), gate()];
  let calls = 0;
  provider.refunds.create.mockImplementation(async (p: any) => {
    const index = calls++;
    entered[index].release();
    await finish[index].promise;
    return { id: `re_terminal325_${order.id}`, status: index === fastIndex ? 'succeeded' : 'pending', amount: p.amount, currency: 'cad', payment_intent: p.payment_intent, metadata: p.metadata };
  });
  const requests: Array<Promise<any>> = [];
  // Attach rejection handlers immediately, including if an assertion later aborts.
  const start = () => {
    const request = new OrderService().refundOrder(order.id);
    void request.catch(() => undefined);
    requests.push(request);
  };
  let terminal: Awaited<ReturnType<typeof snapshot>> | undefined;
  try {
    start();
    await entered[0].promise;
    start();
    await entered[1].promise;
    const pending = await snapshot(order.id, type.id);
    expect(pending.order).toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
    expect(pending.order.tickets).toEqual(order.tickets);
    expect(pending.stock).toEqual(type);
    expect(pending.refunds).toHaveLength(1);
    expect(pending.refunds[0]).toMatchObject({ status: 'REQUESTED', stripeRefundId: null });
    finish[fastIndex].release();
    await expect(requests[fastIndex]).resolves.toMatchObject({ status: 'REFUNDED', refundStatus: 'SUCCEEDED' });
    terminal = await snapshot(order.id, type.id);
    expect(terminal.refunds[0]).toMatchObject({ status: 'SUCCEEDED', stripeRefundId: `re_terminal325_${order.id}`, errorMessage: null });
    expect(terminal.order.tickets).toEqual(order.tickets.map(t => ({ ...t, status: 'CANCELLED', inventoryState: 'RELEASED', updatedAt: expect.any(Date) })));
    expect([terminal.stock.quantityAvailable, terminal.stock.quantitySold]).toEqual([10, 0]);
    finish[1 - fastIndex].release();
    await expect(requests[1 - fastIndex]).resolves.toMatchObject({ status: 'REFUNDED', refundStatus: 'SUCCEEDED' });
    expect(await snapshot(order.id, type.id)).toEqual(terminal);
    expect(calls).toBe(2);
    expect(provider.refunds.create.mock.calls.map((call: any[]) => call[1].idempotencyKey)).toEqual([`refund-${terminal.refunds[0].id}`, `refund-${terminal.refunds[0].id}`]);
  } finally {
    finish.forEach(g => g.release());
    await Promise.allSettled(requests);
  }
}, 15000);
