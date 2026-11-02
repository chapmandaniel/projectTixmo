import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';
import { assertDevelopmentClient } from './development-client';

export async function cleanupDatabase(prisma: PrismaClient) {
  assertDevelopmentClient(prisma);
  seedLogger.warn('Cleaning database...');

  // Delete in reverse dependency order in one transaction.
  await prisma.$transaction([
    prisma.staffInvitation.deleteMany(),
    prisma.assetLibraryFolderShareFolder.deleteMany(),
    prisma.assetLibraryFolderShare.deleteMany(),
    prisma.assetLibraryAsset.deleteMany(),
    prisma.assetLibraryFolder.deleteMany(),
    prisma.approvalReminder.deleteMany(),
    prisma.approvalReviewDecision.deleteMany(),
    // Approval system
    prisma.approvalComment.deleteMany(),
    prisma.approvalAsset.deleteMany(),
    prisma.approvalRevision.deleteMany(),
    prisma.approvalReviewer.deleteMany(),
    prisma.approvalRequest.deleteMany(),

    // Tasks
    prisma.taskComment.deleteMany(),
    prisma.task.deleteMany(),

    // Waitlist
    prisma.waitlist.deleteMany(),

    // Notifications
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),

    // Scanning
    prisma.scanLog.deleteMany(),
    prisma.scanner.deleteMany(),

    // Orders & Tickets
    prisma.paymentAttempt.deleteMany(),
    prisma.paymentRefundLine.deleteMany(),
    prisma.paymentRefund.deleteMany(),
    prisma.paymentWebhookEvent.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.orderIdempotencyKey.deleteMany(),
    prisma.order.deleteMany(),

    // Promo codes
    prisma.promoCode.deleteMany(),

    // Ticket tiers & types
    prisma.ticketTier.deleteMany(),
    prisma.ticketType.deleteMany(),

    // Events & venues
    prisma.event.deleteMany(),
    prisma.venue.deleteMany(),

    // Orgs & users
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  seedLogger.success('Database cleaned — all tables emptied');
}
