/* eslint-disable no-console */
import { PrismaClient, User, PromoCode } from '@prisma/client';
import { seedLogger } from './utils/seed-logger';
import { cleanupDatabase } from './utils/cleanup';
import { seedUsers } from './seeders/01-users.seeder';
import { seedOrganizations } from './seeders/02-organizations.seeder';
import { seedVenues } from './seeders/03-venues.seeder';
import { seedEvents } from './seeders/04-events.seeder';
import { seedTicketTypes } from './seeders/05-ticket-types.seeder';
import { seedPromoCodes } from './seeders/06-promo-codes.seeder';
import { seedOrders } from './seeders/07-orders.seeder';
import { seedScanners } from './seeders/08-scanners.seeder';

const prisma = new PrismaClient();

async function main() {
  seedLogger.info('🌱 Starting database seed...\n');

  // Optional: Clean existing data
  const shouldClean = process.env.SEED_CLEAN === 'true';
  if (shouldClean) {
    await cleanupDatabase(prisma);
  }

  try {
    // Execute seeders in dependency order
    const users = await seedUsers(prisma);
    console.log('');

    const organizations = await seedOrganizations(prisma);
    console.log('');

    const venues = await seedVenues(prisma, organizations);
    console.log('');

    const events = await seedEvents(prisma, organizations, venues);
    console.log('');

    const ticketTypes = await seedTicketTypes(prisma, events);
    console.log('');

    const promoCodes = await seedPromoCodes(prisma, organizations);
    console.log('');

    const orders = await seedOrders(prisma, users, events, ticketTypes, promoCodes);
    console.log('');

    // Count tickets created
    const ticketCount = await prisma.ticket.count();

    const scanners = await seedScanners(prisma, users, organizations, events);
    console.log('');

    // Summary
    seedLogger.info('📊 Seed Summary:');
    seedLogger.info(`Users: ${users.length}`);
    seedLogger.info(`Organizations: ${organizations.length}`);
    seedLogger.info(`Venues: ${venues.length}`);
    seedLogger.info(`Events: ${events.length}`);
    seedLogger.info(`Ticket Types: ${ticketTypes.length}`);
    seedLogger.info(`Promo Codes: ${promoCodes.length}`);
    seedLogger.info(`Orders: ${orders.length}`);
    seedLogger.info(`Tickets: ${ticketCount}`);
    seedLogger.info(`Scanners: ${scanners.length}`);

    seedLogger.success('\n✅ Database seeded successfully!\n');

    // Print demo credentials
    printDemoCredentials(users, promoCodes);
  } catch (error) {
    seedLogger.error('❌ Seed failed:', error);
    throw error;
  }
}

function printDemoCredentials(users: User[], promoCodes: PromoCode[]) {
  seedLogger.info('🔑 Demo Credentials:');
  seedLogger.info('─'.repeat(60));
  seedLogger.info('All users have password: Password123!');
  seedLogger.info('─'.repeat(60));

  const admin = users.find((u) => u.role === 'ADMIN');
  if (admin) {
    seedLogger.info(`Admin:    ${admin.email.padEnd(40)} (${admin.role})`);
  }

  const promoters = users.filter((u) => u.role === 'PROMOTER').slice(0, 2);
  promoters.forEach((p) => {
    seedLogger.info(`Promoter: ${p.email.padEnd(40)} (${p.role})`);
  });

  const customers = users.filter((u) => u.role === 'CUSTOMER').slice(0, 2);
  customers.forEach((c) => {
    seedLogger.info(`Customer: ${c.email.padEnd(40)} (${c.role})`);
  });

  const scannerUsers = users.filter((u) => u.role === 'SCANNER').slice(0, 1);
  scannerUsers.forEach((s) => {
    seedLogger.info(`Scanner:  ${s.email.padEnd(40)} (${s.role})`);
  });

  seedLogger.info('─'.repeat(60));
  seedLogger.info('\n💰 Active Promo Codes:');
  seedLogger.info('─'.repeat(60));
  const activeCodes = promoCodes.filter((p) => p.status === 'ACTIVE').slice(0, 6);
  activeCodes.forEach((p) => {
    const discount =
      p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `$${p.discountValue}`;
    seedLogger.info(`${p.code.padEnd(15)} - ${discount} off`);
  });

  seedLogger.info('─'.repeat(60));
  seedLogger.info(`See docs/DEMO_DATA_PLAN.md for full details\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
