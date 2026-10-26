jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';
afterAll(async () => { await prisma.$disconnect(); });
test('real transaction rolls back claim and earlier inventory write when later hold is inconsistent', async () => {
  const key = `review113-${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: key, slug: key, type: 'PROMOTER' } });
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, passwordHash: 'test-only', firstName: 'QA', lastName: 'Fixture' } });
  const event = await prisma.event.create({ data: { organizationId: org.id, name: key, slug: key, tags: [] } });
  const good = await prisma.ticketType.create({ data: { eventId: event.id, name: 'good', price: 10, quantityTotal: 10, quantityAvailable: 8, quantityHeld: 2 } });
  const bad = await prisma.ticketType.create({ data: { eventId: event.id, name: 'bad', price: 10, quantityTotal: 10, quantityAvailable: 10, quantityHeld: 0 } });
  const order = await prisma.order.create({ data: { orderNumber: key, userId: user.id, eventId: event.id, totalAmount: 20,
    tickets: { create: [good, bad].map((type, i) => ({ eventId: event.id, userId: user.id, ticketTypeId: type.id, barcode: `${key}-${i}`, pricePaid: 10 })) } } });
  const before = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: true } });
  await expect(new OrderService().confirmOrder(order.id)).rejects.toMatchObject({ statusCode: 500 });
  const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: true } });
  expect(after).toEqual(before);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: good.id } })).toEqual(good);
  expect(await prisma.ticketType.findUniqueOrThrow({ where: { id: bad.id } })).toEqual(bad);
  console.log('TASK113_ROLLBACK', after.status, after.paymentStatus, 'both ticket types unchanged');
});
