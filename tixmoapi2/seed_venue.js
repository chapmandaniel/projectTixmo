
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedVenue() {
    try {
        // 1. Get Organization
        const org = await prisma.organization.findFirst();
        if (!org) {
            throw new Error('No organization found');
        }

        // 2. Create Venue
        const venue = await prisma.venue.create({
            data: {
                name: 'The Lighthouse',
                organizationId: org.id,
                capacity: 500,
                address: {
                    street: '123 Main St',
                    city: 'San Francisco',
                    state: 'CA',
                    country: 'USA',
                    postalCode: '94105'
                },
                timezone: 'America/Los_Angeles'
            }
        });
        console.log('Created Venue:', venue);

    } catch (error) {
        console.error('Error seeding venue:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedVenue();
