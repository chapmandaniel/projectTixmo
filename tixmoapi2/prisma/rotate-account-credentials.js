const bcrypt = require('bcryptjs');

async function rotateAccountCredentials(prisma, input) {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.userId || '') ||
    typeof input.password !== 'string' ||
    input.password.length < 12 ||
    !/[a-z]/.test(input.password) ||
    !/[A-Z]/.test(input.password) ||
    !/[0-9]/.test(input.password) ||
    !/[^a-zA-Z0-9]/.test(input.password)
  ) {
    throw new Error('Supply an account ID and a strong password of at least 12 characters');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user || /^deleted_.+@deleted\.com$/i.test(user.email)) {
      throw new Error('Account is missing or deleted');
    }
    if (user.role === 'ADMIN' && !user.organizationId && !user.isPlatformAdmin) {
      throw new Error('Review administrator membership before credential rotation');
    }
    if (await tx.staffInvitation.findFirst({ where: { userId: user.id, acceptedAt: null } })) {
      throw new Error('Use invitation recovery for pending staff accounts');
    }
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        disabledAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    return { id: user.id };
  });
}

if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  const input = {
    userId: process.env.ROTATE_ACCOUNT_ID,
    password: process.env.ROTATE_ACCOUNT_PASSWORD,
  };
  if (!databaseUrl || process.env.ALLOW_OPERATOR_CREDENTIAL_ROTATION !== 'true') {
    process.stderr.write('Explicit database and operator authorization are required.\n');
    process.exitCode = 1;
  } else {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    rotateAccountCredentials(prisma, input)
      .then(() => process.stdout.write('Account credentials rotated; previous sessions revoked.\n'))
      .catch(() => {
        process.stderr.write(
          'Credential rotation failed. Check authorization, account membership, and inputs.\n'
        );
        process.exitCode = 1;
      })
      .finally(() => prisma.$disconnect());
  }
}

module.exports = { rotateAccountCredentials };
