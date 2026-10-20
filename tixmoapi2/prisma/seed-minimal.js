// Explicit opt-in bootstrap: SEED_ADMIN_PASSWORD is required only for a new account.
// Existing accounts are never reconfigured by a startup seed.
async function seedMinimal({ prisma, hash, env = process.env, logger = console }) {
    const email = 'admin@tixmo.com';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        logger.log('✓ Existing bootstrap account preserved.');
        return existing;
    }

    const password = env.SEED_ADMIN_PASSWORD;
    if (typeof password !== 'string' || !password.trim()) {
        throw new Error('SEED_ADMIN_PASSWORD is required to create the bootstrap account.');
    }
    // Validate inputs and hash before making any writes.
    const passwordHash = await hash(password, 10);
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
    // Empty update also preserves an account created concurrently after the read.
    const admin = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
            organizationId: org.id,
        },
    });
    logger.log('✓ Bootstrap account available.');
    return admin;
}

async function main() {
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();
    try {
        await seedMinimal({ prisma, hash: bcrypt.hash });
    } catch {
        // Database/hash errors may contain inputs; never log raw error objects.
        console.error('✗ Minimal seed failed. A new account requires SEED_ADMIN_PASSWORD; check configuration privately.');
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch(() => {
        console.error('✗ Minimal seed initialization or cleanup failed.');
        process.exitCode = 1;
    });
}

module.exports = { seedMinimal };
