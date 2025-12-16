import { PrismaClient, User, Organization, Event } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createScannerData } from '../factories/scanner.factory';

export async function seedScanners(
  prisma: PrismaClient,
  users: User[],
  organizations: Organization[],
  events: Event[]
) {
  seedLogger.info('Seeding scanners...');

  const scanners = [];

  // Get admin users to be creators
  const admins = users.filter((u) => u.role === 'ADMIN');
  const admin = admins[0];

  // Create 1-2 scanners per organization
  for (const org of organizations) {
    // General scanner for the organization
    const generalScanner = await prisma.scanner.create({
      data: createScannerData({
        organizationId: org.id,
        createdBy: admin.id,
        name: `${org.name} Main Scanner`,
      }),
    });
    scanners.push(generalScanner);
    seedLogger.success(`Created scanner: ${generalScanner.name}`);

    // Event-specific scanner for some events
    const orgEvents = events.filter((e) => e.organizationId === org.id && e.status === 'ON_SALE');
    if (orgEvents.length > 0) {
      const event = orgEvents[0];
      const eventScanner = await prisma.scanner.create({
        data: createScannerData({
          organizationId: org.id,
          eventId: event.id,
          createdBy: admin.id,
          name: `${event.name.substring(0, 20)}... Scanner`,
        }),
      });
      scanners.push(eventScanner);
    }
  }

  seedLogger.info(`✓ Created ${scanners.length} scanners total`);
  return scanners;
}
