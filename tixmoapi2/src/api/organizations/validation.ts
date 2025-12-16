import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    type: z.enum(['PROMOTER', 'VENUE', 'RESELLER']),
  }),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required').optional(),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
    stripeAccountId: z.string().optional(),
  }),
});

export const listOrganizationsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    type: z.enum(['PROMOTER', 'VENUE', 'RESELLER']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});
