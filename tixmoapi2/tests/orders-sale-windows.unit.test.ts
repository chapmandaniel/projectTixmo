// Exercise the real reservation service; all external boundaries are mocked.
jest.mock('../src/config/prisma', () => ({
  __esModule: true,
  default: { $transaction: jest.fn() },
}));
jest.mock('../src/config/environment', () => ({
  config: { paymentCurrency: 'cad', cartExpiryMinutes: 15 },
}));
jest.mock('../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../src/config/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderService } from '../src/api/orders/service';

const opening = Date.parse('2026-11-09T10:00:00-03:30');
const closing = opening + 3600000;
let event: any;
let type: any;
const tx = {
  $queryRaw: jest.fn(),
  event: { findUniqueOrThrow: jest.fn() },
  ticketType: { findUnique: jest.fn(), update: jest.fn() },
  order: { create: jest.fn() },
  ticket: { createMany: jest.fn() },
};
const buy = () =>
  new OrderService().createOrder('synthetic-buyer', {
    items: [{ ticketTypeId: 'ga', quantity: 1 }],
  });
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(opening);
  event = {
    id: 'event',
    status: 'PUBLISHED',
    deletedAt: null,
    startDatetime: new Date(closing + 3600000),
    salesStart: new Date(opening),
    salesEnd: new Date(closing),
  };
  type = {
    id: 'ga',
    eventId: 'event',
    name: 'GA',
    status: 'ACTIVE',
    tierInventoryStatus: 'READY',
    tiers: [],
    quantityAvailable: 20,
    maxPerOrder: 4,
    price: new Decimal(50),
    salesStart: null,
    salesEnd: null,
  };
  tx.event.findUniqueOrThrow.mockImplementation(async () => event);
  tx.ticketType.findUnique.mockImplementation(async () => type);
  tx.ticketType.update.mockResolvedValue({});
  tx.order.create.mockImplementation(async ({ data }) => ({ id: 'order', ...data }));
  (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(tx));
});
afterEach(() => jest.useRealTimers());

async function expectPurchase(allowed: boolean) {
  if (allowed) {
    await expect(buy()).resolves.toMatchObject({ id: 'order' });
    expect(tx.ticketType.update).toHaveBeenCalledTimes(1);
    expect(tx.ticketType.update).toHaveBeenCalledWith({
      where: { id: 'ga' },
      data: { quantityAvailable: { decrement: 1 }, quantityHeld: { increment: 1 } },
    });
    expect(tx.ticket.createMany).toHaveBeenCalledTimes(1);
  } else {
    await expect(buy()).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.ticketType.update).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.ticket.createMany).not.toHaveBeenCalled();
  }
}
test.each([
  [-1, false],
  [0, true],
  [1, true],
])('event opening T%+i ms allowed=%s', async (delta, allowed) => {
  jest.setSystemTime(opening + Number(delta));
  await expectPurchase(Boolean(allowed));
});
test.each([
  [-1, true],
  [0, false],
  [1, false],
])('event closing T%+i ms allowed=%s', async (delta, allowed) => {
  jest.setSystemTime(closing + Number(delta));
  await expectPurchase(Boolean(allowed));
});
test.each([
  [-1, false],
  [0, true],
  [1, true],
  [999, true],
  [1000, false],
  [1001, false],
])('narrower ticket interval at offset %i', async (delta, allowed) => {
  type.salesStart = new Date(opening + 1000);
  type.salesEnd = new Date(opening + 2000);
  jest.setSystemTime(opening + 1000 + Number(delta));
  await expectPurchase(Boolean(allowed));
});
test.each(['DRAFT', 'SOLD_OUT', 'CANCELLED', 'COMPLETED', 'DELETED'])(
  'reject event lifecycle %s',
  async (status) => {
    event.status = status;
    await expectPurchase(false);
  }
);
test('soft-deleted published event cannot sell', async () => {
  event.deletedAt = new Date(opening - 1);
  await expectPurchase(false);
});
test.each([-1, 0, 1])('event start cutoff at T%+i ms', async (delta) => {
  event.startDatetime = new Date(opening);
  event.salesStart = null;
  jest.setSystemTime(opening + delta);
  await expectPurchase(delta < 0);
});
test('null event endpoints do not add a window restriction', async () => {
  event.salesStart = null;
  event.salesEnd = null;
  event.status = 'ON_SALE';
  await expectPurchase(true);
});
test('a wider ticket window cannot override the event close', async () => {
  type.salesStart = new Date(opening - 1000);
  type.salesEnd = new Date(closing + 1000);
  jest.setSystemTime(closing);
  await expectPurchase(false);
});
test('stores the included HST with the same cent rounding as the receipt', async () => {
  const order = await buy();
  expect(order.taxAmount.toString()).toBe('6.52');
  expect(tx.order.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      totalAmount: new Decimal(50),
      taxAmount: new Decimal('6.52'),
    }),
  });
});
test('client clock fields cannot authorize an early direct request', async () => {
  jest.setSystemTime(opening - 1);
  await expect(
    new OrderService().createOrder('synthetic-buyer', {
      items: [{ ticketTypeId: 'ga', quantity: 1 }],
      // Runtime callers cannot override the server clock with extra JSON fields.
      now: new Date(opening + 1000).toISOString(),
    } as any)
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(tx.order.create).not.toHaveBeenCalled();
});
