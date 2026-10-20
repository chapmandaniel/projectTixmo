jest.mock('../../src/config/environment', () => ({ config: {} }));
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
import { resolveAccountSession } from '../../src/utils/accountSession';
const db = prisma as any;
const service = new OrderService();
let actor: any;
beforeEach(() => {
  jest.resetAllMocks();
  actor = {
    id: 'operator',
    email: 'operator@example.test',
    role: 'ADMIN',
    organizationId: 'org-a',
    sessionVersion: 2,
    isPlatformAdmin: false,
  };
  db.user.findUnique.mockImplementation(async () => actor);
  db.order.findMany.mockResolvedValue([]);
  db.order.count.mockResolvedValue(0);
});
test('operator reads remain scoped to its organization', async () => {
  await service.getOrderById('foreign-order', undefined, actor.id);
  expect(db.order.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'foreign-order', event: { organizationId: 'org-a' } } })
  );
});
test('operator list query cannot replace organization scope with buyer/event filters', async () => {
  await service.listOrders({ userId: 'buyer-b', eventId: 'event-b' }, actor.id);
  expect(db.order.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        AND: [{ userId: 'buyer-b', eventId: 'event-b' }, { event: { organizationId: 'org-a' } }],
      },
    })
  );
});
test('unscoped admin without explicit platform grant fails closed', async () => {
  actor.organizationId = null;
  await expect(service.getOrderById('any-order', undefined, actor.id)).rejects.toMatchObject({
    statusCode: 403,
  });
  expect(db.order.findFirst).not.toHaveBeenCalled();
});
test('consumer recovery never inherits platform admin privileges', async () => {
  actor.organizationId = null;
  actor.isPlatformAdmin = true;
  await service.getConsumerOrderRecovery('order', actor.id);
  expect(db.order.findFirst).toHaveBeenCalledWith({
    where: { id: 'order', userId: actor.id },
    select: { id: true, status: true, paymentStatus: true },
  });
});
test('revoked and legacy JWT sessions remain invalid despite merged order roles', async () => {
  await expect(resolveAccountSession({ userId: actor.id })).rejects.toMatchObject({
    statusCode: 401,
  });
  await expect(
    resolveAccountSession({ userId: actor.id, sessionVersion: 1 })
  ).rejects.toMatchObject({ statusCode: 401 });
  actor.disabledAt = new Date();
  await expect(
    resolveAccountSession({ userId: actor.id, sessionVersion: 2 })
  ).rejects.toMatchObject({ statusCode: 401 });
});
