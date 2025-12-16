import { faker } from '@faker-js/faker';
import { PromoCodeStatus } from '@prisma/client';

export interface PromoCodeFactoryOptions {
  organizationId: string;
  code?: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  status?: PromoCodeStatus;
}

export function createPromoCodeData(options: PromoCodeFactoryOptions) {
  const discountType =
    options.discountType || faker.helpers.arrayElement(['PERCENTAGE', 'FIXED_AMOUNT']);
  const discountValue =
    options.discountValue ||
    (discountType === 'PERCENTAGE'
      ? faker.number.int({ min: 10, max: 25 })
      : faker.number.int({ min: 5, max: 50 }));

  const now = new Date();
  const validFrom = new Date(now);
  validFrom.setDate(validFrom.getDate() - 30); // Valid from 30 days ago

  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 60); // Valid for 60 more days

  return {
    organizationId: options.organizationId,
    code: options.code || faker.string.alphanumeric(8).toUpperCase(),
    description: faker.lorem.sentence(),
    discountType,
    discountValue,
    maxUses: faker.number.int({ min: 50, max: 500 }),
    usesCount: faker.number.int({ min: 0, max: 20 }),
    validFrom,
    validUntil,
    minOrderValue: discountType === 'FIXED_AMOUNT' ? discountValue * 2 : null,
    status: options.status || PromoCodeStatus.ACTIVE,
  };
}
