// Fully mocked dependencies; run without the integration tests/setup.ts bootstrap.
jest.mock('../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    order: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/utils/notificationService', () => ({
  notificationService: { sendOrderConfirmation: jest.fn() },
}));
jest.mock('../src/api/promo-codes/service', () => ({ promoCodeService: {} }));
jest.mock('../src/api/ticket-tiers/service', () => ({ ticketTierService: {} }));
jest.mock('../src/utils/jwt', () => ({ verifyAccessToken: jest.fn() }));
jest.mock('../src/utils/accountSession', () => ({ resolveAccountSession: jest.fn() }));
jest.mock('../src/config/environment', () => ({ config: {} }));
import express from 'express';
import request from 'supertest';
import { OrderStatus, PaymentStatus, UserRole } from '@prisma/client';
import prisma from '../src/config/prisma';
import { verifyAccessToken } from '../src/utils/jwt';
import { resolveAccountSession } from '../src/utils/accountSession';
import { orderService } from '../src/api/orders/service';
import routes from '../src/api/orders/routes';
import { notificationService } from '../src/utils/notificationService';

const db = prisma as any;
const projection = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'PENDING',
  paymentStatus: 'PENDING',
};
const app = express();
app.use(express.json());
app.use('/api/v1/orders', routes);
app.use((error: any, _req: any, res: any, _next: any) =>
  res.status(error.statusCode || 500).json({ message: error.message })
);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  (verifyAccessToken as jest.Mock).mockReturnValue({
    userId: 'buyer',
    role: 'CUSTOMER',
    organizationId: null,
  });
  // The route uses the real auth middleware with its account-session boundary
  // mocked. Account validity itself is covered by the account-session suites.
  (resolveAccountSession as jest.Mock).mockImplementation(async (payload) => {
    if (!payload.userId) throw new Error('Invalid account session');
    return {
      id: payload.userId,
      role: payload.role,
      organizationId: payload.organizationId,
      email: 'session@example.test',
      emailVerified: true,
    };
  });
  db.order.findFirst.mockImplementation(async ({ where, select }: any) => {
    if (where.id !== '11111111-1111-4111-8111-111111111111' || where.userId !== 'buyer')
      return null;
    // Simulate Prisma selection over a record containing private fields.
    const row = {
      ...projection,
      userId: 'buyer',
      paymentIntentId: 'private',
      tickets: ['private'],
      event: {},
    };
    return Object.fromEntries(Object.keys(select).map((key) => [key, (row as any)[key]]));
  });
});

const roles = Object.values(UserRole);
// Both columns use the actual generated Prisma enums, including inconsistent
// stored combinations: this read reports state, never repairs or transitions it.
const storedStates: Array<[OrderStatus, PaymentStatus]> = [
  [OrderStatus.PENDING, PaymentStatus.PENDING],
  [OrderStatus.PENDING, PaymentStatus.PROCESSING],
  [OrderStatus.PAID, PaymentStatus.SUCCEEDED],
  [OrderStatus.PENDING, PaymentStatus.FAILED],
  [OrderStatus.CANCELLED, PaymentStatus.PENDING],
  [OrderStatus.CANCELLED, PaymentStatus.SUCCEEDED],
  [OrderStatus.REFUNDED, PaymentStatus.SUCCEEDED],
  [OrderStatus.REFUNDED, PaymentStatus.REFUNDED],
  [OrderStatus.PARTIALLY_REFUNDED, PaymentStatus.SUCCEEDED],
  [OrderStatus.PAID, PaymentStatus.FAILED],
];
describe('consumer recovery route/controller/service', () => {
  test.each(roles)('%s reads own status without an extra operator-scope lookup', async (role) => {
    (verifyAccessToken as jest.Mock).mockReturnValue({
      userId: 'buyer',
      role,
      organizationId: null,
    });
    const response = await request(app)
      .get(
        '/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery?userId=attacker&role=ADMIN'
      )
      .set('Authorization', 'Bearer mock');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(projection);
    expect(resolveAccountSession).toHaveBeenCalledTimes(1);
    expect(db.order.findFirst).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111', userId: 'buyer' },
      select: { id: true, status: true, paymentStatus: true },
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(notificationService.sendOrderConfirmation).not.toHaveBeenCalled();
  });
  test.each(
    roles.flatMap((role) =>
      ['org-a', 'org-b', null].map((organizationId) => [role, organizationId])
    )
  )('%s nonowner denied for organization %s', async (role, organizationId) => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'other', role, organizationId });
    const denied = await request(app)
      .get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery?userId=buyer')
      .set('Authorization', 'Bearer mock');
    const missing = await request(app)
      .get('/api/v1/orders/22222222-2222-4222-8222-222222222222/recovery')
      .set('Authorization', 'Bearer mock');
    expect(denied.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(denied.body).toEqual(missing.body);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('malformed identifier returns neutral 400 without a database query', async () => {
    const response = await request(app)
      .get('/api/v1/orders/not-a-uuid/recovery')
      .set('Authorization', 'Bearer mock');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Validation failed' });
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });
  test('unauthenticated and malformed identity fail closed before query', async () => {
    expect(
      (await request(app).get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery'))
        .status
    ).toBe(401);
    (verifyAccessToken as jest.Mock).mockReturnValue({ role: 'ADMIN' });
    expect(
      (
        await request(app)
          .get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery')
          .set('Authorization', 'Bearer mock')
      ).status
    ).toBe(401);
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });
  test('rejected or revoked account session discloses no order state', async () => {
    (resolveAccountSession as jest.Mock).mockRejectedValue(new Error('Session is no longer valid'));
    const response = await request(app)
      .get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery')
      .set('Authorization', 'Bearer mock');
    expect(response.status).toBe(401);
    expect(db.order.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('persisted session identity overrides a stale privileged JWT identity', async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'other', role: 'ADMIN' });
    (resolveAccountSession as jest.Mock).mockResolvedValue({
      id: 'other',
      role: 'CUSTOMER',
      organizationId: null,
    });
    const response = await request(app)
      .get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery?userId=buyer')
      .set('Authorization', 'Bearer mock');
    expect(response.status).toBe(404);
    expect(db.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: projection.id, userId: 'other' } })
    );
  });
  test.each(['', undefined, null])('service rejects missing owner %s', async (owner) => {
    await expect(
      orderService.getConsumerOrderRecovery('11111111-1111-4111-8111-111111111111', owner as string)
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });
  test.each(storedStates)(
    'returns stored %s/%s without transition',
    async (status, paymentStatus) => {
      db.order.findFirst.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        status,
        paymentStatus,
      });
      const response = await request(app)
        .get('/api/v1/orders/11111111-1111-4111-8111-111111111111/recovery')
        .set('Authorization', 'Bearer mock');
      expect(response.body.data).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        status,
        paymentStatus,
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    }
  );
  test('operator GET still forwards authenticated actor to existing detail service', async () => {
    const detail = { ...projection, tickets: ['detail'] };
    const read = jest.spyOn(orderService, 'getOrderById').mockResolvedValue(detail as any);
    const response = await request(app)
      .get('/api/v1/orders/11111111-1111-4111-8111-111111111111?userId=other')
      .set('Authorization', 'Bearer mock');
    expect(response.body.data).toEqual({
      ...detail,
      receiptDisclosure: {
        includesHstAndFees: true,
        hstNumber: null,
        hstRate: 0.15,
        hstAmount: null,
      },
    });
    expect(read).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', undefined, 'buyer');
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });
});
