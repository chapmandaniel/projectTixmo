
import { PrismaClient, UserRole, OrganizationType, EventStatus, TicketStatus, OrderStatus, PaymentStatus, TicketTypeStatus, OrganizationStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Event Simulation Data Generator...');

    // --- Configuration ---
    const EVENT_NAME = 'Neon Nights 2024'; // Using a past year to allow full lifecycle
    const BASE_DATE = new Date();
    BASE_DATE.setMonth(BASE_DATE.getMonth() - 2); // Event was 2 months ago

    const EVENT_START = new Date(BASE_DATE);
    EVENT_START.setHours(19, 0, 0, 0); // 7 PM

    const EVENT_END = new Date(BASE_DATE);
    EVENT_END.setHours(23, 0, 0, 0); // 11 PM

    const SALES_START = new Date(BASE_DATE);
    SALES_START.setDate(SALES_START.getDate() - 45); // Sales started 45 days before

    const TOTAL_TICKETS_TARGET = 850; // Target ~850 tickets

    // --- 1. Organization & Venue ---
    console.log('🏢 Setting up Organization and Venue...');

    const orgSlug = 'simulation-entertainment-' + faker.string.alphanumeric(5);

    const org = await prisma.organization.create({
        data: {
            name: 'Simulation Entertainment Group',
            slug: orgSlug,
            type: OrganizationType.PROMOTER,
            status: OrganizationStatus.ACTIVE,
        }
    });

    const venue = await prisma.venue.create({
        data: {
            organizationId: org.id,
            name: 'Grand Arena',
            address: {
                street: '123 Stadium Way',
                city: 'Metropolis',
                state: 'NY',
                zip: '10001',
                country: 'USA'
            },
            capacity: 5000,
            timezone: 'America/New_York'
        }
    });

    // --- 2. Event ---
    console.log('📅 Creating Event...');
    const event = await prisma.event.create({
        data: {
            organizationId: org.id,
            venueId: venue.id,
            name: EVENT_NAME,
            slug: faker.helpers.slugify(EVENT_NAME).toLowerCase() + '-' + faker.string.alphanumeric(5),
            description: faker.lorem.paragraph(),
            category: 'Music',
            tags: ['electronic', 'dance', 'live'],
            startDatetime: EVENT_START,
            endDatetime: EVENT_END,
            timezone: 'America/New_York',
            status: EventStatus.COMPLETED, // It's in the past
            salesStart: SALES_START,
            salesEnd: EVENT_START,
            capacity: 2000,
            images: [faker.image.urlLoremFlickr({ category: 'nightlife' })],
        }
    });

    // --- 3. Ticket Types ---
    console.log('🎟️ Creating Ticket Types...');
    const ticketTypes = await Promise.all([
        prisma.ticketType.create({
            data: {
                eventId: event.id,
                name: 'Early Bird',
                price: 45.00,
                quantityTotal: 200,
                quantityAvailable: 0, // Solid out
                quantitySold: 200,
                salesStart: SALES_START,
                salesEnd: new Date(SALES_START.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
                status: TicketTypeStatus.SOLD_OUT
            }
        }),
        prisma.ticketType.create({
            data: {
                eventId: event.id,
                name: 'General Admission',
                price: 75.00,
                quantityTotal: 1500,
                quantityAvailable: 1500 - 500, // Example left over
                quantitySold: 0, // Will update as we generate orders
                salesStart: new Date(SALES_START.getTime() + 7 * 24 * 60 * 60 * 1000),
                salesEnd: EVENT_START,
                status: TicketTypeStatus.ACTIVE
            }
        }),
        prisma.ticketType.create({
            data: {
                eventId: event.id,
                name: 'VIP Experience',
                price: 150.00,
                quantityTotal: 100,
                quantityAvailable: 100, // Will update
                quantitySold: 0,
                salesStart: SALES_START,
                salesEnd: EVENT_START,
                status: TicketTypeStatus.ACTIVE
            }
        })
    ]);

    // --- 4. Customers & Orders Simulation ---
    console.log('🛍️ Simulating Sales Lifecycle...');

    const passwordHash = await bcrypt.hash('password', 10);
    let totalTicketsSold = 0;

    // We want to simulate sales over the 45 day period.
    // We'll use a probability curve: High at start (Early Bird), Dip, Slow Rise, Spike at end (FOMO).

    const daysOfSales = Math.ceil((EVENT_START.getTime() - SALES_START.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < daysOfSales; i++) {
        const currentDate = new Date(SALES_START.getTime() + i * 24 * 60 * 60 * 1000);

        // Determine daily volume based on "curve"
        let dailyVolume = 5; // Base
        if (i < 3) dailyVolume += 30; // Early bird rush
        else if (i > daysOfSales - 5) dailyVolume += 40; // Last minute rush
        else dailyVolume += Math.floor(Math.random() * 10); // Random trickle

        // Randomize time within the day
        for (let j = 0; j < dailyVolume; j++) {
            if (totalTicketsSold >= TOTAL_TICKETS_TARGET) break;

            const orderTime = new Date(currentDate.getTime() + Math.random() * 24 * 60 * 60 * 1000);
            if (orderTime > EVENT_START) continue;

            // Pick a ticket type
            let selectedType = ticketTypes[1]; // GA default

            // Early bird logic
            if (currentDate < ticketTypes[0].salesEnd! && ticketTypes[0].quantitySold < ticketTypes[0].quantityTotal) {
                if (Math.random() > 0.2) selectedType = ticketTypes[0]; // 80% chance if available
            }
            // VIP logic
            if (Math.random() > 0.9) selectedType = ticketTypes[2];

            const quantity = faker.number.int({ min: 1, max: 4 });

            // Create User (Customer)
            const user = await prisma.user.create({
                data: {
                    email: faker.internet.email(),
                    passwordHash,
                    firstName: faker.person.firstName(),
                    lastName: faker.person.lastName(),
                    role: UserRole.CUSTOMER,
                    emailVerified: true
                }
            });

            // Create Order
            const subtotal = Number(selectedType.price) * quantity;
            const fees = subtotal * 0.10;
            const total = subtotal + fees;

            const order = await prisma.order.create({
                data: {
                    userId: user.id,
                    eventId: event.id,
                    orderNumber: faker.string.alphanumeric(10).toUpperCase(),
                    status: OrderStatus.PAID,
                    totalAmount: total,
                    feesAmount: fees,
                    paymentStatus: PaymentStatus.SUCCEEDED,
                    paymentMethod: 'card',
                    createdAt: orderTime,
                    updatedAt: orderTime
                }
            });

            // Create Tickets
            for (let k = 0; k < quantity; k++) {
                await prisma.ticket.create({
                    data: {
                        orderId: order.id,
                        eventId: event.id,
                        ticketTypeId: selectedType.id,
                        userId: user.id,
                        barcode: faker.string.uuid(),
                        status: TicketStatus.VALID,
                        pricePaid: selectedType.price,
                        createdAt: orderTime
                    }
                });
            }

            totalTicketsSold += quantity;
        }
    }

    // Update Ticket Stats (Approximate)
    // In a real app we'd aggregate, but for sim just leaving it is fine or updating simple counters
    console.log(`✅ Generated ${totalTicketsSold} tickets across the sales period.`);

    // --- 5. Scanners & Entry Simulation ---
    console.log('📱 Simulating Check-ins...');

    // Create Scanners
    const scannerUser = await prisma.scanner.create({
        data: {
            organizationId: org.id,
            eventId: event.id,
            name: 'Main Entrance 1',
            apiKey: faker.string.uuid(), // unique
            createdBy: 'system'
        }
    });

    const scannerUser2 = await prisma.scanner.create({
        data: {
            organizationId: org.id,
            eventId: event.id,
            name: 'VIP Entrance',
            apiKey: faker.string.uuid(),
            createdBy: 'system'
        }
    });

    // Get all valid tickets
    const ticketsToScan = await prisma.ticket.findMany({
        where: { eventId: event.id },
        take: Math.floor(totalTicketsSold * 0.85) // 85% attendance rate
    });

    for (const ticket of ticketsToScan) {
        // Determine scan time: Mostly around start time +/- 1 hour
        // Gaussian-ish distribution centered on EVENT_START
        const minutesOffset = (Math.random() + Math.random() + Math.random() - 1.5) * 60; // -90 to +90 mins typically
        const scanTime = new Date(EVENT_START.getTime() + minutesOffset * 60 * 1000);

        // Choose scanner
        const scannerId = (ticket.ticketTypeId === ticketTypes[2].id) ? scannerUser2.id : scannerUser.id; // VIP to VIP scanner

        await prisma.scanLog.create({
            data: {
                scannerId: scannerId,
                ticketId: ticket.id,
                eventId: event.id,
                scanType: 'ENTRY',
                success: true,
                scannedAt: scanTime
            }
        });

        // Update ticket status
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                status: TicketStatus.USED,
                checkedInAt: scanTime,
                checkedInBy: scannerId
            }
        });
    }

    console.log(`✅ Simulated ${ticketsToScan.length} check-ins.`);
    console.log('🏁 Simulation Complete!');
    console.log(`Event ID: ${event.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
