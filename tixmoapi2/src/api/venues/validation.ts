import { z } from 'zod';

export const createVenueSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Venue name is required'),
    organizationId: z.string().uuid('Invalid organization ID'),
    address: z.object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      country: z.string().min(1, 'Country is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
    }),
    capacity: z.number().int().positive('Capacity must be a positive number'),
    description: z.string().optional(),
    timezone: z.string().optional(),
  }),
});

export const updateVenueSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Venue name is required').optional(),
    address: z
      .object({
        street: z.string().min(1, 'Street is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        country: z.string().min(1, 'Country is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
      })
      .optional(),
    capacity: z.number().int().positive('Capacity must be a positive number').optional(),
    description: z.string().optional(),
    timezone: z.string().optional(),
    seatingChart: z.any().optional(),
  }),
});

export const listVenuesSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    organizationId: z.string().uuid().optional(),
    city: z.string().optional(),
  }),
});
