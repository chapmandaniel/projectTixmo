import { PrismaClient, UserRole } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createUserData } from '../factories/user.factory';

export async function seedUsers(prisma: PrismaClient) {
  seedLogger.info('Seeding users...');

  const users = [];

  // Create admin users
  const admin = await prisma.user.create({
    data: await createUserData({
      email: 'admin@tixmo.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    }),
  });
  users.push(admin);
  seedLogger.success(`Created admin: ${admin.email}`);

  // Create promoter users (without organization for now)
  for (let i = 0; i < 3; i++) {
    const promoter = await prisma.user.create({
      data: await createUserData({
        role: UserRole.PROMOTER,
      }),
    });
    users.push(promoter);
    seedLogger.success(`Created promoter: ${promoter.email}`);
  }

  // Create customer users
  for (let i = 0; i < 8; i++) {
    const customer = await prisma.user.create({
      data: await createUserData({
        role: UserRole.CUSTOMER,
      }),
    });
    users.push(customer);
  }
  seedLogger.success(`Created 8 customers`);

  // Create scanner users
  for (let i = 0; i < 2; i++) {
    const scanner = await prisma.user.create({
      data: await createUserData({
        role: UserRole.SCANNER,
      }),
    });
    users.push(scanner);
  }
  seedLogger.success(`Created 2 scanners`);

  seedLogger.info(`✓ Created ${users.length} users total`);
  return users;
}
