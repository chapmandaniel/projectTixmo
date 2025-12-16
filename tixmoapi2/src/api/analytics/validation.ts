import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    organizationId: z.string().uuid().optional(),
  }),
});

export const dashboardQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
  }),
});
