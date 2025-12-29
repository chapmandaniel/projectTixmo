import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Event title is required'),
    description: z.string().optional(),
    organizationId: z.string().uuid('Invalid organization ID'),
    venueId: z.string().uuid('Invalid venue ID').optional(),
    startDateTime: z.string().datetime('Invalid start date/time').optional(),
    endDateTime: z.string().datetime('Invalid end date/time').optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).default('DRAFT'),
    capacity: z.number().int().positive().optional(),
    imageUrl: z.string().url().optional(),
    metadata: z.any().optional(),
  }),
});

export const publishEventSchema = z.object({
  body: z.object({
    venueId: z.string().uuid('Venue is required to publish'),
    startDateTime: z.string().datetime('Start date is required to publish'),
    endDateTime: z.string().datetime('End date is required to publish'),
    capacity: z.number().int().positive('Capacity is required to publish'),
  }),
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Event title is required').optional(),
    description: z.string().min(1, 'Description is required').optional(),
    venueId: z.string().uuid('Invalid venue ID').optional(),
    startDateTime: z.string().datetime('Invalid start date/time').optional(),
    endDateTime: z.string().datetime('Invalid end date/time').optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
    capacity: z.number().int().positive().optional(),
    imageUrl: z.string().url().optional(),
    metadata: z.any().optional(),
  }),
});

export const listEventsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    organizationId: z.string().uuid().optional(),
    venueId: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
    search: z.string().optional(),
  }),
});
