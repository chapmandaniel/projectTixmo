import { randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';

const { isUpcoming, UPCOMING_SQL, ENDED_SQL } = require('../../prisma/lib/upcoming.cjs');

afterAll(async () => {
  await prisma.$disconnect();
});

test('upcoming SQL treats Prisma event bounds as UTC when the session TimeZone is not UTC', async () => {
  const key = `upcoming-tz-${randomUUID()}`;
  const organization = await prisma.organization.create({
    data: { name: key, slug: key, type: 'PROMOTER' },
  });
  const ended = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: `${key}-ended`,
      slug: `${key}-ended`,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() - 2 * 60 * 60_000),
      endDatetime: new Date(Date.now() - 60_000),
    },
  });
  const upcoming = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: `${key}-upcoming`,
      slug: `${key}-upcoming`,
      status: 'ON_SALE',
      startDatetime: new Date(Date.now() + 60 * 60_000),
      endDatetime: new Date(Date.now() + 2 * 60 * 60_000),
    },
  });

  expect(isUpcoming(ended, new Date())).toBe(false);
  expect(isUpcoming(upcoming, new Date())).toBe(true);

  const comparison = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone', 'America/St_Johns', true)`;
    const diagnostic = await tx.$queryRaw<
      Array<{ naive_upcoming: boolean; utc_upcoming: boolean }>
    >`
      SELECT
        COALESCE(end_datetime, start_datetime) > now() AS naive_upcoming,
        COALESCE(end_datetime, start_datetime) > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS utc_upcoming
      FROM events
      WHERE id = ${ended.id}
    `;
    const endedBySql = await tx.$queryRawUnsafe<Array<{ upcoming: boolean; ended: boolean }>>(
      `SELECT (${UPCOMING_SQL}) AS upcoming, (${ENDED_SQL}) AS ended FROM events WHERE id = $1`,
      ended.id
    );
    const upcomingBySql = await tx.$queryRawUnsafe<Array<{ upcoming: boolean; ended: boolean }>>(
      `SELECT (${UPCOMING_SQL}) AS upcoming, (${ENDED_SQL}) AS ended FROM events WHERE id = $1`,
      upcoming.id
    );
    return {
      diagnostic: diagnostic[0],
      endedBySql: endedBySql[0],
      upcomingBySql: upcomingBySql[0],
    };
  });

  expect(comparison.diagnostic).toEqual({ naive_upcoming: true, utc_upcoming: false });
  expect(comparison.endedBySql).toEqual({ upcoming: false, ended: true });
  expect(comparison.upcomingBySql).toEqual({ upcoming: true, ended: false });
  expect(UPCOMING_SQL).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'UTC'");
  expect(ENDED_SQL).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'UTC'");
});
