// Mock-only scope coverage. Inventory/provider effects are spies; no services run.
jest.mock('../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    event: { findUnique: jest.fn().mockResolvedValue({ ticketingMode: 'TIXMO' }) },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/config/environment', () => ({ config: {} }));
jest.mock('../src/utils/notificationService', () => ({
  notificationService: { sendOrderConfirmation: jest.fn() },
}));
jest.mock('../src/api/payments/service', () => ({ paymentService: { refundOrder: jest.fn() } }));
jest.mock('../src/services/order-inventory.service', () => ({
  lockOrder: jest.fn(),
  transitionInventory: jest.fn(),
  transitionPromo: jest.fn(),
}));
import prisma from '../src/config/prisma';
import { OrderService, orderService } from '../src/api/orders/service';
import * as controller from '../src/api/orders/controller';
import { paymentService } from '../src/api/payments/service';
import { notificationService } from '../src/utils/notificationService';
import {
  lockOrder,
  transitionInventory,
  transitionPromo,
} from '../src/services/order-inventory.service';

const db = prisma as any;
const actor = {
  id: 'actor',
  email: 'a@example.test',
  role: 'MANAGER',
  organizationId: 'org-a',
  isPlatformAdmin: false,
};
let orders: any[];
const tx = {
  order: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  event: { findUniqueOrThrow: jest.fn() },
  $queryRaw: jest.fn(),
};
function matches(order: any, where: any): boolean {
  return (
    (!where.AND || where.AND.every((w: any) => matches(order, w))) &&
    (!where.id || where.id === order.id) &&
    (!where.userId || where.userId === order.userId) &&
    (!where.event?.organizationId || where.event.organizationId === order.event.organizationId) &&
    (!where.eventId || where.eventId === order.eventId)
  );
}
const service = new OrderService();
beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  orders = [
    {
      id: 'a',
      userId: 'buyer-a',
      eventId: 'event-a',
      event: { organizationId: 'org-a' },
      status: 'PENDING',
      paymentStatus: 'PENDING',
      tickets: [],
      promoCodeId: null,
    },
    {
      id: 'b',
      userId: 'buyer-b',
      eventId: 'event-b',
      event: { organizationId: 'org-b' },
      status: 'PENDING',
      paymentStatus: 'PENDING',
      tickets: [],
      promoCodeId: null,
    },
  ];
  db.user.findUnique.mockResolvedValue({ ...actor });
  const find = async ({ where }: any) => {
    const row = orders.find((order) => matches(order, where));
    return row ? { ...row } : null;
  };
  db.order.findFirst.mockImplementation(find);
  tx.order.findFirst.mockImplementation(find);
  tx.order.findUnique.mockImplementation(find);
  tx.order.update.mockImplementation(async ({ where, data }) => {
    const row = orders.find((order) => order.id === where.id);
    Object.assign(row, data);
    return { ...row };
  });
  tx.event.findUniqueOrThrow.mockResolvedValue({ status: 'ON_SALE', deletedAt: null });
  db.order.findMany.mockImplementation(async ({ where }: any) =>
    orders.filter((order) => matches(order, where))
  );
  db.order.count.mockImplementation(
    async ({ where }: any) => orders.filter((order) => matches(order, where)).length
  );
  db.$transaction.mockImplementation(async (work: any) => work(tx));
  (paymentService.refundOrder as jest.Mock).mockResolvedValue({
    id: 'a',
    status: 'PAID',
    refundStatus: 'PROCESSING',
  });
});

describe('actor-bound order service', () => {
  test.each(['OWNER', 'ADMIN', 'MANAGER'])(
    '%s cannot get or list another organization',
    async (role) => {
      db.user.findUnique.mockResolvedValue({ ...actor, role });
      expect(await service.getOrderById('b', undefined, 'actor')).toBeNull();
      expect((await service.listOrders({}, 'actor')).orders.map((order) => order.id)).toEqual([
        'a',
      ]);
      expect(
        (await service.listOrders({ userId: 'buyer-b', eventId: 'event-b' }, 'actor')).orders
      ).toEqual([]);
      expect(db.order.count.mock.calls[0][0].where).toEqual(
        db.order.findMany.mock.calls[0][0].where
      );
    }
  );
  test.each(
    ['OWNER', 'ADMIN', 'MANAGER'].flatMap((role) =>
      ['confirm', 'cancel', 'refund'].map((action) => [role, action])
    )
  )('cross-org %s %s denies before side effects', async (role, action) => {
    db.user.findUnique.mockResolvedValue({ ...actor, role });
    const promise =
      action === 'confirm'
        ? service.confirmOrder('b', 'actor')
        : action === 'cancel'
          ? service.cancelOrder('b', undefined, 'actor')
          : service.refundOrder('b', 'actor');
    await expect(promise).rejects.toMatchObject({
      statusCode: action === 'refund' && role === 'MANAGER' ? 403 : 404,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(transitionInventory).not.toHaveBeenCalled();
    expect(paymentService.refundOrder).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmation).not.toHaveBeenCalled();
  });
  test.each(['confirm', 'cancel'])(
    'same-org %s retains the scoped transaction and inventory transition',
    async (action) => {
      const result =
        action === 'confirm'
          ? await service.confirmOrder('a', 'actor')
          : await service.cancelOrder('a', undefined, 'actor');
      expect(result).toMatchObject({
        id: 'a',
        status: action === 'confirm' ? 'PAID' : 'CANCELLED',
      });
      expect(lockOrder).toHaveBeenCalledWith(tx, 'a');
      expect(transitionInventory).toHaveBeenCalledWith(
        tx,
        'a',
        'HELD',
        action === 'confirm' ? 'SOLD' : 'RELEASED'
      );
      expect(transitionPromo).toHaveBeenCalledWith(
        tx,
        'a',
        action === 'confirm' ? 'USED' : 'RELEASED'
      );
      expect(orders[1].status).toBe('PENDING');
    }
  );
  test('same-org operator refund delegates to durable processor reconciliation', async () => {
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
    const result = await service.refundOrder('a', 'actor');
    expect(result).toMatchObject({ status: 'PAID', refundStatus: 'PROCESSING' });
    expect(paymentService.refundOrder).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ id: 'a', status: 'PENDING' })
    );
    expect(transitionInventory).not.toHaveBeenCalled();
    expect(orders[0].status).toBe('PENDING');
  });
  test('customer own-only scope cannot be overridden', async () => {
    db.user.findUnique.mockResolvedValue({ ...actor, id: 'buyer-a', role: 'CUSTOMER' });
    expect(await service.getOrderById('b', undefined, 'buyer-a')).toBeNull();
    expect((await service.listOrders({ userId: 'buyer-b' }, 'buyer-a')).orders).toEqual([]);
    expect((await service.listOrders({}, 'buyer-a')).orders.map((order) => order.id)).toEqual([
      'a',
    ]);
    await expect(service.cancelOrder('b', undefined, 'buyer-a')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.cancelOrder('a', undefined, 'buyer-a')).resolves.toMatchObject({
      id: 'a',
      status: 'CANCELLED',
    });
    await expect(service.confirmOrder('a', 'buyer-a')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.refundOrder('a', 'buyer-a')).rejects.toMatchObject({ statusCode: 403 });
  });
  test('PROMOTER retains own-only reads and cannot refund', async () => {
    db.user.findUnique.mockResolvedValue({ ...actor, role: 'PROMOTER' });
    expect((await service.listOrders({}, 'actor')).orders).toEqual([]);
    await expect(service.confirmOrder('b', 'actor')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.refundOrder('a', 'actor')).rejects.toMatchObject({ statusCode: 403 });
  });
  test.each(['OWNER', 'ADMIN'])(
    'organizationless %s without platform authority fails closed',
    async (role) => {
      db.user.findUnique.mockResolvedValue({
        ...actor,
        role,
        organizationId: null,
        isPlatformAdmin: false,
      });
      await expect(service.listOrders({}, 'actor')).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.getOrderById('a', undefined, 'actor')).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(db.order.findMany).not.toHaveBeenCalled();
    }
  );
  test('only explicitly flagged organizationless ADMIN receives platform scope', async () => {
    db.user.findUnique.mockResolvedValue({
      ...actor,
      role: 'ADMIN',
      organizationId: null,
      isPlatformAdmin: true,
    });
    expect((await service.listOrders({}, 'actor')).orders.map((order) => order.id)).toEqual([
      'a',
      'b',
    ]);
  });
  test('missing actor fails closed', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.listOrders({}, 'missing')).rejects.toMatchObject({ statusCode: 401 });
  });
  test('trusted internal confirm/cancel omit actor lookup', async () => {
    await service.confirmOrder('a');
    await service.cancelOrder('b');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  test('buyer detail masks transferred ticket credentials', async () => {
    orders[0].tickets = [
      { id: 'own', userId: 'buyer-a', barcode: 'own-code', qrCodeUrl: 'own-qr' },
      {
        id: 'transferred',
        userId: 'recipient',
        barcode: 'recipient-code',
        qrCodeUrl: 'recipient-qr',
      },
    ];
    const detail = (await service.getOrderById('a', 'buyer-a')) as any;
    expect(detail.tickets).toEqual([
      orders[0].tickets[0],
      { ...orders[0].tickets[1], barcode: '', qrCodeUrl: null },
    ]);
  });
  test.each(['OWNER', 'ADMIN', 'MANAGER'])(
    '%s detail masks another buyer barcode to the last four characters',
    async (role) => {
      db.user.findUnique.mockResolvedValue({ ...actor, role });
      orders[0].tickets = [
        { id: 'own', userId: 'buyer-a', barcode: 'own-code-9999', qrCodeUrl: 'own-qr' },
      ];
      const detail = (await service.getOrderById('a', undefined, 'actor')) as any;
      expect(detail.tickets[0]).toMatchObject({ barcode: '••••9999', qrCodeUrl: null });
    }
  );
  test.each(['PROMOTER', 'TEAM_MEMBER', 'SCANNER', 'CUSTOMER'])(
    '%s detail does not reveal another buyer barcode',
    async (role) => {
      db.user.findUnique.mockResolvedValue({ ...actor, role });
      orders[0].userId = 'actor';
      orders[0].tickets = [
        { id: 'own', userId: 'buyer-a', barcode: 'own-code-9999', qrCodeUrl: 'own-qr' },
      ];
      const detail = (await service.getOrderById('a', undefined, 'actor')) as any;
      expect(detail.tickets[0]).toMatchObject({ barcode: '', qrCodeUrl: null });
    }
  );
});

describe('scope remains authoritative after acquiring the order lock', () => {
  test.each(['confirm', 'cancel'])(
    '%s revalidates the authorized order in its transaction',
    async (action) => {
      tx.order.findFirst.mockResolvedValue(null);
      const promise =
        action === 'confirm'
          ? service.confirmOrder('a', 'actor')
          : service.cancelOrder('a', undefined, 'actor');
      await expect(promise).rejects.toMatchObject({ statusCode: 404 });
      expect(lockOrder).toHaveBeenCalledWith(tx, 'a');
      expect(transitionInventory).not.toHaveBeenCalled();
      expect(transitionPromo).not.toHaveBeenCalled();
      expect(tx.order.update).not.toHaveBeenCalled();
    }
  );
  test('canceling a paid order never releases inventory', async () => {
    orders[0].status = 'PAID';
    await expect(service.cancelOrder('a')).rejects.toMatchObject({ statusCode: 400 });
    expect(transitionInventory).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  test('canceling an already cancelled order is an idempotent no-op', async () => {
    orders[0].status = 'CANCELLED';
    await expect(service.cancelOrder('a')).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(transitionInventory).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});

// Real handlers receive stale JWT roles and attacker-selected query scope.
async function invoke(handler: any, id = 'b', query: any = {}) {
  return new Promise<any>((resolve) => {
    const res = { json: jest.fn(() => resolve({ ok: true })) };
    handler(
      { params: { id }, query, user: { userId: 'actor', role: 'ADMIN' } },
      res,
      (error: any) => resolve({ error })
    );
  });
}
describe('HTTP handler actor forwarding', () => {
  test.each(['getOrder', 'confirmOrder', 'cancelOrder', 'refundOrder'] as const)(
    '%s denies cross-org before side effects',
    async (name) => {
      db.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
      const email = jest.spyOn(orderService, 'sendOrderConfirmationEmail').mockResolvedValue();
      const result = await invoke(controller[name]);
      expect(result.error).toMatchObject({ statusCode: 404 });
      expect(email).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(paymentService.refundOrder).not.toHaveBeenCalled();
    }
  );
  test('list ignores stale JWT global role and extra query scope', async () => {
    await invoke(controller.listOrders, '', {
      userId: 'buyer-b',
      organizationId: 'org-b',
      actorId: 'other',
    });
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'actor' } })
    );
    expect(db.order.findMany.mock.calls[0][0].where.AND[1]).toEqual({
      event: { organizationId: 'org-a' },
    });
  });
});

test.each([undefined, 'actor'])(
  'cancel rejects a payment change after public observation actor=%s',
  async (actorId) => {
    db.order.findFirst.mockImplementationOnce(async () => {
      const observed = { ...orders[0] };
      orders[0].paymentStatus = 'PROCESSING';
      return observed;
    });
    await expect(service.cancelOrder('a', undefined, actorId)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(lockOrder).toHaveBeenCalledWith(tx, 'a');
    expect(transitionInventory).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(orders[0].status).toBe('PENDING');
  }
);
