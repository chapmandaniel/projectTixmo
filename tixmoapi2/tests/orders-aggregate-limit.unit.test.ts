// Fully mocked: no config, database, Redis, email or payment services.
jest.mock('../src/config/prisma', () => ({ __esModule: true, default: {
  ticketType: { findMany: jest.fn() }, $transaction: jest.fn(),
} }));
jest.mock('../src/utils/notificationService', () => ({ notificationService: {} }));
jest.mock('../src/api/promo-codes/service', () => ({ promoCodeService: {} }));
jest.mock('../src/api/ticket-tiers/service', () => ({ ticketTierService: { getActiveTier: jest.fn() } }));
import prisma from '../src/config/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderService } from '../src/api/orders/service';
import { ticketTierService } from '../src/api/ticket-tiers/service';

const db = prisma as any;
const service = new OrderService();
const event = { id: 'event', status: 'ON_SALE', startDatetime: new Date('2099-01-01') };
const types = ['a', 'b'].map(id => ({ id, name: id, event, quantityAvailable: 20, maxPerOrder: 4, price: new Decimal(id === 'a' ? 10 : 20) }));
const tx = {
  ticketType: { updateMany: jest.fn() }, order: { create: jest.fn() }, ticket: { createMany: jest.fn() },
};
beforeEach(() => {
  jest.resetAllMocks();
  db.ticketType.findMany.mockResolvedValue(types);
  (ticketTierService.getActiveTier as jest.Mock).mockResolvedValue(null);
  tx.ticketType.updateMany.mockResolvedValue({ count: 1 });
  tx.order.create.mockResolvedValue({ id: 'order' });
  tx.ticket.createMany.mockResolvedValue({ count: 4 });
  db.$transaction.mockImplementation((callback: any) => callback(tx));
});

test('duplicate lines individually under cap but aggregate above cap reject before any holds', async () => {
  await expect(service.createOrder('buyer', { items: [
    { ticketTypeId: 'a', quantity: 3 }, { ticketTypeId: 'a', quantity: 2 },
  ] })).rejects.toMatchObject({ statusCode: 400, message: 'Maximum 4 tickets per order for a' });
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(tx.ticketType.updateMany).not.toHaveBeenCalled();
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});

test('duplicate lines at exact aggregate cap retain server pricing and inventory guards', async () => {
  await service.createOrder('buyer', { items: [{ ticketTypeId: 'a', quantity: 2 }, { ticketTypeId: 'a', quantity: 2 }] });
  expect(tx.ticketType.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.ticketType.updateMany).toHaveBeenCalledWith({ where: { id: 'a', quantityAvailable: { gte: 2 } }, data: { quantityHeld: { increment: 2 }, quantityAvailable: { decrement: 2 } } });
  expect(tx.order.create.mock.calls[0][0].data.totalAmount.toNumber()).toBe(40);
  expect(tx.ticket.createMany.mock.calls[0][0].data).toHaveLength(4);
  expect(tx.ticket.createMany.mock.calls[0][0].data.every((ticket: any) => ticket.pricePaid.eq(10))).toBe(true);
});

test('ordinary multi-type order limits apply separately and use active tier server prices', async () => {
  (ticketTierService.getActiveTier as jest.Mock).mockImplementation(async (id: string) => id === 'a' ? { price: new Decimal(7) } : null);
  await service.createOrder('buyer', { items: [{ ticketTypeId: 'a', quantity: 3 }, { ticketTypeId: 'b', quantity: 3 }] });
  expect(tx.ticketType.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.order.create.mock.calls[0][0].data.totalAmount.toNumber()).toBe(81);
  expect(tx.ticket.createMany.mock.calls[0][0].data).toHaveLength(6);
});

test('conditional inventory failure still prevents order and ticket creation', async () => {
  tx.ticketType.updateMany.mockResolvedValue({ count: 0 });
  await expect(service.createOrder('buyer', { items: [{ ticketTypeId: 'a', quantity: 1 }] })).rejects.toMatchObject({ statusCode: 400 });
  expect(tx.order.create).not.toHaveBeenCalled();
  expect(tx.ticket.createMany).not.toHaveBeenCalled();
});
