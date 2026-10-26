import { readFileSync } from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { EventService, resolveEventTimeZone } from '../../../src/api/events/service';

jest.mock('../../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    event: { findUnique: jest.fn(), create: jest.fn() },
    ticketType: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../../src/config/prisma';

const organizationId = '123e4567-e89b-12d3-a456-426614174000';

const draft = (timezone?: string | null) => ({
  title: 'Harbour Night',
  description: '',
  organizationId,
  venueId: '',
  startDateTime: '',
  endDateTime: '',
  ...(timezone === undefined ? {} : { timezone: timezone as string }),
});

const createDb = () => {
  const db = {
    organization: { findUnique: jest.fn().mockResolvedValue({ id: organizationId }) },
    venue: { findUnique: jest.fn() },
    event: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: { timezone?: string | null } }) => ({
        id: 'event-1',
        ...data,
      })),
    },
  };
  return db;
};

describe('EventService create timezone', () => {
  const service = new EventService();

  it.each([undefined, '', '   ', null])(
    'stores America/St_Johns when timezone is %p',
    async (timezone) => {
      const db = createDb();
      const created = await service.createEvent(
        draft(timezone),
        db as unknown as Prisma.TransactionClient
      );

      expect(created.timezone).toBe('America/St_Johns');
      expect(db.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: 'America/St_Johns' }) as unknown,
        })
      );
    }
  );

  it('stores America/St_Johns when timezone is omitted', async () => {
    const db = createDb();
    const created = await service.createEvent(draft(), db as unknown as Prisma.TransactionClient);

    expect(created.timezone).toBe('America/St_Johns');
  });

  it.each(['America/Halifax', 'UTC', '  America/New_York  '])(
    'preserves an explicit timezone %p',
    async (timezone) => {
      const db = createDb();
      const created = await service.createEvent(
        draft(timezone),
        db as unknown as Prisma.TransactionClient
      );

      expect(created.timezone).toBe(timezone.trim());
      expect(db.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: timezone.trim() }) as unknown,
        })
      );
    }
  );

  it('does not rewrite a stored timezone when an update omits it or sends a blank value', async () => {
    const db = {
      $queryRaw: jest.fn(),
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'event-1',
          name: 'Show',
          status: 'DRAFT',
          deletedAt: null,
          startDatetime: null,
          endDatetime: null,
          timezone: 'America/Toronto',
        }),
        update: jest.fn(({ data }: { data: { timezone?: string } }) => ({
          id: 'event-1',
          ...data,
        })),
      },
    };
    const client = db as unknown as Prisma.TransactionClient;

    await service.updateEvent('event-1', { description: 'Updated copy' }, client);
    expect(db.event.update.mock.calls[0][0].data.timezone).toBeUndefined();

    await expect(service.updateEvent('event-1', { timezone: '' }, client)).rejects.toThrow(
      'Invalid IANA event timezone'
    );
    expect(db.event.update).toHaveBeenCalledTimes(1);

    await service.updateEvent('event-1', { timezone: 'UTC' }, client);
    expect(db.event.update.mock.calls[1][0].data.timezone).toBe('UTC');
  });

  it('rejects an explicit invalid timezone without writing', async () => {
    const db = createDb();
    await expect(
      service.createEvent(draft('not-a-zone'), db as unknown as Prisma.TransactionClient)
    ).rejects.toThrow('Invalid IANA event timezone');
    expect(db.event.create).not.toHaveBeenCalled();
  });

  it('defaults a cloned blank timezone and keeps an explicit one', async () => {
    const source = {
      id: 'source-event',
      name: 'Show',
      description: '',
      organizationId,
      venueId: null,
      capacity: null,
      category: null,
      tags: [],
      images: null,
      metadata: null,
      timezone: null as string | null,
      ticketTypes: [],
    };
    (prisma.$transaction as jest.Mock).mockImplementation((work: (tx: typeof prisma) => unknown) =>
      work(prisma)
    );
    (prisma.event.findUnique as jest.Mock).mockImplementation(
      (args: { where: { slug?: string } }) => (args.where.slug ? null : source)
    );
    (prisma.event.create as jest.Mock).mockImplementation(
      ({ data }: { data: { timezone: string } }) => ({
        id: 'copy',
        ...data,
      })
    );

    const blankCopy = await service.cloneEvent(source.id);
    expect(blankCopy.timezone).toBe('America/St_Johns');

    source.timezone = 'America/Toronto';
    const explicitCopy = await service.cloneEvent(source.id);
    expect(explicitCopy.timezone).toBe('America/Toronto');
    expect(resolveEventTimeZone('UTC')).toBe('UTC');
  });

  it('adds the column default without rewriting stored timezones', () => {
    const sql = readFileSync(
      path.join(
        __dirname,
        '../../../prisma/migrations/20261026031400_default_event_timezone_america_st_johns/migration.sql'
      ),
      'utf8'
    );
    expect(sql).toContain(
      `ALTER TABLE "events" ALTER COLUMN "timezone" SET DEFAULT 'America/St_Johns'`
    );
    expect(sql.toLowerCase()).not.toMatch(/\bupdate\b/);
    expect(sql.toLowerCase()).not.toContain('set timezone');
  });
});
