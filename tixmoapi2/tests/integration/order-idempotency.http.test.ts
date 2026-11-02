import request from 'supertest';
import app from '../../src/app';
import {
  createEvent,
  createOrganization,
  createTicketType,
  createVenue,
  prisma,
  registerUser,
} from '../utils/testUtils';

describe('POST /orders idempotency and sold-out conflict', () => {
  let promoterToken: string;
  let buyerToken: string;
  let buyerId: string;
  let otherToken: string;
  let otherId: string;
  let organizationId: string;
  let eventId: string;
  let openTypeId: string;
  let scarceTypeId: string;
  let soldTypeId: string;

  beforeAll(async () => {
    const promoter = await registerUser(app, {
      email: `idem-promoter-${Date.now()}@example.com`,
      password: 'Test123!',
      firstName: 'Idem',
      lastName: 'Promoter',
      role: 'PROMOTER',
    });
    promoterToken = promoter.accessToken;
    const buyer = await registerUser(app, {
      email: `idem-buyer-${Date.now()}@example.com`,
      password: 'Test123!',
      firstName: 'Idem',
      lastName: 'Buyer',
    });
    buyerToken = buyer.accessToken;
    buyerId = buyer.user.id;
    const other = await registerUser(app, {
      email: `idem-other-${Date.now()}@example.com`,
      password: 'Test123!',
      firstName: 'Idem',
      lastName: 'Other',
    });
    otherToken = other.accessToken;
    otherId = other.user.id;

    const org = await createOrganization(app, promoterToken, {
      name: 'Idempotency Org',
      slug: `idem-org-${Date.now()}`,
      type: 'PROMOTER',
    });
    organizationId = org.id;
    const venue = await createVenue(app, promoterToken, {
      organizationId,
      name: 'Idempotency Venue',
      capacity: 100,
    });
    const event = await createEvent(app, promoterToken, {
      organizationId,
      venueId: venue.id,
      title: 'Idempotency Event',
      startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
      status: 'PUBLISHED',
      capacity: 100,
    });
    eventId = event.id;
    openTypeId = (
      await createTicketType(app, promoterToken, {
        eventId,
        name: 'Open',
        price: 10,
        quantity: 20,
        maxPerOrder: 4,
      })
    ).id;
    scarceTypeId = (
      await createTicketType(app, promoterToken, {
        eventId,
        name: 'Scarce',
        price: 10,
        quantity: 1,
        maxPerOrder: 1,
      })
    ).id;
    soldTypeId = (
      await createTicketType(app, promoterToken, {
        eventId,
        name: 'Last',
        price: 10,
        quantity: 1,
        maxPerOrder: 1,
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    await prisma.orderIdempotencyKey.deleteMany({ where: { userId: { in: [buyerId, otherId] } } });
    await prisma.ticket.deleteMany({ where: { eventId } });
    await prisma.order.deleteMany({ where: { eventId } });
    await prisma.ticketType.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.venue.deleteMany({ where: { organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [buyerId, otherId] } } });
    await prisma.$disconnect();
  });

  const postOrder = (
    token: string,
    items: Array<{ ticketTypeId: string; quantity: number }>,
    key?: string
  ) => {
    const req = request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });
    if (key !== undefined) req.set('Idempotency-Key', key);
    return req;
  };

  it('keeps validation at 400 and does not store an idempotency row', async () => {
    const before = await prisma.order.count({ where: { userId: buyerId } });
    const overLimit = await postOrder(
      buyerToken,
      [{ ticketTypeId: openTypeId, quantity: 5 }],
      'limit-key'
    );
    expect(overLimit.status).toBe(400);
    expect(overLimit.body.message).toContain('Maximum');
    const invalid = await postOrder(
      buyerToken,
      [{ ticketTypeId: openTypeId, quantity: 0 }],
      'zero-key'
    );
    expect(invalid.status).toBe(400);
    const badKey = await postOrder(
      buyerToken,
      [{ ticketTypeId: openTypeId, quantity: 1 }],
      'bad key'
    );
    expect(badKey.status).toBe(400);
    expect(badKey.body.errors).toEqual({ code: 'IDEMPOTENCY_KEY_INVALID' });
    expect(await prisma.order.count({ where: { userId: buyerId } })).toBe(before);
    expect(
      await prisma.orderIdempotencyKey.count({
        where: { idempotencyKey: { in: ['limit-key', 'zero-key', 'bad key'] } },
      })
    ).toBe(0);
  });

  it('creates a separate hold when the header is omitted', async () => {
    const first = await postOrder(buyerToken, [{ ticketTypeId: openTypeId, quantity: 1 }]);
    const second = await postOrder(buyerToken, [{ ticketTypeId: openTypeId, quantity: 1 }]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);
    expect(
      await prisma.orderIdempotencyKey.count({
        where: { orderId: { in: [first.body.data.id, second.body.data.id] } },
      })
    ).toBe(0);
  });

  it('replays the original response for the same key and body, and rejects a different body', async () => {
    const body = [{ ticketTypeId: openTypeId, quantity: 1 }];
    const key = 'buyer-attempt-1';
    const first = await postOrder(buyerToken, body, key);
    const replay = await postOrder(buyerToken, body, key);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(first.status);
    expect(replay.text).toBe(first.text);
    expect(replay.body).toEqual(first.body);
    const orders = await prisma.orderIdempotencyKey.findMany({
      where: { userId: buyerId, idempotencyKey: key },
    });
    expect(orders).toHaveLength(1);
    expect(await prisma.ticket.count({ where: { orderId: first.body.data.id } })).toBe(1);

    const mismatch = await postOrder(buyerToken, [{ ticketTypeId: openTypeId, quantity: 2 }], key);
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.errors).toEqual({ code: 'IDEMPOTENCY_KEY_MISMATCH' });
    expect(await prisma.ticket.count({ where: { orderId: first.body.data.id } })).toBe(1);
    expect(
      await prisma.orderIdempotencyKey.count({ where: { userId: buyerId, idempotencyKey: key } })
    ).toBe(1);

    const other = await postOrder(otherToken, body, key);
    expect(other.status).toBe(201);
    expect(other.body.data.id).not.toBe(first.body.data.id);
    expect(other.body.data.userId).toBe(otherId);
  });

  it('lets parallel duplicates create one hold and return the same order', async () => {
    const key = 'parallel-attempt';
    const body = [{ ticketTypeId: scarceTypeId, quantity: 1 }];
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => postOrder(buyerToken, body, key))
    );
    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(201));
    expect(new Set(responses.map((response) => response.text)).size).toBe(1);
    expect(new Set(responses.map((response) => response.body.data.id)).size).toBe(1);
    const orderId = responses[0].body.data.id as string;
    expect(await prisma.order.count({ where: { id: orderId } })).toBe(1);
    expect(await prisma.ticket.count({ where: { orderId, inventoryState: 'HELD' } })).toBe(1);
    expect(await prisma.ticketType.findUnique({ where: { id: scarceTypeId } })).toMatchObject({
      quantityAvailable: 0,
      quantityHeld: 1,
    });
    expect(
      await prisma.orderIdempotencyKey.count({ where: { userId: buyerId, idempotencyKey: key } })
    ).toBe(1);
  }, 30000);

  it('returns 409 SOLD_OUT for insufficient stock and does not cache that failure', async () => {
    const winner = await postOrder(
      buyerToken,
      [{ ticketTypeId: soldTypeId, quantity: 1 }],
      'sold-winner'
    );
    expect(winner.status).toBe(201);
    const soldOut = await postOrder(
      otherToken,
      [{ ticketTypeId: soldTypeId, quantity: 1 }],
      'sold-retry'
    );
    expect(soldOut.status).toBe(409);
    expect(soldOut.body.message).toBe('Not enough tickets available');
    expect(soldOut.body.errors).toEqual({ code: 'SOLD_OUT' });
    expect(
      await prisma.order.count({
        where: { eventId, tickets: { some: { ticketTypeId: soldTypeId } } },
      })
    ).toBe(1);

    const cancelled = await request(app)
      .post(`/api/v1/orders/${winner.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(cancelled.status).toBe(200);

    const retried = await postOrder(
      otherToken,
      [{ ticketTypeId: soldTypeId, quantity: 1 }],
      'sold-retry'
    );
    expect(retried.status).toBe(201);
    expect(retried.body.data.id).not.toBe(winner.body.data.id);
    const replay = await postOrder(
      otherToken,
      [{ ticketTypeId: soldTypeId, quantity: 1 }],
      'sold-retry'
    );
    expect(replay.status).toBe(201);
    expect(replay.text).toBe(retried.text);
    expect(
      await prisma.order.count({
        where: { tickets: { some: { ticketTypeId: soldTypeId } } },
      })
    ).toBe(2);
    expect(await prisma.ticket.count({ where: { orderId: retried.body.data.id } })).toBe(1);
  });
});
