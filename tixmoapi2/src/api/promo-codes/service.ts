import { ApiError } from '../../utils/ApiError';
import { Decimal } from '@prisma/client/runtime/library';
import { PromoCode, PromoCodeStatus, DiscountType, Prisma } from '@prisma/client';

import prisma from '../../config/prisma';

interface CreatePromoCodeInput {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  organizationId: string;
  eventId?: string;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  minOrderAmount?: number;
}

interface UpdatePromoCodeInput {
  discountType?: DiscountType;
  discountValue?: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  minOrderAmount?: number;
  status?: PromoCodeStatus;
}

interface ListPromoCodesParams {
  page?: number;
  limit?: number;
  eventId?: string;
  organizationId?: string;
  status?: PromoCodeStatus;
}

interface PaginatedPromoCodes {
  promoCodes: PromoCode[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class PromoCodeService {
  /**
   * Create a new promo code
   */
  async createPromoCode(data: CreatePromoCodeInput): Promise<PromoCode> {
    // Check if code already exists
    const existing = await prisma.promoCode.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      throw ApiError.conflict('Promo code already exists');
    }

    // Check if organization exists
    const org = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }

    // If eventId provided, check if event exists
    if (data.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
      });

      if (!event) {
        throw ApiError.notFound('Event not found');
      }
    }

    // Validate discount value for percentage
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw ApiError.badRequest('Percentage discount cannot exceed 100%');
    }

    // Set default dates if not provided (1 year validity)
    const validFrom = data.validFrom ? new Date(data.validFrom) : new Date();
    const validUntil = data.validUntil
      ? new Date(data.validUntil)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    // Create promo code
    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code.toUpperCase(),
        organizationId: data.organizationId,
        discountType: data.discountType,
        discountValue: new Decimal(data.discountValue),
        maxUses: data.maxUses,
        validFrom,
        validUntil,
        applicableEvents: data.eventId ? [data.eventId] : [],
        minOrderValue: data.minOrderAmount ? new Decimal(data.minOrderAmount) : null,
        status: 'ACTIVE',
        usesCount: 0,
      },
    });

    return promoCode;
  }

  /**
   * Get promo code by ID
   */
  async getPromoCodeById(id: string): Promise<PromoCode | null> {
    return await prisma.promoCode.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get promo code by code string
   */
  async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    return await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  /**
   * Update promo code
   */
  async updatePromoCode(id: string, data: UpdatePromoCodeInput): Promise<PromoCode> {
    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Promo code not found');
    }

    // Validate discount value for percentage
    const discountType = data.discountType || existing.discountType;
    if (discountType === 'PERCENTAGE' && data.discountValue && data.discountValue > 100) {
      throw ApiError.badRequest('Percentage discount cannot exceed 100%');
    }

    const updateData: Partial<Prisma.PromoCodeUpdateInput> = {};

    if (data.discountType) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined)
      updateData.discountValue = new Decimal(data.discountValue) as unknown as Prisma.Decimal;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.status) updateData.status = data.status;

    if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);
    if (data.minOrderAmount !== undefined) {
      updateData.minOrderValue = data.minOrderAmount
        ? (new Decimal(data.minOrderAmount) as unknown as Prisma.Decimal)
        : null;
    }

    return await prisma.promoCode.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete promo code
   */
  async deletePromoCode(id: string): Promise<void> {
    const existing = await prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Promo code not found');
    }

    // Check if it has been used
    if (existing.usesCount > 0) {
      throw ApiError.badRequest('Cannot delete promo code that has been used');
    }

    await prisma.promoCode.delete({
      where: { id },
    });
  }

  /**
   * List promo codes with pagination
   */
  async listPromoCodes(params: ListPromoCodesParams): Promise<PaginatedPromoCodes> {
    const { page = 1, limit = 20, eventId, organizationId, status } = params;
    const skip = (page - 1) * limit;

    // Use a loose-typed where clause here because the applicableEvents filter is a
    // StringNullableListFilter in Prisma which is tricky to express precisely in this context.
    // We intentionally keep runtime behavior the same and narrow/validate when necessary.
    const where: Prisma.PromoCodeWhereInput = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (eventId) {
      where.applicableEvents = { has: eventId };
    }

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.promoCode.count({ where }),
    ]);

    return {
      promoCodes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Validate and calculate discount for a promo code
   */
  async validatePromoCode(
    code: string,
    _userId: string,
    eventId?: string,
    orderAmount?: number
  ): Promise<{
    valid: boolean;
    promoCode?: PromoCode;
    discountAmount?: number;
    reason?: string;
  }> {
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return {
        valid: false,
        reason: 'Promo code not found',
      };
    }

    // Check if active
    if (promoCode.status !== 'ACTIVE') {
      return {
        valid: false,
        promoCode,
        reason: `Promo code is ${promoCode.status.toLowerCase()}`,
      };
    }

    // Check valid date range
    const now = new Date();
    if (now < promoCode.validFrom) {
      return {
        valid: false,
        promoCode,
        reason: 'Promo code is not yet valid',
      };
    }
    if (now > promoCode.validUntil) {
      return {
        valid: false,
        promoCode,
        reason: 'Promo code has expired',
      };
    }

    // Check max uses
    if (promoCode.maxUses && promoCode.usesCount >= promoCode.maxUses) {
      return {
        valid: false,
        promoCode,
        reason: 'Promo code has reached maximum uses',
      };
    }

    // Check event restriction
    if (eventId && promoCode.applicableEvents.length > 0) {
      if (!promoCode.applicableEvents.includes(eventId)) {
        return {
          valid: false,
          promoCode,
          reason: 'Promo code is not valid for this event',
        };
      }
    }

    // Check minimum order value
    if (promoCode.minOrderValue && orderAmount) {
      if (new Decimal(orderAmount).lessThan(promoCode.minOrderValue)) {
        return {
          valid: false,
          promoCode,
          reason: `Minimum order amount is ${promoCode.minOrderValue.toString()}`,
        };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (orderAmount) {
      if (promoCode.discountType === 'PERCENTAGE') {
        discountAmount = new Decimal(orderAmount).mul(promoCode.discountValue).div(100).toNumber();
      } else {
        discountAmount = promoCode.discountValue.toNumber();
        // Don't let fixed discount exceed order amount
        if (discountAmount > orderAmount) {
          discountAmount = orderAmount;
        }
      }
    }

    return {
      valid: true,
      promoCode,
      discountAmount,
    };
  }
}

export const promoCodeService = new PromoCodeService();
