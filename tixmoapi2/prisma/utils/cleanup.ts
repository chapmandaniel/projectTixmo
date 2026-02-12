import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';

export async function cleanupDatabase(prisma: PrismaClient) {
  seedLogger.warn('Cleaning database...');

  // Delete in reverse dependency order — all 17 models
  // Approval system
  await prisma.approvalComment.deleteMany();
  await prisma.approvalAsset.deleteMany();
  await prisma.approvalReviewer.deleteMany();
  await prisma.approvalRequest.deleteMany();

  // Tasks
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();

  // Waitlist
  await prisma.waitlist.deleteMany();

  // Notifications
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();

  // Scanning
  await prisma.scanLog.deleteMany();
  await prisma.scanner.deleteMany();

  // Orders & Tickets
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();

  // Promo codes
  await prisma.promoCode.deleteMany();

  // Ticket tiers & types
  await prisma.ticketTier.deleteMany();
  await prisma.ticketType.deleteMany();

  // Events & venues
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();

  // Orgs & users
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  seedLogger.success('Database cleaned — all tables emptied');
}
