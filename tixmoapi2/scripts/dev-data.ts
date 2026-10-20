/* eslint-disable no-console */
/**
 * Dev Data Management CLI
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/dev-data.ts reset
 *   npx ts-node -r tsconfig-paths/register scripts/dev-data.ts populate
 *
 * Or via npm scripts:
 *   npm run db:reset      — Wipe everything, restore admin user
 *   npm run db:populate   — Wipe everything, fill with realistic data
 */
import { createDevelopmentClient } from '../prisma/utils/development-client';
import { cleanupDatabase } from '../prisma/utils/cleanup';
import { populateDatabase } from './dev-data-populate';
import * as bcrypt from 'bcryptjs';

const prisma = createDevelopmentClient();

async function seedAdmin() {
  console.log('🌱 Seeding admin user...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const org = await prisma.organization.upsert({
    where: { slug: 'tixmo-hq' },
    update: {},
    create: {
      name: 'TixMo HQ',
      slug: 'tixmo-hq',
      type: 'PROMOTER',
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@tixmo.com' },
    update: { passwordHash, role: 'ADMIN', organizationId: org.id },
    create: {
      email: 'admin@tixmo.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      passwordHash,
      phone: '555-0123',
      emailVerified: true,
      organizationId: org.id,
    },
  });
}

async function reset() {
  console.log('\n🗑️  RESETTING DATABASE...\n');
  await cleanupDatabase(prisma);
  await seedAdmin();
  console.log('✅ Database reset complete. Only admin user remains.\n');
}

async function populate() {
  console.log('\n🗑️  RESETTING DATABASE before populate...\n');
  await cleanupDatabase(prisma);
  await populateDatabase(prisma);
  console.log('✅ Database populated with realistic dev data!\n');
}

async function main() {
  const command = process.argv[2];

  if (!command || !['reset', 'populate'].includes(command)) {
    console.log(`
Dev Data Management CLI
━━━━━━━━━━━━━━━━━━━━━━
Usage:
  npm run db:reset      Wipe all data, restore admin user
  npm run db:populate   Wipe all data, fill with realistic dev data

Commands:
  reset       Clear all tables, keep only admin@tixmo.com
  populate    Clear all tables, then generate ~1,200 tickets,
              ~500 orders, 12 events, tasks, approvals, etc.
`);
    process.exit(1);
  }

  if (command === 'reset') {
    await reset();
  } else if (command === 'populate') {
    await populate();
  }
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
