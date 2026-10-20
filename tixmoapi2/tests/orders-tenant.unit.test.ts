// Fully mocked unit coverage: no config, DB, Redis, email, or payment services.
jest.mock('../src/config/prisma', () => ({ __esModule: true, default: {
  user: { findUnique: jest.fn() },
  order: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
} }));
jest.mock('../src/utils/notificationService', () => ({ notificationService: { sendOrderConfirmation: jest.fn() } }));
jest.mock('../src/api/promo-codes/service', () => ({ promoCodeService: {} }));
jest.mock('../src/api/ticket-tiers/service', () => ({ ticketTierService: {} }));
import prisma from '../src/config/prisma';
import { OrderService, orderService } from '../src/api/orders/service';
import * as controller from '../src/api/orders/controller';
import { notificationService } from '../src/utils/notificationService';

const db = prisma as any;
const actor = { id: 'actor', email: 'a@example.test', role: 'MANAGER', organizationId: 'org-a' };
const orders = [
  { id: 'a', userId: 'buyer-a', event: { organizationId: 'org-a' }, status: 'PENDING', tickets: [] },
  { id: 'b', userId: 'buyer-b', event: { organizationId: 'org-b' }, status: 'PENDING', tickets: [] },
];
function matches(order: any, where: any): boolean {
  return (!where.AND || where.AND.every((w: any) => matches(order, w))) &&
    (!where.id || where.id === order.id) && (!where.userId || where.userId === order.userId) &&
    (!where.event?.organizationId || where.event.organizationId === order.event.organizationId) &&
    (!where.eventId || where.eventId === order.eventId);
}
const service = new OrderService();
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ ...actor });
  db.order.findFirst.mockImplementation(async ({ where }: any) => orders.find(o => matches(o, where)) || null);
  db.order.findMany.mockImplementation(async ({ where }: any) => orders.filter(o => matches(o, where)));
  db.order.count.mockImplementation(async ({ where }: any) => orders.filter(o => matches(o, where)).length);
  db.$transaction.mockResolvedValue({ id: 'a' });
});

describe('confirmation transition guard', () => {
  test('stale scoped confirmation rejects before inventory and response reads', async () => {
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
      ticketType: { updateMany: jest.fn() },
    };
    db.$transaction.mockImplementationOnce((callback: any) => callback(tx));
    await expect(service.confirmOrder('a', 'actor')).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', event: { organizationId: 'org-a' }, status: 'PENDING' },
      data: { status: 'PAID', paymentStatus: 'SUCCEEDED' },
    });
    expect(tx.ticketType.updateMany).not.toHaveBeenCalled();
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('actor-bound order service', () => {
  test.each(['OWNER', 'ADMIN', 'MANAGER'])('%s cannot get or list another organization', async role => {
    db.user.findUnique.mockResolvedValue({ ...actor, role });
    expect(await service.getOrderById('b', undefined, 'actor')).toBeNull();
    expect((await service.listOrders({}, 'actor')).orders.map(o => o.id)).toEqual(['a']);
    expect((await service.listOrders({ userId: 'buyer-b', eventId: 'event-b' }, 'actor')).orders).toEqual([]);
    expect(db.order.count.mock.calls[0][0].where).toEqual(db.order.findMany.mock.calls[0][0].where);
  });
  test.each(['OWNER', 'ADMIN', 'MANAGER'].flatMap(role => ['confirm', 'cancel', 'refund'].map(action => [role, action])))('cross-org %s %s cannot mutate inventory or email', async (role, action) => {
    db.user.findUnique.mockResolvedValue({ ...actor, role });
    const promise = action === 'confirm' ? service.confirmOrder('b', 'actor') : action === 'cancel'
      ? service.cancelOrder('b', undefined, 'actor') : service.refundOrder('b', 'actor');
    await expect(promise).rejects.toMatchObject({ statusCode: action === 'refund' && role === 'MANAGER' ? 403 : 404 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmation).not.toHaveBeenCalled();
  });
  test('same-org get/list/confirm/cancel and refund are permitted', async () => {
    expect(await service.getOrderById('a', undefined, 'actor')).toMatchObject({ id: 'a' });
    await expect(service.confirmOrder('a', 'actor')).resolves.toEqual({ id: 'a' });
    await expect(service.cancelOrder('a', undefined, 'actor')).resolves.toEqual({ id: 'a' });
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
    db.order.findFirst.mockResolvedValue({ ...orders[0], status: 'PAID' });
    await expect(service.refundOrder('a', 'actor')).resolves.toEqual({ id: 'a' });
  });
  test('customer own-only scope cannot be overridden', async () => {
    db.user.findUnique.mockResolvedValue({ ...actor, id: 'buyer-a', role: 'CUSTOMER' });
    expect(await service.getOrderById('b', undefined, 'buyer-a')).toBeNull();
    expect((await service.listOrders({ userId: 'buyer-b' }, 'buyer-a')).orders).toEqual([]);
    expect((await service.listOrders({}, 'buyer-a')).orders.map(o => o.id)).toEqual(['a']);
    await expect(service.cancelOrder('b', undefined, 'buyer-a')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.cancelOrder('a', undefined, 'buyer-a')).resolves.toEqual({ id: 'a' });
    await expect(service.confirmOrder('a', 'buyer-a')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.refundOrder('a', 'buyer-a')).rejects.toMatchObject({ statusCode: 403 });
  });
  test('PROMOTER retains own-only reads and cannot refund', async () => {
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'PROMOTER' });
    expect((await service.listOrders({}, 'actor')).orders).toEqual([]);
    await expect(service.confirmOrder('b', 'actor')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.refundOrder('a', 'actor')).rejects.toMatchObject({ statusCode: 403 });
  });
  test('missing actor and organizationless OWNER fail closed; ADMIN helper unchanged', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.listOrders({}, 'missing')).rejects.toMatchObject({ statusCode: 401 });
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'OWNER', organizationId: null });
    await expect(service.listOrders({}, 'actor')).rejects.toMatchObject({ statusCode: 403 });
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN', organizationId: null });
    expect((await service.listOrders({}, 'actor')).orders).toHaveLength(2);
  });
  test('trusted internal confirm/cancel still omit actor loading', async () => {
    await service.confirmOrder('a'); await service.cancelOrder('a');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

// Invoke actual handlers through their async error wrapper, with stale JWT role
// and attacker-selected query scope. No HTTP auth infrastructure is imported.
async function invoke(handler: any, id = 'b', query: any = {}) {
  return new Promise<any>(resolve => {
    const res = { json: jest.fn(() => resolve({ ok: true })) };
    handler({ params: { id }, query, user: { userId: 'actor', role: 'ADMIN' } }, res, (error: any) => resolve({ error }));
  });
}
describe('HTTP handler actor forwarding', () => {
  test.each(['getOrder', 'confirmOrder', 'cancelOrder', 'refundOrder'] as const)('%s denies cross-org before side effects', async name => {
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
    const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue();
    const result = await invoke(controller[name]);
    expect(result.error).toMatchObject({ statusCode: 404 });
    expect(email).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('list ignores stale JWT global role and extra query scope', async () => {
    await invoke(controller.listOrders, '', { userId: 'buyer-b', organizationId: 'org-b', actorId: 'other' });
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'actor' } }));
    expect(db.order.findMany.mock.calls[0][0].where.AND[1]).toEqual({ event: { organizationId: 'org-a' } });
  });
});


describe('cancellation transition contracts', () => {
  test('stale scoped cancellation rejects before inventory, tickets or response', async () => {
    db.order.findFirst.mockResolvedValue({ ...orders[0], paymentStatus: 'PENDING' });
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() },
      ticketType: { updateMany: jest.fn() }, ticket: { updateMany: jest.fn() },
    };
    db.$transaction.mockImplementationOnce((callback: any) => callback(tx));
    await expect(service.cancelOrder('a', 'buyer-a', 'actor')).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', event: { organizationId: 'org-a' }, userId: 'buyer-a', status: 'PENDING', paymentStatus: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(tx.ticketType.updateMany).not.toHaveBeenCalled();
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  test.each(['PAID', 'CANCELLED'])('%s rejection retains its pre-transaction contract', async status => {
    db.order.findFirst.mockResolvedValue({ ...orders[0], status });
    await expect(service.cancelOrder('a')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('buyer mismatch remains forbidden before transaction', async () => {
    await expect(service.cancelOrder('a', 'another-buyer')).rejects.toMatchObject({ statusCode: 403 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('successful cancellation returns the committed order without changing payment', async () => {
    const result = { ...orders[0], status: 'CANCELLED', paymentStatus: 'PENDING' };
    const tx = { order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(result) }, ticket: { updateMany: jest.fn() } };
    db.$transaction.mockImplementationOnce((callback: any) => callback(tx));
    await expect(service.cancelOrder('a')).resolves.toEqual(result);
    expect(tx.ticket.updateMany).toHaveBeenCalledWith({ where: { orderId: 'a' }, data: { status: 'CANCELLED' } });
    expect(tx.order.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'a' } });
  });
});

describe('refund transition scope', () => {
  test.each(['org-a', null])('ADMIN claim retains organization fence (%s)', async organizationId => {
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN', organizationId });
    db.order.findFirst.mockResolvedValue({ ...orders[0], status: 'PAID', paymentStatus: 'SUCCEEDED' });
    const tx = { order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow: jest.fn() }, ticket: { findMany: jest.fn(), updateMany: jest.fn() }, ticketType: { updateMany: jest.fn() } };
    db.$transaction.mockImplementationOnce((callback: any) => callback(tx));
    await expect(service.refundOrder('a', 'actor')).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', ...(organizationId ? { event: { organizationId } } : {}), status: 'PAID', paymentStatus: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
    expect(tx.ticket.findMany).not.toHaveBeenCalled();
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    expect(tx.ticketType.updateMany).not.toHaveBeenCalled();
    expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
