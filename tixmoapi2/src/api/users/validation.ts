import { z } from 'zod';

// Schema for creating a new user (Team Member)
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['OWNER', 'ADMIN', 'PROMOTER', 'CUSTOMER', 'SCANNER', 'TEAM_MEMBER']),
    organizationId: z.string().uuid().optional(),
    title: z.string().optional(),
    permissions: z.record(z.boolean()).optional(),
    password: z.string().min(8).optional(), // Optional, generates random if not provided
  }),
});

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
    role: z.enum(['OWNER', 'ADMIN', 'PROMOTER', 'CUSTOMER', 'SCANNER', 'TEAM_MEMBER']).optional(),
  }),
});
