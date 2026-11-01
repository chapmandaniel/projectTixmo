import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma } from '../utils/testUtils';

describe('public event listing dates', () => {
  const prefix = `listing-dates-${randomUUID()}`;

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(cleanupTestData);

  it('lists future and in-progress ON_SALE events and hides ended or dateless ones', async () => {
    const org = await prisma.organization.create({
      data: { name: prefix, slug: prefix, type: 'PROMOTER' },
    });
    const now = Date.now();
    const cases = [
      {
        key: 'in-progress',
        startDatetime: new Date(now - 60 * 60 * 1000),
        endDatetime: new Date(now + 60 * 60 * 1000),
        listed: true,
      },
      {
        key: 'future',
        startDatetime: new Date(now + 24 * 60 * 60 * 1000),
        endDatetime: new Date(now + 26 * 60 * 60 * 1000),
        listed: true,
      },
      {
        key: 'ended',
        startDatetime: new Date(now - 3 * 60 * 60 * 1000),
        endDatetime: new Date(now - 60 * 1000),
        listed: false,
      },
      {
        key: 'no-end',
        startDatetime: new Date(now + 24 * 60 * 60 * 1000),
        endDatetime: null,
        listed: false,
      },
      {
        key: 'no-dates',
        startDatetime: null,
        endDatetime: null,
        listed: false,
      },
    ] as const;

    for (const item of cases) {
      await prisma.event.create({
        data: {
          organizationId: org.id,
          name: `${prefix} ${item.key}`,
          slug: `${prefix}-${item.key}`,
          status: 'ON_SALE',
          startDatetime: item.startDatetime,
          endDatetime: item.endDatetime,
          tags: [],
        },
      });
    }

    const listed = await request(app)
      .get('/api/v1/events/public')
      .query({ search: prefix, limit: 20 });
    expect(listed.status).toBe(200);
    expect(listed.body.success).toBe(true);
    expect(listed.body.data.events.map((event: { slug: string }) => event.slug)).toEqual([
      `${prefix}-in-progress`,
      `${prefix}-future`,
    ]);
    expect(listed.body.data.pagination.total).toBe(2);

    for (const item of cases.filter((entry) => !entry.listed)) {
      const detail = await request(app).get(`/api/v1/events/public/${prefix}-${item.key}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.slug).toBe(`${prefix}-${item.key}`);
      expect(detail.body.data.status).toBe('ON_SALE');
    }
  });
});
