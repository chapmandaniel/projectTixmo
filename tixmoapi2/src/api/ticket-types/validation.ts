import { z } from 'zod';

// Prisma TicketTypeStatus. "Paused" is not a ticket-type value; event sales pause is separate.
export const ticketTypeStatusSchema = z.enum(['ACTIVE', 'HIDDEN', 'SOLD_OUT']);

export const createTicketTypeSchema = z.object({
  body: z.object({
    eventId: z.string().guid('Invalid event ID'),
    name: z.string().min(1, 'Ticket type name is required'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
    quantity: z.number().int().positive('Quantity must be positive'),
    maxPerOrder: z.number().int().positive().optional(),
    salesStart: z.string().datetime().optional(),
    salesEnd: z.string().datetime().optional(),
    metadata: z.any().optional(),
    status: ticketTypeStatusSchema.optional(),
    sortOrder: z.number().int().nonnegative().optional(),
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
    status: ticketTypeStatusSchema.optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  }),
});

export const listTicketTypesSchema = z.object({
  query: z.object({
    eventId: z.string().guid('Invalid event ID'),
    sortBy: z.enum(['price', 'status', 'sold', 'name', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});
