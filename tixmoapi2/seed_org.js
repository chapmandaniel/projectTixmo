
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    try {
        // 1. Create Organization
        const org = await prisma.organization.create({
            data: {
                name: 'TixMo HQ',
                slug: 'tixmo-hq',
                type: 'PROMOTER',
                status: 'ACTIVE'
            }
        });
        console.log('Created Organization:', org);

        // 2. Update Admin User
        const updatedUser = await prisma.user.update({
            where: { email: 'admin@tixmo.com' },
            data: { organizationId: org.id }
        });
        console.log('Updated Admin User:', updatedUser);

    } catch (error) {
        console.error('Error seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
