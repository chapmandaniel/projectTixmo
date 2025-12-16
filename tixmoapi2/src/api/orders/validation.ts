import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          ticketTypeId: z.string().uuid('Invalid ticket type ID'),
          quantity: z.number().int().positive('Quantity must be positive'),
        })
      )
      .min(1, 'Order must contain at least one item'),
    promoCode: z.string().optional(),
  }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  }),
});
