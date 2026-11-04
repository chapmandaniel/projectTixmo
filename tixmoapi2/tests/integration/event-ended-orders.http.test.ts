// Mounted POST /orders against real rows. The buyer hash is not a credential.
jest.mock('stripe', () => jest.fn(() => ({})));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendOrderConfirmation: jest.fn(() => Promise.resolve(true)),
    sendAdminAlert: jest.fn(() => Promise.resolve(true)),
  },
}));

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt';

describe('POST /orders refuses ended and undated events', () => {
  const orgId = randomUUID();
  const buyerId = randomUUID();
  const ids = {
    ended: { event: randomUUID(), type: randomUUID() },
    undated: { event: randomUUID(), type: randomUUID() },
    openEndedPastStart: { event: randomUUID(), type: randomUUID() },
    inProgress: { event: randomUUID(), type: randomUUID() },
    upcoming: { event: randomUUID(), type: randomUUID() },
  };
  const token = () =>
    generateAccessToken({
      userId: buyerId,
      email: `${buyerId}@example.test`,
      role: 'CUSTOMER',
      sessionVersion: 0,
      emailVerified: true,
    });
  const buy = (ticketTypeId: string) =>
    request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token()}`)
      .send({ items: [{ ticketTypeId, quantity: 1 }] });

  beforeAll(async () => {
    const now = Date.now();
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, type: 'PROMOTER' },
    });
    await prisma.user.create({
      data: {
        id: buyerId,
        role: 'CUSTOMER',
        email: `${buyerId}@example.test`,
        firstName: 'Synthetic',
        lastName: 'Buyer',
        passwordHash: 'synthetic',
        emailVerified: true,
      },
    });
    const rows: Array<{
      key: keyof typeof ids;
      startDatetime: Date | null;
      endDatetime: Date | null;
    }> = [
      {
        key: 'ended',
        startDatetime: new Date(now - 3 * 60 * 60 * 1000),
        endDatetime: new Date(now - 60 * 1000),
      },
      { key: 'undated', startDatetime: null, endDatetime: null },
      {
        key: 'openEndedPastStart',
        startDatetime: new Date(now - 60 * 1000),
        endDatetime: null,
      },
      {
        key: 'inProgress',
        startDatetime: new Date(now - 60 * 60 * 1000),
        endDatetime: new Date(now + 60 * 60 * 1000),
      },
      {
        key: 'upcoming',
        startDatetime: new Date(now + 24 * 60 * 60 * 1000),
        endDatetime: new Date(now + 26 * 60 * 60 * 1000),
      },
    ];
    for (const row of rows) {
      const id = ids[row.key];
      await prisma.event.create({
        data: {
          id: id.event,
          organizationId: orgId,
          name: row.key,
          slug: id.event,
          status: 'ON_SALE',
          tags: [],
          startDatetime: row.startDatetime,
          endDatetime: row.endDatetime,
        },
      });
      await prisma.ticketType.create({
        data: {
          id: id.type,
          eventId: id.event,
          name: 'General admission',
          price: 25,
          quantityTotal: 8,
          quantityAvailable: 8,
          maxPerOrder: 4,
        },
      });
    }
  }, 30000);

  afterAll(async () => {
    const eventIds = Object.values(ids).map((row) => row.event);
    await prisma.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.order.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: buyerId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it('refuses an ended event and an undated event, and still sells an upcoming event', async () => {
    const endedPage = await request(app).get(`/api/v1/events/public/${ids.ended.event}`);
    expect(endedPage.status).toBe(200);
    expect(endedPage.body.data).toMatchObject({ ended: true, undated: false, status: 'ON_SALE' });

    const undatedPage = await request(app).get(`/api/v1/events/public/${ids.undated.event}`);
    expect(undatedPage.status).toBe(200);
    expect(undatedPage.body.data).toMatchObject({ ended: false, undated: true });

    const ended = await buy(ids.ended.type);
    expect(ended.status).toBe(409);
    expect(ended.body).toMatchObject({
      success: false,
      message: 'This event has ended.',
      errors: { code: 'EVENT_ENDED' },
    });

    const undated = await buy(ids.undated.type);
    expect(undated.status).toBe(409);
    expect(undated.body).toMatchObject({
      success: false,
      message: "This event isn't open for sale yet.",
      errors: { code: 'EVENT_UNDATED' },
    });

    const noEnd = await buy(ids.openEndedPastStart.type);
    expect(noEnd.status).toBe(409);
    expect(noEnd.body.errors).toMatchObject({ code: 'EVENT_ENDED' });
    expect(noEnd.body.message).toBe('This event has ended.');

    const live = await buy(ids.inProgress.type);
    expect(live.status).toBe(400);
    expect(live.body.message).toBe('Event is not available for purchase');
    expect(live.body.errors?.code).toBeUndefined();

    const upcoming = await buy(ids.upcoming.type);
    expect(upcoming.status).toBe(201);
    expect(upcoming.body.success).toBe(true);
    expect(upcoming.body.data.eventId).toBe(ids.upcoming.event);
    expect(upcoming.body.data.status).toBe('PENDING');

    const stock = await prisma.ticketType.findMany({
      where: { id: { in: Object.values(ids).map((row) => row.type) } },
      select: { id: true, quantityAvailable: true, quantityHeld: true },
    });
    const byId = Object.fromEntries(stock.map((row) => [row.id, row]));
    for (const key of ['ended', 'undated', 'openEndedPastStart', 'inProgress'] as const) {
      expect(byId[ids[key].type]).toMatchObject({ quantityAvailable: 8, quantityHeld: 0 });
    }
    expect(byId[ids.upcoming.type]).toMatchObject({ quantityAvailable: 7, quantityHeld: 1 });
    expect(await prisma.order.count({ where: { eventId: ids.ended.event } })).toBe(0);
    expect(await prisma.order.count({ where: { eventId: ids.undated.event } })).toBe(0);
  }, 30000);

  it('POST /api/v1/orders on a PUBLISHED event with no start date returns 409 EVENT_UNDATED and holds no inventory', async () => {
    const eventId = randomUUID();
    const typeId = randomUUID();
    await prisma.event.create({
      data: {
        id: eventId,
        organizationId: orgId,
        name: 'published-undated',
        slug: eventId,
        status: 'PUBLISHED',
        tags: [],
        startDatetime: null,
        endDatetime: null,
      },
    });
    await prisma.ticketType.create({
      data: {
        id: typeId,
        eventId,
        name: 'General admission',
        price: 25,
        quantityTotal: 8,
        quantityAvailable: 8,
        maxPerOrder: 4,
      },
    });
    try {
      const response = await buy(typeId);
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        message: "This event isn't open for sale yet.",
        errors: { code: 'EVENT_UNDATED' },
      });
      expect(response.body.code).toBeUndefined();
      const stock = await prisma.ticketType.findUniqueOrThrow({ where: { id: typeId } });
      expect(stock).toMatchObject({ quantityAvailable: 8, quantityHeld: 0 });
      expect(await prisma.order.count({ where: { eventId } })).toBe(0);
    } finally {
      await prisma.ticket.deleteMany({ where: { eventId } });
      await prisma.order.deleteMany({ where: { eventId } });
      await prisma.ticketType.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    }
  }, 30000);
});
