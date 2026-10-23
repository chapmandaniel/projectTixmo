import { z } from 'zod';

const userRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'PROMOTER',
  'CUSTOMER',
  'SCANNER',
  'TEAM_MEMBER',
]);

// Schema for creating a new user (Team Member)
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: userRoleSchema,
    organizationId: z.string().guid('Invalid uuid').optional(),
    title: z.string().optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
    password: z.string().min(8).optional(), // Optional, generates random if not provided
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    phone: z.string().optional(),
    title: z.string().nullable().optional(),
    role: userRoleSchema.optional(),
    organizationId: z.string().guid('Invalid uuid').nullable().optional(),
    permissions: z.record(z.string(), z.boolean()).nullable().optional(),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).prefault('1'),
    limit: z.string().transform(Number).prefault('20'),
    role: userRoleSchema.optional(),
    organizationId: z.string().guid('Invalid uuid').optional(),
  }),
});

export const resendInvitationSchema = z.object({
  params: z.object({ id: z.string().guid('Invalid uuid') }),
});
