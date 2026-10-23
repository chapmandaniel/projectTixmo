import { z } from 'zod';

export const listTicketsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).prefault('1'),
    limit: z.string().transform(Number).prefault('20'),
    eventId: z.string().guid('Invalid uuid').optional(),
    status: z.enum(['VALID', 'USED', 'CANCELLED', 'TRANSFERRED']).optional(),
  }),
});

export const transferTicketSchema = z.object({
  body: z.object({
    recipientEmail: z.string().email('Invalid email address'),
  }),
});
