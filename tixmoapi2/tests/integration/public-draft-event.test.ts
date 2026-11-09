import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';

describe('public draft event links', () => {
  const prefix = `draft-link-${randomUUID()}`;

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(cleanupTestData);

  it('returns a draft as not open for sale and keeps it off the public list', async () => {
    const org = await prisma.organization.create({
      data: { name: prefix, slug: prefix, type: 'PROMOTER' },
    });
    const past = new Date('2020-01-01T00:00:00.000Z');
    const dated = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: `${prefix} dated draft`,
        slug: `${prefix}-dated`,
        status: 'DRAFT',
        startDatetime: past,
        endDatetime: new Date('2020-01-01T03:00:00.000Z'),
        tags: [],
        ticketTypes: {
          create: {
            name: 'General admission',
            price: 25,
            quantityTotal: 8,
            quantityAvailable: 8,
          },
        },
      },
      include: { ticketTypes: true },
    });
    await prisma.event.create({
      data: {
        organizationId: org.id,
        name: `${prefix} undated draft`,
        slug: `${prefix}-undated`,
        status: 'DRAFT',
        startDatetime: null,
        endDatetime: null,
        tags: [],
      },
    });
    await prisma.event.create({
      data: {
        organizationId: org.id,
        name: `${prefix} deleted draft`,
        slug: `${prefix}-deleted`,
        status: 'DRAFT',
        deletedAt: new Date(),
        tags: [],
      },
    });
    await prisma.event.create({
      data: {
        organizationId: org.id,
        name: `${prefix} cancelled`,
        slug: `${prefix}-cancelled`,
        status: 'CANCELLED',
        startDatetime: null,
        endDatetime: null,
        tags: [],
      },
    });

    const listed = await request(app)
      .get('/api/v1/events/public')
      .query({ search: prefix, limit: 20 });
    expect(listed.status).toBe(200);
    expect(listed.body.data.events).toEqual([]);

    const datedPage = await request(app).get(`/api/v1/events/public/${prefix}-dated`);
    expect(datedPage.status).toBe(200);
    expect(datedPage.body.data).toMatchObject({
      id: dated.id,
      name: `${prefix} dated draft`,
      slug: `${prefix}-dated`,
      status: 'DRAFT',
      ended: false,
      undated: true,
    });
    expect(datedPage.body.data.ticketTypes).toEqual([
      expect.objectContaining({ id: dated.ticketTypes[0].id, name: 'General admission' }),
    ]);

    const undatedPage = await request(app).get(`/api/v1/events/public/${prefix}-undated`);
    expect(undatedPage.status).toBe(200);
    expect(undatedPage.body.data).toMatchObject({
      status: 'DRAFT',
      ended: false,
      undated: true,
    });

    expect((await request(app).get(`/api/v1/events/public/${prefix}-deleted`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/events/public/${prefix}-cancelled`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/events/public/${prefix}-missing`)).status).toBe(404);
  });
});
