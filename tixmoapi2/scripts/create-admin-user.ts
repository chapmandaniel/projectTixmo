
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@tixmo.com';
    const password = 'admin';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Upserting admin user: ${email}`);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            role: UserRole.ADMIN,
        },
        create: {
            email,
            passwordHash: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: UserRole.ADMIN,
            emailVerified: true,
        },
    });

    console.log(`Admin user upserted successfully: ${user.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
