'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function bootstrapOwner(prisma, input) {
  const email = (input.email || '').trim().toLowerCase();
  if (
    !email.includes('@') ||
    !input.firstName ||
    !input.lastName ||
    !input.organizationName ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.organizationSlug || '') ||
    !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(input.password || '')
  ) {
    throw new Error(
      'Supply owner identity, business name/slug and a strong password of at least 12 characters'
    );
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tixmo-owner-bootstrap'))`;
    if (await tx.user.findUnique({ where: { email } })) {
      throw new Error('Owner account already exists; bootstrap never overwrites credentials');
    }
    if (await tx.user.findFirst({ where: { role: 'OWNER', disabledAt: null } })) {
      throw new Error('An owner already exists; use authorized team management');
    }
    const organization =
      (await tx.organization.findUnique({ where: { slug: input.organizationSlug } })) ||
      (await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
          type: 'PROMOTER',
          status: 'ACTIVE',
        },
      }));
    if (organization.status !== 'ACTIVE') throw new Error('Business is not active');
    return tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'OWNER',
        organizationId: organization.id,
        emailVerified: true,
      },
      select: { id: true },
    });
  });
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && process.env.BOOTSTRAP_ALLOW_PRODUCTION !== 'true') {
    console.error('Production bootstrap requires BOOTSTRAP_ALLOW_PRODUCTION=true');
    process.exitCode = 1;
  } else if (!process.env.DATABASE_URL) {
    console.error('An explicit DATABASE_URL is required');
    process.exitCode = 1;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    const input = {
      email: process.env.BOOTSTRAP_OWNER_EMAIL,
      password: process.env.BOOTSTRAP_OWNER_PASSWORD,
      firstName: process.env.BOOTSTRAP_OWNER_FIRST_NAME,
      lastName: process.env.BOOTSTRAP_OWNER_LAST_NAME,
      organizationName: process.env.BOOTSTRAP_ORGANIZATION_NAME,
      organizationSlug: process.env.BOOTSTRAP_ORGANIZATION_SLUG,
    };
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    bootstrapOwner(prisma, input)
      .then(() => console.log('Owner bootstrap completed; no credentials were logged'))
      .catch(() => {
        console.error(
          'Owner bootstrap refused or failed; verify required inputs and existing ownership'
        );
        process.exitCode = 1;
      })
      .finally(() => prisma.$disconnect());
  }
}

module.exports = { bootstrapOwner };
