import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting MINIMAL seed (Admin Only)...');

    const email = 'admin@tixmo.com';
    const password = 'Password123!';

    // Use bcryptjs to hash (same as app)
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash, // Reset password if exists
            role: 'ADMIN',
        },
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
        },
    });

    console.log(`✓ Admin user created/updated: ${admin.email}`);
    console.log(`✓ Password: ${password}`);
}

main()
    .catch((e) => {
        console.error('✗ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
