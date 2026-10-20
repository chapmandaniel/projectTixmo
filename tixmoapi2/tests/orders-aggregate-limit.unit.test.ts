// Mock-only regression; no integration bootstrap, database or provider transport.
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

const service = new OrderService();
let types: any[];
const tx = {
  $queryRaw: jest.fn(),
  event: { findUniqueOrThrow: jest.fn() },
  ticketType: { findUnique: jest.fn(), update: jest.fn() },
  ticketTier: { update: jest.fn() },
  order: { create: jest.fn() },
  ticket: { createMany: jest.fn() },
};
beforeEach(() => {
  jest.resetAllMocks();
  types = ['a', 'b'].map((id) => ({
    id,
    eventId: 'event',
    name: id,
    status: 'ACTIVE',
    tierInventoryStatus: 'READY',
    tiers: [],
    quantityAvailable: 20,
    quantityHeld: 0,
    maxPerOrder: 4,
    price: new Decimal(id === 'a' ? 10 : 20),
  }));
  tx.event.findUniqueOrThrow.mockResolvedValue({
    id: 'event',
    status: 'ON_SALE',
    startDatetime: new Date('2099-01-01'),
  });
  tx.ticketType.findUnique.mockImplementation(async ({ where }) =>
    types.find((type) => type.id === where.id)
  );
  tx.ticketType.update.mockImplementation(async ({ where, data }) => {
    const type = types.find((value) => value.id === where.id);
    type.quantityAvailable -= data.quantityAvailable.decrement;
    type.quantityHeld += data.quantityHeld.increment;
    return type;
  });
  tx.order.create.mockImplementation(async ({ data }) => ({ id: 'order', ...data }));
  tx.ticket.createMany.mockResolvedValue({ count: 4 });
  (prisma.$transaction as jest.Mock).mockImplementation(async (work) => {
    const before = types.map((type) => ({ ...type }));
    try {
      return await work(tx);
    } catch (error) {
      types = before;
      throw error;
    }
  });
});

test('duplicate lines individually under cap but aggregate above cap reject before holds', async () => {
  await expect(
    service.createOrder('buyer', {
      items: [
        { ticketTypeId: 'a', quantity: 3 },
        { ticketTypeId: 'a', quantity: 2 },
      ],
    })
  ).rejects.toMatchObject({ statusCode: 400, message: 'Maximum 4 tickets per order for a' });
  expect(tx.ticketType.update).not.toHaveBeenCalled();
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});

test('duplicate lines at exact cap hold their aggregate once at the server price', async () => {
  const order = await service.createOrder('buyer', {
    items: [
      { ticketTypeId: 'a', quantity: 2 },
      { ticketTypeId: 'a', quantity: 2 },
    ],
  });
  expect(order.totalAmount.toNumber()).toBe(40);
  expect(order.currency).toBe('cad');
  expect(types[0]).toMatchObject({ quantityAvailable: 16, quantityHeld: 4 });
  expect(tx.ticketType.update).toHaveBeenCalledTimes(1);
  const tickets = tx.ticket.createMany.mock.calls[0][0].data;
  expect(tickets).toHaveLength(4);
  expect(
    tickets.every((ticket: any) => ticket.pricePaid.eq(10) && ticket.inventoryState === 'HELD')
  ).toBe(true);
});

test('ordinary multi-type order limits apply separately and retain tier allocations', async () => {
  types[0].tiers = [
    {
      id: 'tier-a',
      price: new Decimal(7),
      isActive: true,
      quantityLimit: 10,
      quantityHeld: 0,
      quantitySold: 0,
    },
  ];
  const order = await service.createOrder('buyer', {
    items: [
      { ticketTypeId: 'a', quantity: 3 },
      { ticketTypeId: 'b', quantity: 3 },
    ],
  });
  expect(order.totalAmount.toNumber()).toBe(81);
  expect(types.map((type) => [type.quantityAvailable, type.quantityHeld])).toEqual([
    [17, 3],
    [17, 3],
  ]);
  expect(tx.ticketTier.update).toHaveBeenCalledWith({
    where: { id: 'tier-a' },
    data: { quantityHeld: { increment: 3 } },
  });
  const tickets = tx.ticket.createMany.mock.calls[0][0].data;
  expect(tickets).toHaveLength(6);
  expect(
    tickets
      .filter((ticket: any) => ticket.ticketTypeId === 'a')
      .every((ticket: any) => ticket.pricePaid.eq(7) && ticket.tierId === 'tier-a')
  ).toBe(true);
});

test('a later unavailable type rolls back all holds and creates no order or tickets', async () => {
  types[1].quantityAvailable = 0;
  const before = types.map((type) => ({ ...type }));
  await expect(
    service.createOrder('buyer', {
      items: [
        { ticketTypeId: 'a', quantity: 1 },
        { ticketTypeId: 'b', quantity: 1 },
      ],
    })
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(types).toEqual(before);
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});

test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  'quantity %s fails before a transaction',
  async (quantity) => {
    await expect(
      service.createOrder('buyer', { items: [{ ticketTypeId: 'a', quantity }] })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  }
);
