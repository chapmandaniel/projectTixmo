import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';

export async function cleanupDatabase(prisma: PrismaClient) {
  seedLogger.warn('Cleaning database...');

  // Delete in reverse dependency order
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.scanLog.deleteMany();
  await prisma.scanner.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  seedLogger.success('Database cleaned');
}
