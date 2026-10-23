import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    organizationId: z.string().guid('Invalid uuid').optional(),
    eventId: z.string().guid('Invalid uuid').optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toLowerCase())
      .optional(),
  }),
});

export const dashboardQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().guid('Invalid uuid').optional(),
  }),
});
