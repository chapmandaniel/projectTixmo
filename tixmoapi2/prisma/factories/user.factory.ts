import { faker } from '@faker-js/faker';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface UserFactoryOptions {
  role?: UserRole;
  organizationId?: string | null;
  email?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

export async function createUserData(options: UserFactoryOptions = {}) {
  const firstName = options.firstName || faker.person.firstName();
  const lastName = options.lastName || faker.person.lastName();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  return {
    email: options.email || faker.internet.email({ firstName, lastName }).toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    phone: faker.phone.number(),
    role: options.role || UserRole.CUSTOMER,
    organizationId: options.organizationId === undefined ? null : options.organizationId,
    emailVerified: options.emailVerified ?? true,
  };
}
