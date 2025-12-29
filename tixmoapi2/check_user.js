
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                organizationId: true,
                role: true
            }
        });
        console.log('Users:', JSON.stringify(users, null, 2));

        const orgs = await prisma.organization.findMany();
        console.log('Organizations:', JSON.stringify(orgs, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
