import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    organizationId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toLowerCase())
      .optional(),
  }),
});

export const dashboardQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
  }),
});
