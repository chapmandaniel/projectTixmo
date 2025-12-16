import { PrismaClient, OrganizationType } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createOrganizationData } from '../factories/organization.factory';

export async function seedOrganizations(prisma: PrismaClient) {
  seedLogger.info('Seeding organizations...');

  const organizations = [];

  // Create promoter organizations
  const promoterOrgs = [
    { name: 'Starlight Events', type: OrganizationType.PROMOTER },
    { name: 'Underground Productions', type: OrganizationType.PROMOTER },
    { name: 'Champions Sports Group', type: OrganizationType.PROMOTER },
  ];

  for (const orgData of promoterOrgs) {
    const org = await prisma.organization.create({
      data: createOrganizationData(orgData),
    });
    organizations.push(org);
    seedLogger.success(`Created organization: ${org.name}`);
  }

  // Create venue organizations
  const venueOrgs = [
    { name: 'The Grand Theater', type: OrganizationType.VENUE },
    { name: 'Metro Convention Center', type: OrganizationType.VENUE },
  ];

  for (const orgData of venueOrgs) {
    const org = await prisma.organization.create({
      data: createOrganizationData(orgData),
    });
    organizations.push(org);
    seedLogger.success(`Created organization: ${org.name}`);
  }

  // Create reseller organization
  const reseller = await prisma.organization.create({
    data: createOrganizationData({
      name: 'TicketHub Resale',
      type: OrganizationType.RESELLER,
    }),
  });
  organizations.push(reseller);
  seedLogger.success(`Created organization: ${reseller.name}`);

  seedLogger.info(`✓ Created ${organizations.length} organizations total`);
  return organizations;
}
