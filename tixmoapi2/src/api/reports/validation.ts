import { z } from 'zod';

const currency = z
  .string()
  .regex(/^[a-zA-Z]{3}$/)
  .transform((value) => value.toLowerCase())
  .optional()
  .default('cad');

/**
 * Get sales report validation schema
 */
export const getSalesReportSchema = z.object({
  query: z.object({
    organizationId: z.string().guid('Invalid uuid').optional(),
    eventId: z.string().guid('Invalid uuid').optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'event']).optional().default('day'),
    currency,
  }),
});

/**
 * Get attendance report validation schema
 */
export const getAttendanceReportSchema = z.object({
  query: z.object({
    eventId: z.string().guid('Event ID is required'),
  }),
});

/**
 * Get dashboard stats validation schema
 */
export const getDashboardStatsSchema = z.object({
  query: z.object({
    organizationId: z.string().guid('Invalid uuid').optional(),
    currency,
  }),
});
