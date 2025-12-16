import { z } from 'zod';

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    phone: z.string().optional(),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    role: z.enum(['ADMIN', 'PROMOTER', 'CUSTOMER', 'SCANNER']).optional(),
  }),
});
