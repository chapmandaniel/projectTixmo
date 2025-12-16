import { PrismaClient, PromoCodeStatus, Organization } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createPromoCodeData } from '../factories/promo-code.factory';

export async function seedPromoCodes(prisma: PrismaClient, organizations: Organization[]) {
  seedLogger.info('Seeding promo codes...');

  const promoCodes = [];

  // Create well-known promo codes
  const wellKnownCodes = [
    {
      code: 'EARLYBIRD10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'STUDENT15',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'GROUP20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'FLASH25',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'VIP50',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50,
      status: PromoCodeStatus.ACTIVE,
    },
    {
      code: 'NEWYEAR25',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      status: PromoCodeStatus.EXPIRED,
    },
    {
      code: 'HOLIDAY20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      status: PromoCodeStatus.EXPIRED,
    },
  ];

  for (const codeData of wellKnownCodes) {
    const org = organizations[Math.floor(Math.random() * organizations.length)];
    const promoCode = await prisma.promoCode.create({
      data: createPromoCodeData({
        organizationId: org.id,
        code: codeData.code,
        discountType: codeData.discountType as any,
        discountValue: codeData.discountValue,
        status: codeData.status,
      }),
    });
    promoCodes.push(promoCode);
    seedLogger.success(`Created promo code: ${promoCode.code}`);
  }

  // Create additional random promo codes
  for (let i = 0; i < 7; i++) {
    const org = organizations[i % organizations.length];
    const promoCode = await prisma.promoCode.create({
      data: createPromoCodeData({
        organizationId: org.id,
      }),
    });
    promoCodes.push(promoCode);
  }

  seedLogger.info(`✓ Created ${promoCodes.length} promo codes total`);
  return promoCodes;
}
