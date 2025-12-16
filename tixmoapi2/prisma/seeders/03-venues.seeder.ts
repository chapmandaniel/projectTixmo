import { PrismaClient, Organization } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createVenueData } from '../factories/venue.factory';

export async function seedVenues(prisma: PrismaClient, organizations: Organization[]) {
  seedLogger.info('Seeding venues...');

  const venues = [];
  const venueCount = 10;

  for (let i = 0; i < venueCount; i++) {
    // Rotate through organizations
    const org = organizations[i % organizations.length];

    const venue = await prisma.venue.create({
      data: createVenueData({
        organizationId: org.id,
      }),
    });

    venues.push(venue);
    seedLogger.success(`Created venue: ${venue.name}`);
  }

  seedLogger.info(`✓ Created ${venues.length} venues total`);
  return venues;
}
