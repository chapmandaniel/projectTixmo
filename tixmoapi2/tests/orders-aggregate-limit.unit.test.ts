// Fully mocked: real reservation transaction, no bootstrap/database/providers.
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
const event = { id: 'event', status: 'ON_SALE', startDatetime: new Date('2099-01-01') };
const types: any[] = ['a', 'b'].map((id) => ({
  id,
  eventId: event.id,
  name: id,
  status: 'ACTIVE',
  tierInventoryStatus: 'READY',
  tiers: [],
  quantityAvailable: 20,
  maxPerOrder: 4,
  price: new Decimal(id === 'a' ? 10 : 20),
}));
const tx = {
  $queryRaw: jest.fn(),
  event: { findUniqueOrThrow: jest.fn() },
  ticketType: { findUnique: jest.fn(), updateMany: jest.fn() },
  ticketTier: { update: jest.fn() },
  order: { create: jest.fn() },
  ticket: { createMany: jest.fn() },
};
beforeEach(() => {
  jest.resetAllMocks();
  types.forEach((t) => {
    t.tiers = [];
    t.quantityAvailable = 20;
  });
  tx.event.findUniqueOrThrow.mockResolvedValue(event);
  tx.ticketType.findUnique.mockImplementation(async ({ where }) =>
    types.find((t) => t.id === where.id)
  );
  tx.ticketType.updateMany.mockResolvedValue({ count: 1 });
  tx.order.create.mockImplementation(async ({ data }) => ({ id: 'order', ...data }));
  tx.ticket.createMany.mockResolvedValue({ count: 4 });
  (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(tx));
});
test('duplicate lines individually under cap but aggregate above cap reject before any holds', async () => {
  await expect(
    service.createOrder('buyer', {
      items: [
        { ticketTypeId: 'a', quantity: 3 },
        { ticketTypeId: 'a', quantity: 2 },
      ],
    })
  ).rejects.toMatchObject({ statusCode: 400, message: 'Maximum 4 tickets per order for a' });
  expect(tx.ticketType.updateMany).not.toHaveBeenCalled();
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});
test('duplicate lines at exact aggregate cap retain server pricing and guarded aggregate inventory', async () => {
  await service.createOrder('buyer', {
    items: [
      { ticketTypeId: 'a', quantity: 2 },
      { ticketTypeId: 'a', quantity: 2 },
    ],
  });
  expect(tx.ticketType.updateMany).toHaveBeenCalledTimes(1);
  expect(tx.ticketType.updateMany).toHaveBeenCalledWith({
    where: { id: 'a', quantityAvailable: { gte: 4 } },
    data: { quantityHeld: { increment: 4 }, quantityAvailable: { decrement: 4 } },
  });
  expect(tx.order.create.mock.calls[0][0].data.totalAmount.toNumber()).toBe(40);
  expect(tx.ticket.createMany.mock.calls[0][0].data).toHaveLength(4);
  expect(
    tx.ticket.createMany.mock.calls[0][0].data.every(
      (ticket: any) => ticket.pricePaid.eq(10) && ticket.inventoryState === 'HELD'
    )
  ).toBe(true);
});
test('ordinary multi-type limits apply separately and use active tier server prices', async () => {
  types[0].tiers = [
    {
      id: 'tier-a',
      isActive: true,
      quantityLimit: null,
      quantitySold: 0,
      quantityHeld: 0,
      price: new Decimal(7),
    },
  ];
  await service.createOrder('buyer', {
    items: [
      { ticketTypeId: 'a', quantity: 3 },
      { ticketTypeId: 'b', quantity: 3 },
    ],
  });
  expect(tx.ticketType.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.ticketTier.update).toHaveBeenCalledWith({
    where: { id: 'tier-a' },
    data: { quantityHeld: { increment: 3 } },
  });
  expect(tx.order.create.mock.calls[0][0].data.totalAmount.toNumber()).toBe(81);
  expect(tx.ticket.createMany.mock.calls[0][0].data).toHaveLength(6);
});
test('conditional inventory failure prevents order and ticket creation', async () => {
  tx.ticketType.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    service.createOrder('buyer', { items: [{ ticketTypeId: 'a', quantity: 1 }] })
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});
