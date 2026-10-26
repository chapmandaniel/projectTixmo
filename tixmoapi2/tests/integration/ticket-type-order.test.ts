import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { generateAccessToken } from '../../src/utils/jwt';

const ids = (response: request.Response) => {
  expect(response.status).toBe(200);
  const rows = response.body.data.ticketTypes || response.body.data;
  expect(Array.isArray(rows)).toBe(true);
  return rows.map((row: { id: string }) => row.id);
};

describe('ticket type display order', () => {
  let token: string;
  let organizationId: string;
  let venueId: string;

  beforeEach(async () => {
    await cleanupTestData();
    const org = await prisma.organization.create({
      data: { name: 'Order fixture', slug: randomUUID(), type: 'PROMOTER' },
    });
    const venue = await prisma.venue.create({
      data: {
        organizationId: org.id,
        name: 'Venue',
        capacity: 100,
        address: {},
        timezone: 'America/St_Johns',
      },
    });
    const owner = await prisma.user.create({
      data: {
        organizationId: org.id,
        role: 'OWNER',
        email: `order-${randomUUID()}@test.com`,
        firstName: 'Test',
        lastName: 'Owner',
        passwordHash: 'synthetic',
      },
    });
    organizationId = org.id;
    venueId = venue.id;
    token = generateAccessToken({ userId: owner.id, email: owner.email, role: owner.role });
  });

  afterAll(cleanupTestData);

  const eventInput = (title: string) => ({
    title,
    description: '',
    organizationId,
    venueId,
    startDateTime: new Date(Date.now() + 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 90000000).toISOString(),
    timezone: 'America/St_Johns',
    capacity: 30,
    tags: ['order'],
  });

  it('returns creation order when every sort order is unset, even if ids sort the other way', async () => {
    const event = await prisma.event.create({
      data: {
        organizationId,
        venueId,
        name: 'Creation order',
        slug: `creation-${randomUUID()}`,
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86400000),
        endDatetime: new Date(Date.now() + 90000000),
        timezone: 'America/St_Johns',
        capacity: 30,
        tags: [],
      },
    });
    const createdFirst = 'ffffffff-ffff-4fff-8fff-000000000001';
    const createdSecond = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
    const createdThird = '00000000-0000-4000-8000-000000000003';
    const rows = [
      { id: createdThird, name: 'Third', createdAt: new Date('2026-01-03T00:00:00.000Z') },
      { id: createdFirst, name: 'First', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: createdSecond, name: 'Second', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ];
    for (const row of rows) {
      await prisma.ticketType.create({
        data: {
          id: row.id,
          eventId: event.id,
          name: row.name,
          price: 10,
          quantityTotal: 10,
          quantityAvailable: 10,
          sortOrder: 0,
          createdAt: row.createdAt,
          status: 'ACTIVE',
        },
      });
    }

    const createdAtOrder = [createdFirst, createdSecond, createdThird];
    expect(await ids(await request(app).get(`/api/v1/events/public/${event.slug}`))).toEqual(
      createdAtOrder
    );
    const listed = await request(app)
      .get('/api/v1/events/public')
      .query({ search: 'Creation order' });
    expect(listed.status).toBe(200);
    expect(
      listed.body.data.events
        .find((item: { id: string }) => item.id === event.id)
        .ticketTypes.map((row: { id: string }) => row.id)
    ).toEqual(createdAtOrder);
    expect(
      await ids(
        await request(app)
          .get('/api/v1/ticket-types')
          .query({ eventId: event.id })
          .set('Authorization', `Bearer ${token}`)
      )
    ).toEqual(createdAtOrder);

    const promoted = await request(app)
      .put(`/api/v1/ticket-types/${createdFirst}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sortOrder: 2 });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.sortOrder).toBe(2);
    const overridden = [createdSecond, createdThird, createdFirst];
    expect(await ids(await request(app).get(`/api/v1/events/public/${event.slug}`))).toEqual(
      overridden
    );

    const preserved = await request(app)
      .put(`/api/v1/ticket-types/${createdFirst}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'First renamed' });
    expect(preserved.status).toBe(200);
    expect(
      (await prisma.ticketType.findUniqueOrThrow({ where: { id: createdFirst } })).sortOrder
    ).toBe(2);
  });

  it('stores configuration sort orders and keeps them when an update omits the field', async () => {
    const title = `Sorted ${randomUUID()}`;
    const created = await request(app)
      .post('/api/v1/events/configuration')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event: eventInput(title),
        publish: true,
        ticketTypes: [
          { name: 'Opens last', price: 5, quantity: 10, sortOrder: 2 },
          { name: 'Opens first', price: 50, quantity: 10, sortOrder: 0 },
          { name: 'Opens next', price: 20, quantity: 10, sortOrder: 1 },
        ],
      });
    expect(created.status).toBe(201);
    const eventId = created.body.data.id as string;
    const stored = await prisma.ticketType.findMany({ where: { eventId } });
    const byName = Object.fromEntries(stored.map((row) => [row.name, row]));
    expect(byName['Opens last'].sortOrder).toBe(2);
    expect(byName['Opens first'].sortOrder).toBe(0);
    expect(byName['Opens next'].sortOrder).toBe(1);
    const sortOrder = [byName['Opens first'].id, byName['Opens next'].id, byName['Opens last'].id];
    expect(
      await ids(await request(app).get(`/api/v1/events/public/${created.body.data.slug}`))
    ).toEqual(sortOrder);
    expect(
      await ids(
        await request(app)
          .get('/api/v1/ticket-types')
          .query({ eventId })
          .set('Authorization', `Bearer ${token}`)
      )
    ).toEqual(sortOrder);
    const byPrice = await request(app)
      .get('/api/v1/ticket-types')
      .query({ eventId, sortBy: 'price', sortOrder: 'asc' })
      .set('Authorization', `Bearer ${token}`);
    expect(await ids(byPrice)).toEqual([
      byName['Opens last'].id,
      byName['Opens next'].id,
      byName['Opens first'].id,
    ]);

    const updated = await request(app)
      .put(`/api/v1/events/${eventId}/configuration`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        event: eventInput(title),
        publish: false,
        ticketTypes: ['Opens last', 'Opens first', 'Opens next'].map((name) => ({
          id: byName[name].id,
          name,
          price: Number(byName[name].price),
          quantity: byName[name].quantityTotal,
          status: 'ACTIVE',
          description: name === 'Opens last' ? 'still last' : undefined,
          tiers: [],
        })),
      });
    expect(updated.status).toBe(200);
    const after = await prisma.ticketType.findMany({ where: { eventId } });
    const afterByName = Object.fromEntries(after.map((row) => [row.name, row]));
    expect(afterByName['Opens last'].sortOrder).toBe(2);
    expect(afterByName['Opens last'].description).toBe('still last');
    expect(afterByName['Opens first'].sortOrder).toBe(0);
    expect(afterByName['Opens next'].sortOrder).toBe(1);
    expect(
      await ids(await request(app).get(`/api/v1/events/public/${created.body.data.slug}`))
    ).toEqual(sortOrder);

    const plain = await request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, name: 'Plain', price: 5, quantity: 5 });
    expect(plain.status).toBe(201);
    expect(plain.body.data.sortOrder).toBe(0);
  });
});
