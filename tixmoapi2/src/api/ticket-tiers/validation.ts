import { z } from 'zod';

export const createTierSchema = z.object({
    body: z.object({
        ticketTypeId: z.string().uuid(),
        name: z.string().min(1).max(100),
        price: z.number().nonnegative(),
        quantityLimit: z.number().int().positive().optional().nullable(),
        startsAt: z.string().datetime().optional().nullable(),
        endsAt: z.string().datetime().optional().nullable(),
        sortOrder: z.number().int().nonnegative().optional().default(0),
    }),
});

export const updateTierSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        price: z.number().nonnegative().optional(),
        quantityLimit: z.number().int().positive().optional().nullable(),
        startsAt: z.string().datetime().optional().nullable(),
        endsAt: z.string().datetime().optional().nullable(),
        sortOrder: z.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const listTiersSchema = z.object({
    query: z.object({
        ticketTypeId: z.string().uuid(),
    }),
});

export const tierIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const reorderTiersSchema = z.object({
    body: z.object({
        ticketTypeId: z.string().uuid(),
        tierIds: z.array(z.string().uuid()).min(1),
    }),
});
