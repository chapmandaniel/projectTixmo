import { z } from 'zod';

export const createPromoCodeSchema = z.object({
  body: z
    .object({
      code: z
        .string()
        .min(3, 'Code must be at least 3 characters')
        .max(50)
        .transform((val) => val.trim())
        .refine((val) => val.length >= 3, 'Code must not be empty or whitespace'),
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
      discountValue: z.number().positive('Discount value must be positive'),
      organizationId: z.string().uuid('Invalid organization ID'),
      eventId: z.string().uuid('Invalid event ID').optional(),
      maxUses: z.number().int().positive().optional(),
      validFrom: z.string().datetime().optional(),
      validUntil: z.string().datetime().optional(),
      minOrderAmount: z.number().min(0).optional(),
    })
    .refine(
      (data) => {
        if (data.validFrom && data.validUntil) {
          return new Date(data.validFrom) < new Date(data.validUntil);
        }
        return true;
      },
      {
        message: 'validFrom must be before validUntil',
        path: ['validFrom'],
      }
    )
    .refine(
      (data) => {
        if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
          return false;
        }
        return true;
      },
      {
        message: 'Percentage discount cannot exceed 100%',
        path: ['discountValue'],
      }
    ),
});

export const updatePromoCodeSchema = z.object({
  body: z
    .object({
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
      discountValue: z.number().positive('Discount value must be positive').optional(),
      maxUses: z.number().int().positive().optional(),
      maxUsesPerUser: z.number().int().positive().optional(),
      validFrom: z.string().datetime().optional(),
      validUntil: z.string().datetime().optional(),
      minOrderAmount: z.number().min(0).optional(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
    })
    .refine(
      (data) => {
        if (data.validFrom && data.validUntil) {
          return new Date(data.validFrom) < new Date(data.validUntil);
        }
        return true;
      },
      {
        message: 'validFrom must be before validUntil',
        path: ['validFrom'],
      }
    ),
});

export const validatePromoCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Code is required'),
    eventId: z.string().uuid('Invalid event ID').optional(),
    orderAmount: z.number().min(0, 'Order amount must be non-negative').optional(),
  }),
});

export const listPromoCodesSchema = z.object({
  query: z.object({
    page: z.string().optional().default('1').transform(Number),
    limit: z.string().optional().default('20').transform(Number),
    eventId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  }),
});
