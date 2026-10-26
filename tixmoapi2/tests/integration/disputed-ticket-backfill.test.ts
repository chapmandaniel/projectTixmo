import { readFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';

const migrationPath = path.resolve(
  __dirname,
  '../../prisma/migrations/20261027001000_backfill_disputed_ticket_voids/migration.sql'
);

async function applyBackfill(): Promise<void> {
  const sql = readFileSync(migrationPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--.*$/gm, '').trim().length > 0);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

describe('disputed ticket backfill', () => {
  const key = `void-backfill-${randomUUID()}`;
  let organizationId = '';
  let eventId = '';
  let typeId = '';
  let buyerId = '';
  const orderIds: string[] = [];

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;
    const buyer = await prisma.user.create({
      data: {
        email: `${key}@test.invalid`,
        passwordHash: 'test-only',
        firstName: 'Buyer',
        lastName: 'Backfill',
        role: 'CUSTOMER',
      },
    });
    buyerId = buyer.id;
    const event = await prisma.event.create({
      data: {
        organizationId,
        name: key,
        slug: key,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86_400_000),
      },
    });
    eventId = event.id;
    const type = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'Admission',
        price: 20,
        quantityTotal: 10,
        quantityAvailable: 7,
        quantitySold: 3,
      },
    });
    typeId = type.id;
  });

  afterAll(async () => {
    await prisma.ticketInventoryReconciliation.deleteMany({
      where: {
        planFingerprint: {
          in: orderIds.map((id) => `ticket-void:DISPUTE_CREATED:${id}:${id}`),
        },
      },
    });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.ticketType.deleteMany({ where: { id: typeId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.user.deleteMany({ where: { id: buyerId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  async function orderWithTicket(label: string, refundStatus: string, status: 'VALID' | 'USED') {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${key}-${label}`,
        userId: buyerId,
        eventId,
        totalAmount: 20,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        refundStatus,
        tickets: {
          create: {
            eventId,
            userId: buyerId,
            ticketTypeId: typeId,
            barcode: `${key}-${label}`,
            pricePaid: 20,
            status,
            inventoryState: 'SOLD',
          },
        },
      },
      include: { tickets: true },
    });
    orderIds.push(order.id);
    return order;
  }

  it('cancels VALID tickets on disputed orders once and leaves inventory alone', async () => {
    const disputed = await orderWithTicket('disputed', 'DISPUTED', 'VALID');
    const prefixed = await orderWithTicket('closed', 'DISPUTE_LOST', 'VALID');
    const used = await orderWithTicket('used', 'DISPUTED', 'USED');
    const paid = await orderWithTicket('paid', 'NONE', 'VALID');

    await applyBackfill();
    await applyBackfill();

    const disputedTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: disputed.tickets[0].id },
    });
    const prefixedTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: prefixed.tickets[0].id },
    });
    const usedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: used.tickets[0].id } });
    const paidTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: paid.tickets[0].id } });
    const type = await prisma.ticketType.findUniqueOrThrow({ where: { id: typeId } });

    expect(disputedTicket.status).toBe('CANCELLED');
    expect(disputedTicket.inventoryState).toBe('SOLD');
    expect(prefixedTicket.status).toBe('CANCELLED');
    expect(prefixedTicket.inventoryState).toBe('SOLD');
    expect(usedTicket.status).toBe('USED');
    expect(paidTicket.status).toBe('VALID');
    expect(type.quantitySold).toBe(3);
    expect(type.quantityAvailable).toBe(7);

    for (const orderId of [disputed.id, prefixed.id]) {
      const audits = await prisma.ticketInventoryReconciliation.findMany({
        where: { planFingerprint: `ticket-void:DISPUTE_CREATED:${orderId}:${orderId}` },
      });
      expect(audits).toHaveLength(1);
      const after = audits[0].after as { inventoryReleased: boolean; reasonCode: string };
      expect(after.inventoryReleased).toBe(false);
      expect(after.reasonCode).toBe('VOID_DISPUTED');
    }
    expect(
      await prisma.ticketInventoryReconciliation.count({
        where: { planFingerprint: `ticket-void:DISPUTE_CREATED:${used.id}:${used.id}` },
      })
    ).toBe(0);
  });
});
