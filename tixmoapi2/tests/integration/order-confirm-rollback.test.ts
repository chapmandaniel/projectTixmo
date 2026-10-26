// Current-contract ports of the historical review113/review145 rollback scenarios.
// Requires the repository's verified disposable integration target and normal setup.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { OrderService } from '../../src/api/orders/service';

const service = new OrderService();
afterAll(async () => {
  await prisma.$disconnect();
});

async function fixture() {
  const key = `confirm-rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const org = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      email: `${key}@example.test`,
      passwordHash: 'fixture',
      firstName: 'Rollback',
      lastName: 'Buyer',
    },
  });
  const foreign = await prisma.user.create({
    data: {
      email: `${key}-other@example.test`,
      passwordHash: 'fixture',
      firstName: 'Other',
      lastName: 'Buyer',
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      name: key,
      slug: key,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 86400000),
      tags: [],
    },
  });
  const type = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 6,
      quantityHeld: 4,
    },
  });
  const tier = await prisma.ticketTier.create({
    data: {
      ticketTypeId: type.id,
      name: 'Reserved',
      price: 10,
      quantityLimit: 10,
      quantityHeld: 4,
    },
  });
  const promo = await prisma.promoCode.create({
    data: {
      organizationId: org.id,
      code: key,
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      usesHeld: 1,
      validFrom: new Date(Date.now() - 1000),
      validUntil: new Date(Date.now() + 86400000),
    },
  });
  const make = (suffix: string, userId: string, discounted: boolean) =>
    prisma.order.create({
      data: {
        orderNumber: `${key}-${suffix}`,
        userId,
        eventId: event.id,
        totalAmount: discounted ? 19 : 20,
        currency: 'cad',
        ...(discounted
          ? { promoCodeId: promo.id, promoReservation: 'HELD' as const, discountAmount: 1 }
          : {}),
        tickets: {
          create: [0, 1].map((i) => ({
            eventId: event.id,
            userId,
            ticketTypeId: type.id,
            tierId: tier.id,
            barcode: `${key}-${suffix}-${i}`,
            pricePaid: 10,
            inventoryState: 'HELD' as const,
          })),
        },
      },
    });
  const target = await make('target', user.id, true);
  const other = await make('other', foreign.id, false);
  const snapshot = async (db: any = prisma) => ({
    target: await db.order.findUniqueOrThrow({
      where: { id: target.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    other: await db.order.findUniqueOrThrow({
      where: { id: other.id },
      include: { tickets: { orderBy: { id: 'asc' } } },
    }),
    type: await db.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
    tier: await db.ticketTier.findUniqueOrThrow({ where: { id: tier.id } }),
    promo: await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } }),
  });
  return { target, other, user, foreign, type, tier, promo, snapshot };
}

test('caller-owned confirmation commits only with its transaction and rolls back every reservation on caller abort', async () => {
  const f = await fixture();
  const before = await f.snapshot();
  const abort = new Error('synthetic caller abort after confirmation');
  await expect(
    prisma.$transaction(async (tx) => {
      const result = await service.confirmOrderInTransaction(tx, f.target.id, {
        userId: f.user.id,
      });
      expect(result).toMatchObject({
        id: f.target.id,
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        promoReservation: 'USED',
      });
      const inside = await f.snapshot(tx);
      expect(inside.target.tickets.every((ticket: any) => ticket.inventoryState === 'SOLD')).toBe(
        true
      );
      expect([inside.type.quantityHeld, inside.type.quantitySold]).toEqual([2, 2]);
      expect([inside.tier.quantityHeld, inside.tier.quantitySold]).toEqual([2, 2]);
      expect([inside.promo.usesHeld, inside.promo.usesCount]).toEqual([0, 1]);
      expect(inside.other).toEqual(before.other);
      throw abort;
    })
  ).rejects.toBe(abort);
  expect(await f.snapshot()).toEqual(before);

  // The same fixture can commit, and a second confirmation is idempotent today.
  await prisma.$transaction((tx) =>
    service.confirmOrderInTransaction(tx, f.target.id, { userId: f.user.id })
  );
  const committed = await f.snapshot();
  expect(committed.target).toMatchObject({
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    promoReservation: 'USED',
  });
  expect(committed.other).toEqual(before.other);
  expect([
    committed.type.quantityAvailable,
    committed.type.quantityHeld,
    committed.type.quantitySold,
  ]).toEqual([6, 2, 2]);
  expect([committed.tier.quantityHeld, committed.tier.quantitySold]).toEqual([2, 2]);
  expect([committed.promo.usesHeld, committed.promo.usesCount]).toEqual([0, 1]);
  await prisma.$transaction((tx) =>
    service.confirmOrderInTransaction(tx, f.target.id, { userId: f.user.id })
  );
  expect(await f.snapshot()).toEqual(committed);
}, 15000);

test.each(['tier', 'promo'] as const)(
  'later inconsistent %s allocation rolls back earlier confirmation writes',
  async (badAllocation) => {
    const f = await fixture();
    if (badAllocation === 'tier')
      await prisma.ticketTier.update({ where: { id: f.tier.id }, data: { quantityHeld: 0 } });
    else await prisma.promoCode.update({ where: { id: f.promo.id }, data: { usesHeld: 0 } });
    const before = await f.snapshot();
    await expect(service.confirmOrder(f.target.id)).rejects.toMatchObject({
      statusCode: 409,
      message:
        badAllocation === 'tier'
          ? 'Order tier allocation is inconsistent'
          : 'Promo reservation is inconsistent',
    });
    // A tier failure follows the type write; a promo failure follows type, tier and ticket writes.
    expect(await f.snapshot()).toEqual(before);
  },
  15000
);

test('supplied transaction retains the buyer scope and missing-order error contract', async () => {
  const f = await fixture();
  const before = await f.snapshot();
  await expect(
    prisma.$transaction((tx) =>
      service.confirmOrderInTransaction(tx, f.other.id, { userId: f.user.id })
    )
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    prisma.$transaction((tx) => service.confirmOrderInTransaction(tx, 'missing-review-order'))
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(await f.snapshot()).toEqual(before);
}, 15000);
