
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    console.log('Checking for admin user...');
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'admin@tixmo.com' },
        });

        if (user) {
            console.log('✅ Admin user FOUND');
            console.log('ID:', user.id);
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            // Don't log hash for security, but we know it exists
            console.log('Has Password Hash:', !!user.passwordHash);
        } else {
            console.log('❌ Admin user NOT FOUND');
        }
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
