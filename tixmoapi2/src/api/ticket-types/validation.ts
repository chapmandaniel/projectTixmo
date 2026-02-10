import { z } from 'zod';

export const createTicketTypeSchema = z.object({
  body: z.object({
    eventId: z.string().uuid('Invalid event ID'),
    name: z.string().min(1, 'Ticket type name is required'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
    quantity: z.number().int().positive('Quantity must be positive'),
    maxPerOrder: z.number().int().positive().optional(),
    salesStart: z.string().datetime().optional(),
    salesEnd: z.string().datetime().optional(),
    metadata: z.any().optional(),
  }),
});

export const updateTicketTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Ticket type name is required').optional(),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative').optional(),
    quantity: z.number().int().positive('Quantity must be positive').optional(),
    maxPerOrder: z.number().int().positive().optional(),
    salesStart: z.string().datetime().optional(),
    salesEnd: z.string().datetime().optional(),
    metadata: z.any().optional(),
  }),
});

export const listTicketTypesSchema = z.object({
  query: z.object({
    eventId: z.string().uuid('Invalid event ID'),
    sortBy: z.enum(['price', 'status', 'sold', 'name', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});
