import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';
import { generateAccessToken } from '../../src/utils/jwt';

const STATUSES = ['ACTIVE', 'HIDDEN', 'SOLD_OUT'] as const;

describe('ticket type status', () => {
  let token: string;
  let organizationId: string;
  let venueId: string;

  beforeEach(async () => {
    await cleanupTestData();
    const org = await prisma.organization.create({
      data: { name: 'Status fixture', slug: randomUUID(), type: 'PROMOTER' },
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
        email: `status-${randomUUID()}@test.com`,
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

  const createEvent = async () =>
    prisma.event.create({
      data: {
        organizationId,
        venueId,
        name: 'Status event',
        slug: `status-${randomUUID()}`,
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86400000),
        endDatetime: new Date(Date.now() + 90000000),
        timezone: 'America/St_Johns',
        capacity: 30,
        tags: [],
      },
    });

  const createType = (eventId: string, status: (typeof STATUSES)[number], name: string) =>
    request(app)
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventId, name, price: 12, quantity: 20, status });

  it('persists every valid status on create and update and rejects Paused', async () => {
    const event = await createEvent();
    const created: string[] = [];
    for (const status of STATUSES) {
      const response = await createType(event.id, status, status);
      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe(status);
      const stored = await prisma.ticketType.findUnique({ where: { id: response.body.data.id } });
      expect(stored?.status).toBe(status);
      created.push(response.body.data.id);
    }

    const id = created[0];
    for (const status of STATUSES) {
      const response = await request(app)
        .put(`/api/v1/ticket-types/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(status);
      const stored = await prisma.ticketType.findUnique({ where: { id } });
      expect(stored?.status).toBe(status);
    }

    const rejected = await request(app)
      .put(`/api/v1/ticket-types/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PAUSED' });
    expect(rejected.status).toBe(400);
    expect((await prisma.ticketType.findUnique({ where: { id } }))?.status).toBe('SOLD_OUT');
  });

  it('omits hidden ticket types from the public event used by the event page and checkout', async () => {
    const event = await createEvent();
    const hidden = await createType(event.id, 'HIDDEN', 'Staff hold');
    const soldOut = await createType(event.id, 'SOLD_OUT', 'Balcony');
    const active = await createType(event.id, 'ACTIVE', 'General admission');
    expect(hidden.status).toBe(201);
    expect(soldOut.status).toBe(201);
    expect(active.status).toBe(201);

    const listed = await request(app)
      .get('/api/v1/ticket-types')
      .query({ eventId: event.id })
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    const organizerRows = Array.isArray(listed.body.data)
      ? listed.body.data
      : listed.body.data.ticketTypes;
    expect(organizerRows.map((row: { status: string }) => row.status).sort()).toEqual([
      'ACTIVE',
      'HIDDEN',
      'SOLD_OUT',
    ]);

    const published = await request(app).get(`/api/v1/events/public/${event.slug}`);
    expect(published.status).toBe(200);
    const publicRows = published.body.data.ticketTypes as Array<{ id: string; status: string }>;
    expect(publicRows.map((row) => row.id).sort()).toEqual(
      [active.body.data.id, soldOut.body.data.id].sort()
    );
    expect(publicRows.find((row) => row.id === soldOut.body.data.id)?.status).toBe('SOLD_OUT');
    expect(publicRows.some((row) => row.id === hidden.body.data.id)).toBe(false);
  });
});
