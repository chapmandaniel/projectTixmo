import { z } from 'zod';

export const deletedEventsQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
  }),
});
import { createTierSchema } from '../ticket-tiers/validation';
import { createTicketTypeSchema } from '../ticket-types/validation';

/**
 * All valid EventStatus values from the Prisma schema
 */
const eventStatusValues = [
  'DRAFT',
  'PUBLISHED',
  'ON_SALE',
  'SOLD_OUT',
  'CANCELLED',
  'COMPLETED',
  'DELETED',
] as const;

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(5000).optional().default(''),
    organizationId: z.string().uuid('Invalid organization ID'),
    venueId: z.string().uuid('Invalid venue ID').optional(),
    startDateTime: z.string().datetime().optional(),
    endDateTime: z.string().datetime().optional(),
    status: z.enum(['DRAFT']).optional().default('DRAFT'), // New events can only be DRAFT
    capacity: z.number().int().positive().optional(),
    imageUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional(),
    category: z.string().max(100).optional(),
    timezone: z.string().max(50).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    venueId: z.string().uuid('Invalid venue ID').optional(),
    startDateTime: z.string().datetime().optional(),
    endDateTime: z.string().datetime().optional(),
    status: z.enum(eventStatusValues).optional(),
    capacity: z.number().int().positive().optional(),
    imageUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional(),
    category: z.string().max(100).optional(),
    timezone: z.string().max(50).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const publishEventSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
});

export const listEventsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(20),
    organizationId: z.string().uuid().optional(),
    venueId: z.string().uuid().optional(),
    status: z.enum(eventStatusValues).optional(),
    search: z.string().max(200).optional(),
  }),
});

export const updateEventStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    status: z.enum(eventStatusValues),
  }),
});

export const eventConfigurationSchema = z.object({
  params: z.object({ id: z.string().uuid().optional() }),
  body: z.object({
    event: createEventSchema.shape.body.omit({ status: true }),
    ticketTypes: z
      .array(
        createTicketTypeSchema.shape.body.omit({ eventId: true }).extend({
          id: z.string().uuid().optional(),
          status: z.enum(['ACTIVE', 'HIDDEN', 'SOLD_OUT']).default('ACTIVE'),
          tiers: z
            .array(
              createTierSchema.shape.body.omit({ ticketTypeId: true }).extend({
                id: z.string().uuid().optional(),
                isActive: z.boolean().default(true),
              })
            )
            .max(100)
            .default([]),
        })
      )
      .max(100),
    publish: z.boolean().default(false),
  }),
});
