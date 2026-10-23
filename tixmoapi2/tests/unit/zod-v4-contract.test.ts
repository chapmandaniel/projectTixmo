import { z } from 'zod';
// Test-only historical oracle: this bundled parser is never used by application validation.
import { z as historical } from 'zod/v3';
import { createOrderSchema, listOrdersSchema } from '../../src/api/orders/validation';
import { getNotificationsSchema } from '../../src/api/notifications/validation';
import {
  createEventSchema,
  eventConfigurationSchema,
  salesPauseSchema,
} from '../../src/api/events/validation';
import { createApprovalBodySchema } from '../../src/api/approvals/validation';
import { loginSchema } from '../../src/api/auth/validation';
import { validate } from '../../src/middleware/validate';
import type { Request, Response, NextFunction } from 'express';

const looseId = '00000000-0000-0000-0000-000000000000';

describe('patched Zod 4 and retained HTTP validation contracts', () => {
  test.each(['max', 'length'] as const)(
    '%s rejects before walking oversized array children',
    async (bound) => {
      let visits = 0;
      const child = z.string().superRefine(() => {
        visits += 1;
      });
      const schema = z.array(child)[bound](2);
      const input = Array<string>(20).fill('synthetic');
      expect(schema.safeParse(input).success).toBe(false);
      expect(visits).toBe(0);
      const result = await schema.safeParseAsync(input);
      expect(result.success).toBe(false);
      expect(visits).toBe(0);
      if (!result.success) expect(result.error.issues).toHaveLength(1);
      let historicalVisits = 0;
      const old = historical
        .array(
          historical.string().superRefine(() => {
            historicalVisits += 1;
          })
        )
        [bound](2);
      expect(old.safeParse(input).success).toBe(false);
      expect(historicalVisits).toBe(20);
    }
  );

  test('existing event upper bound rejects oversized nested input without child issues', () => {
    const result = createEventSchema.safeParse({
      body: {
        title: 'Synthetic',
        startDateTime: '2027-01-01T00:00:00Z',
        endDateTime: '2027-01-02T00:00:00Z',
        tags: Array(21).fill(null),
      },
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.filter((issue) => issue.path[1] === 'tags')).toHaveLength(1);
  });

  test('min-only order arrays retain their existing contract, not a new universal resource cap', () => {
    const items = Array.from({ length: 101 }, () => ({ ticketTypeId: looseId, quantity: 1 }));
    expect(createOrderSchema.parse({ body: { items, ignored: true } })).toEqual({
      body: { items },
    });
  });

  test.each([undefined, '3'])(
    'pagination defaults and transforms preserve numeric output: %s',
    (page) => {
      const old = historical.object({
        query: historical.object({
          page: historical.string().transform(Number).default('1'),
          limit: historical.string().transform(Number).default('20'),
        }),
      });
      expect(listOrdersSchema.parse({ query: { page } })).toEqual(old.parse({ query: { page } }));
    }
  );

  test('outer optional notification fields stay absent while supplied values coerce', () => {
    expect(getNotificationsSchema.parse({ query: {} })).toEqual({ query: {} });
    expect(getNotificationsSchema.parse({ query: { page: '2', limit: '5' } })).toEqual({
      query: { page: 2, limit: 5 },
    });
  });

  test.each([looseId, 'abcdefab-cdef-0000-0000-abcdefabcdef'])(
    'historically accepted non-RFC UUID stays accepted: %s',
    (id) => {
      expect(historical.string().uuid().parse(id)).toBe(id);
      expect(
        createOrderSchema.parse({ body: { items: [{ ticketTypeId: id, quantity: 1 }] } }).body
          .items[0].ticketTypeId
      ).toBe(id);
    }
  );

  test('custom UUID messages and strict unknown-key rejection remain', () => {
    const invalid = createOrderSchema.safeParse({
      body: { items: [{ ticketTypeId: 'bad', quantity: 1 }] },
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0].message).toBe('Invalid ticket type ID');
    expect(
      salesPauseSchema.safeParse({
        params: { id: looseId },
        body: { paused: true, reason: 'Synthetic', requestId: looseId, extra: true },
      }).success
    ).toBe(false);
  });

  test('email preprocessing and arbitrary record keys remain compatible', () => {
    expect(
      loginSchema.parse({
        body: { email: ' BUYER+SYNTHETIC@EXAMPLE.TEST ', password: 'synthetic' },
      }).body.email
    ).toBe('buyer+synthetic@example.test');
    const input = { arbitrary: 'value', another: 2 };
    expect(z.record(z.string(), z.unknown()).parse(input)).toEqual(
      historical.record(historical.unknown()).parse(input)
    );
  });

  test('nested configuration defaults, optional omission and update-safe shapes stay intact', () => {
    const parsed = eventConfigurationSchema.parse({
      params: {},
      body: {
        event: {
          organizationId: looseId,
          title: 'Synthetic',
          startDateTime: '2027-01-01T00:00:00Z',
          endDateTime: '2027-01-02T00:00:00Z',
        },
        ticketTypes: [{ name: 'Synthetic', price: 1, quantity: 2 }],
      },
    });
    expect(parsed.body.publish).toBe(false);
    expect(parsed.body.ticketTypes[0]).toEqual({
      name: 'Synthetic',
      price: 1,
      quantity: 2,
      status: 'ACTIVE',
      tiers: [],
    });
    expect(parsed.body.event.description).toBe('');
    expect(parsed.body.event).not.toHaveProperty('venueId');
  });

  test('multipart reviewer preprocessing preserves trims and unknown-key stripping', () => {
    const parsed = createApprovalBodySchema.parse({
      eventId: looseId,
      title: ' Synthetic ',
      deadline: '2027-01-01T00:00:00Z',
      reviewers: JSON.stringify([{ email: 'buyer@example.test', name: ' Buyer ', ignored: true }]),
    });
    expect(parsed.title).toBe('Synthetic');
    expect(parsed.reviewers).toEqual([{ email: 'buyer@example.test', name: 'Buyer' }]);
  });

  test('bounded arrays also short-circuit in the non-JIT object parser', () => {
    const previous = z.config().jitless;
    z.config({ jitless: true });
    try {
      let visits = 0;
      const schema = z.object({
        rows: z
          .array(
            z.string().superRefine(() => {
              visits += 1;
            })
          )
          .max(2),
      });
      expect(schema.safeParse({ rows: Array<string>(20).fill('synthetic') }).success).toBe(false);
      expect(visits).toBe(0);
    } finally {
      z.config({ jitless: previous });
    }
  });

  test('middleware assigns parsed output and maps issues into the existing error envelope', async () => {
    const request = { body: {}, query: {}, params: {} } as Request;
    const next = jest.fn() as jest.MockedFunction<NextFunction>;
    await validate(listOrdersSchema)(request, {} as Response, next);
    expect(request.query).toEqual({ page: 1, limit: 20 });
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    request.body = { items: [{ ticketTypeId: 'bad', quantity: 1 }] };
    await validate(createOrderSchema)(request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        errors: [{ path: 'body.items.0.ticketTypeId', message: 'Invalid ticket type ID' }],
      })
    );
  });
});
