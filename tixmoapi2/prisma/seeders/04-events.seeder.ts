import { PrismaClient, EventStatus, Organization, Venue } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createEventData } from '../factories/event.factory';

export async function seedEvents(
  prisma: PrismaClient,
  organizations: Organization[],
  venues: Venue[]
) {
  seedLogger.info('Seeding events...');

  const events = [];
  const eventCount = 25;

  // Status distribution: 40% ON_SALE, 20% PUBLISHED, 15% SOLD_OUT, 10% COMPLETED, 10% DRAFT, 5% CANCELLED
  const statusDistribution = [
    ...Array(10).fill(EventStatus.ON_SALE),
    ...Array(5).fill(EventStatus.PUBLISHED),
    ...Array(4).fill(EventStatus.SOLD_OUT),
    ...Array(2).fill(EventStatus.COMPLETED),
    ...Array(2).fill(EventStatus.DRAFT),
    ...Array(2).fill(EventStatus.CANCELLED),
  ];

  for (let i = 0; i < eventCount; i++) {
    // Use promoter organizations only
    const promoterOrgs = organizations.filter((o) => o.type === 'PROMOTER');
    const org = promoterOrgs[i % promoterOrgs.length];
    const venue = venues[i % venues.length];
    const status = statusDistribution[i % statusDistribution.length];

    const event = await prisma.event.create({
      data: createEventData({
        organizationId: org.id,
        venueId: venue.id,
        status,
      }),
    });

    events.push(event);
    seedLogger.success(`Created event: ${event.name} (${event.status})`);
  }

  seedLogger.info(`✓ Created ${events.length} events total`);
  return events;
}
