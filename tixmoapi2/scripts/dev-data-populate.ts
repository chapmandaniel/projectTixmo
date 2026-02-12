/* eslint-disable no-console */
/**
 * Dev Data Populate Script
 * 
 * Generates a large volume of realistic data across ALL models.
 * Uses faker.seed(42) for deterministic, reproducible output.
 */
import {
    PrismaClient,
    Prisma,
    Organization,
    UserRole,
    OrganizationType,
    OrganizationStatus,
    EventStatus,
    TicketTypeStatus,
    OrderStatus,
    PaymentStatus,
    TicketStatus,
    DiscountType,
    PromoCodeStatus,
    ScannerStatus,
    NotificationType,
    NotificationStatus,
    TaskStatus,
    TaskPriority,
    TaskTag,
    ApprovalStatus,
    ApprovalPriority,
    ApprovalDecision,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────

function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

// ─── Main ─────────────────────────────────────────────────

export async function populateDatabase() {
    faker.seed(42);
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const now = new Date();

    console.log('\n🚀 Populating database with realistic dev data...\n');

    // ──────────────────────────────────────────────────────────
    // 1. ORGANIZATIONS
    // ──────────────────────────────────────────────────────────
    console.log('🏢 Creating organizations...');

    const orgData = [
        { name: 'Neon Events Co', type: OrganizationType.PROMOTER, status: OrganizationStatus.ACTIVE },
        { name: 'Metro Venues Inc', type: OrganizationType.VENUE, status: OrganizationStatus.ACTIVE },
        { name: 'Ticket Hub Resellers', type: OrganizationType.RESELLER, status: OrganizationStatus.ACTIVE },
    ];

    const orgs: Organization[] = [];
    for (const od of orgData) {
        const org = await prisma.organization.create({
            data: {
                name: od.name,
                slug: faker.helpers.slugify(od.name).toLowerCase() + '-' + faker.string.alphanumeric(4),
                type: od.type,
                status: od.status,
                settings: { theme: 'dark', currency: 'USD' },
            },
        });
        orgs.push(org);
    }
    console.log(`  ✓ ${orgs.length} organizations`);

    // ──────────────────────────────────────────────────────────
    // 2. USERS (Team + Customers)
    // ──────────────────────────────────────────────────────────
    console.log('👥 Creating users...');

    // Admin
    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@tixmo.com',
            passwordHash,
            firstName: 'Admin',
            lastName: 'User',
            role: UserRole.ADMIN,
            organizationId: orgs[0].id,
            emailVerified: true,
            phone: '555-0100',
        },
    });

    // Team members across organizations
    const teamRoles: { role: UserRole; orgIndex: number; title?: string }[] = [
        { role: UserRole.OWNER, orgIndex: 0, title: 'CEO' },
        { role: UserRole.PROMOTER, orgIndex: 0, title: 'Head of Events' },
        { role: UserRole.PROMOTER, orgIndex: 0, title: 'Marketing Lead' },
        { role: UserRole.PROMOTER, orgIndex: 0 },
        { role: UserRole.TEAM_MEMBER, orgIndex: 0, title: 'Operations Coordinator' },
        { role: UserRole.TEAM_MEMBER, orgIndex: 0, title: 'Design Lead' },
        { role: UserRole.TEAM_MEMBER, orgIndex: 0, title: 'Finance Manager' },
        { role: UserRole.SCANNER, orgIndex: 0 },
        { role: UserRole.SCANNER, orgIndex: 0 },
        { role: UserRole.OWNER, orgIndex: 1, title: 'Venue Director' },
        { role: UserRole.PROMOTER, orgIndex: 1 },
        { role: UserRole.TEAM_MEMBER, orgIndex: 1, title: 'Venue Operations' },
        { role: UserRole.SCANNER, orgIndex: 1 },
        { role: UserRole.OWNER, orgIndex: 2, title: 'Reseller Manager' },
    ];

    const teamUsers = [adminUser];
    for (const tr of teamRoles) {
        const first = faker.person.firstName();
        const last = faker.person.lastName();
        const u = await prisma.user.create({
            data: {
                email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase(),
                passwordHash,
                firstName: first,
                lastName: last,
                role: tr.role,
                title: tr.title || null,
                organizationId: orgs[tr.orgIndex].id,
                emailVerified: true,
                phone: faker.phone.number(),
                permissions: tr.role === UserRole.TEAM_MEMBER
                    ? { canManageEvents: true, canViewAnalytics: true, canManageOrders: tr.title === 'Finance Manager' }
                    : Prisma.JsonNull,
            },
        });
        teamUsers.push(u);
    }

    // Customers — create 300
    const customers = [];
    for (let i = 0; i < 300; i++) {
        const first = faker.person.firstName();
        const last = faker.person.lastName();
        customers.push({
            email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase() + i,
            passwordHash,
            firstName: first,
            lastName: last,
            role: UserRole.CUSTOMER,
            emailVerified: i < 270, // 90% verified
            phone: i < 200 ? faker.phone.number() : null,
        });
    }
    await prisma.user.createMany({ data: customers });
    const allCustomers = await prisma.user.findMany({ where: { role: UserRole.CUSTOMER } });

    console.log(`  ✓ ${teamUsers.length} team users + ${allCustomers.length} customers`);

    // ──────────────────────────────────────────────────────────
    // 3. VENUES
    // ──────────────────────────────────────────────────────────
    console.log('🏟️  Creating venues...');

    const venueConfigs = [
        { name: 'Madison Square Arena', cap: 8000, city: 'New York', state: 'NY', tz: 'America/New_York' },
        { name: 'Sunset Amphitheater', cap: 3500, city: 'Los Angeles', state: 'CA', tz: 'America/Los_Angeles' },
        { name: 'The Basement Lounge', cap: 250, city: 'Nashville', state: 'TN', tz: 'America/Chicago' },
        { name: 'Lakefront Pavilion', cap: 5000, city: 'Chicago', state: 'IL', tz: 'America/Chicago' },
        { name: 'Tech Convention Center', cap: 12000, city: 'Austin', state: 'TX', tz: 'America/Chicago' },
    ];

    const venues = [];
    for (const vc of venueConfigs) {
        const v = await prisma.venue.create({
            data: {
                organizationId: orgs[1].id, // Venue org owns all venues
                name: vc.name,
                address: { street: faker.location.streetAddress(), city: vc.city, state: vc.state, zip: faker.location.zipCode(), country: 'USA' },
                capacity: vc.cap,
                timezone: vc.tz,
                metadata: { parking: true, accessible: true },
            },
        });
        venues.push(v);
    }
    console.log(`  ✓ ${venues.length} venues`);

    // ──────────────────────────────────────────────────────────
    // 4. EVENTS (12 total — mixed statuses & timelines)
    // ──────────────────────────────────────────────────────────
    console.log('📅 Creating events...');

    interface EventConfig {
        name: string;
        category: string;
        status: EventStatus;
        daysOffset: number; // negative = past, positive = future
        durationHours: number;
        venueIndex: number;
        orgIndex: number;
        capacity: number;
        tags: string[];
    }

    const eventConfigs: EventConfig[] = [
        // 3 COMPLETED (past)
        { name: 'Neon Nights 2025', category: 'CONCERT', status: EventStatus.COMPLETED, daysOffset: -60, durationHours: 4, venueIndex: 0, orgIndex: 0, capacity: 5000, tags: ['electronic', 'dance', 'live'] },
        { name: 'Comedy Slam Fest', category: 'COMEDY', status: EventStatus.COMPLETED, daysOffset: -30, durationHours: 3, venueIndex: 2, orgIndex: 0, capacity: 200, tags: ['comedy', 'standup'] },
        { name: 'DevOps Summit 2025', category: 'CONFERENCE', status: EventStatus.COMPLETED, daysOffset: -14, durationHours: 8, venueIndex: 4, orgIndex: 0, capacity: 1500, tags: ['tech', 'conference', 'devops'] },
        // 4 ON_SALE (upcoming)
        { name: 'Summer Beats Festival', category: 'FESTIVAL', status: EventStatus.ON_SALE, daysOffset: 21, durationHours: 10, venueIndex: 1, orgIndex: 0, capacity: 3000, tags: ['music', 'outdoor', 'festival'] },
        { name: 'Jazz Under the Stars', category: 'CONCERT', status: EventStatus.ON_SALE, daysOffset: 35, durationHours: 3, venueIndex: 2, orgIndex: 0, capacity: 200, tags: ['jazz', 'intimate', 'live'] },
        { name: 'Tech Innovators Expo', category: 'CONFERENCE', status: EventStatus.ON_SALE, daysOffset: 45, durationHours: 8, venueIndex: 4, orgIndex: 0, capacity: 5000, tags: ['tech', 'expo', 'startup'] },
        { name: 'Lakefront Rocktoberfest', category: 'FESTIVAL', status: EventStatus.ON_SALE, daysOffset: 60, durationHours: 6, venueIndex: 3, orgIndex: 0, capacity: 4000, tags: ['rock', 'outdoor', 'beer'] },
        // 2 SOLD_OUT
        { name: 'Midnight Masquerade', category: 'CONCERT', status: EventStatus.SOLD_OUT, daysOffset: 10, durationHours: 5, venueIndex: 0, orgIndex: 0, capacity: 2000, tags: ['electronic', 'party', 'exclusive'] },
        { name: 'Tiny Desk Sessions', category: 'CONCERT', status: EventStatus.SOLD_OUT, daysOffset: 18, durationHours: 2, venueIndex: 2, orgIndex: 0, capacity: 100, tags: ['acoustic', 'intimate'] },
        // 1 DRAFT
        { name: 'Winter Gala 2026', category: 'CONCERT', status: EventStatus.DRAFT, daysOffset: 120, durationHours: 5, venueIndex: 0, orgIndex: 0, capacity: 6000, tags: ['gala', 'formal'] },
        // 1 PUBLISHED (not on sale yet)
        { name: 'Spring Comedy Tour', category: 'COMEDY', status: EventStatus.PUBLISHED, daysOffset: 75, durationHours: 3, venueIndex: 2, orgIndex: 0, capacity: 200, tags: ['comedy', 'tour'] },
        // 1 CANCELLED
        { name: 'Rainy Day Acoustic Set', category: 'CONCERT', status: EventStatus.CANCELLED, daysOffset: 5, durationHours: 3, venueIndex: 2, orgIndex: 0, capacity: 150, tags: ['acoustic', 'cancelled'] },
    ];

    const events = [];
    for (const ec of eventConfigs) {
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() + ec.daysOffset);
        startDate.setHours(19, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + ec.durationHours);

        const salesStart = new Date(startDate);
        salesStart.setDate(salesStart.getDate() - 45);

        const salesEnd = new Date(startDate);
        salesEnd.setHours(salesEnd.getHours() - 2);

        const ev = await prisma.event.create({
            data: {
                organizationId: orgs[ec.orgIndex].id,
                venueId: venues[ec.venueIndex].id,
                name: ec.name,
                slug: faker.helpers.slugify(ec.name).toLowerCase() + '-' + faker.string.alphanumeric(5),
                description: faker.lorem.paragraphs(2),
                category: ec.category,
                tags: ec.tags,
                startDatetime: startDate,
                endDatetime: endDate,
                timezone: venues[ec.venueIndex].timezone,
                status: ec.status,
                salesStart,
                salesEnd,
                capacity: ec.capacity,
            },
        });
        events.push(ev);
    }
    console.log(`  ✓ ${events.length} events`);

    // ──────────────────────────────────────────────────────────
    // 5. TICKET TYPES + TIERS
    // ──────────────────────────────────────────────────────────
    console.log('🎟️  Creating ticket types & tiers...');

    interface TTConfig {
        name: string;
        price: number;
        qtyTotal: number;
        soldPct: number;
        sortOrder: number;
        tiers?: { name: string; price: number; qtyLimit: number | null; sortOrder: number }[];
    }

    // Only create ticket types for non-DRAFT events
    const sellableEvents = events.filter(e => e.status !== EventStatus.DRAFT);
    const ticketTypeMap = new Map<string, Array<{ id: string; eventId: string; price: number; name: string; quantityTotal: number; quantitySold: number }>>();

    for (const ev of sellableEvents) {
        const isCompleted = ev.status === EventStatus.COMPLETED;
        const isSoldOut = ev.status === EventStatus.SOLD_OUT;

        const configs: TTConfig[] = [
            {
                name: 'Early Bird',
                price: faker.number.int({ min: 30, max: 50 }),
                qtyTotal: Math.floor((ev.capacity || 1000) * 0.15),
                soldPct: isCompleted || isSoldOut ? 1.0 : faker.number.float({ min: 0.7, max: 1.0 }),
                sortOrder: 0,
                tiers: [
                    { name: 'Super Early', price: faker.number.int({ min: 20, max: 30 }), qtyLimit: 50, sortOrder: 0 },
                    { name: 'Early Bird Regular', price: faker.number.int({ min: 30, max: 45 }), qtyLimit: null, sortOrder: 1 },
                ],
            },
            {
                name: 'General Admission',
                price: faker.number.int({ min: 60, max: 100 }),
                qtyTotal: Math.floor((ev.capacity || 1000) * 0.65),
                soldPct: isCompleted ? 0.85 : isSoldOut ? 1.0 : faker.number.float({ min: 0.1, max: 0.6 }),
                sortOrder: 1,
            },
            {
                name: 'VIP',
                price: faker.number.int({ min: 120, max: 250 }),
                qtyTotal: Math.floor((ev.capacity || 1000) * 0.10),
                soldPct: isCompleted ? 0.95 : isSoldOut ? 1.0 : faker.number.float({ min: 0.3, max: 0.8 }),
                sortOrder: 2,
                tiers: [
                    { name: 'VIP Standard', price: faker.number.int({ min: 120, max: 180 }), qtyLimit: null, sortOrder: 0 },
                    { name: 'VIP Platinum', price: faker.number.int({ min: 200, max: 350 }), qtyLimit: 20, sortOrder: 1 },
                ],
            },
        ];

        const ttList: Array<{ id: string; eventId: string; price: number; name: string; quantityTotal: number; quantitySold: number }> = [];

        for (const cfg of configs) {
            const qtySold = Math.floor(cfg.qtyTotal * cfg.soldPct);
            const qtyAvailable = cfg.qtyTotal - qtySold;

            const tt = await prisma.ticketType.create({
                data: {
                    eventId: ev.id,
                    name: cfg.name,
                    description: `${cfg.name} access to ${ev.name}`,
                    price: cfg.price,
                    quantityTotal: cfg.qtyTotal,
                    quantityAvailable: qtyAvailable,
                    quantitySold: qtySold,
                    quantityHeld: 0,
                    maxPerOrder: cfg.name === 'VIP' ? 4 : 8,
                    sortOrder: cfg.sortOrder,
                    status: qtyAvailable === 0 ? TicketTypeStatus.SOLD_OUT : TicketTypeStatus.ACTIVE,
                    salesStart: ev.salesStart,
                    salesEnd: ev.salesEnd,
                },
            });

            ttList.push({ id: tt.id, eventId: ev.id, price: Number(tt.price), name: tt.name, quantityTotal: tt.quantityTotal, quantitySold: tt.quantitySold });

            // Create tiers if defined
            if (cfg.tiers) {
                for (const tier of cfg.tiers) {
                    await prisma.ticketTier.create({
                        data: {
                            ticketTypeId: tt.id,
                            name: tier.name,
                            price: tier.price,
                            quantityLimit: tier.qtyLimit,
                            quantitySold: Math.floor((tier.qtyLimit || qtySold) * cfg.soldPct * 0.5),
                            sortOrder: tier.sortOrder,
                            isActive: true,
                        },
                    });
                }
            }
        }

        ticketTypeMap.set(ev.id, ttList);
    }

    const ttCount = await prisma.ticketType.count();
    const tierCount = await prisma.ticketTier.count();
    console.log(`  ✓ ${ttCount} ticket types, ${tierCount} tiers`);

    // ──────────────────────────────────────────────────────────
    // 6. PROMO CODES
    // ──────────────────────────────────────────────────────────
    console.log('💰 Creating promo codes...');

    const promoCodes = [];
    const promoConfigs = [
        { code: 'EARLYBIRD20', type: DiscountType.PERCENTAGE, value: 20, maxUses: 100, status: PromoCodeStatus.ACTIVE },
        { code: 'SUMMER10', type: DiscountType.PERCENTAGE, value: 10, maxUses: 500, status: PromoCodeStatus.ACTIVE },
        { code: 'FLAT15OFF', type: DiscountType.FIXED_AMOUNT, value: 15, maxUses: 200, status: PromoCodeStatus.ACTIVE },
        { code: 'VIP25', type: DiscountType.PERCENTAGE, value: 25, maxUses: 50, status: PromoCodeStatus.ACTIVE },
        { code: 'WELCOME5', type: DiscountType.FIXED_AMOUNT, value: 5, maxUses: null, status: PromoCodeStatus.ACTIVE },
        { code: 'FLASH50', type: DiscountType.PERCENTAGE, value: 50, maxUses: 10, status: PromoCodeStatus.EXPIRED },
        { code: 'GROUPDEAL', type: DiscountType.FIXED_AMOUNT, value: 30, maxUses: 100, status: PromoCodeStatus.ACTIVE },
        { code: 'STAFF100', type: DiscountType.PERCENTAGE, value: 100, maxUses: 20, status: PromoCodeStatus.ACTIVE },
        { code: 'OLDCODE', type: DiscountType.PERCENTAGE, value: 15, maxUses: 50, status: PromoCodeStatus.EXPIRED },
        { code: 'DISABLED1', type: DiscountType.PERCENTAGE, value: 10, maxUses: 100, status: PromoCodeStatus.DISABLED },
    ];

    for (const pc of promoConfigs) {
        const validFrom = new Date(now);
        validFrom.setDate(validFrom.getDate() - 60);
        const validUntil = new Date(now);
        validUntil.setDate(validUntil.getDate() + (pc.status === PromoCodeStatus.EXPIRED ? -5 : 90));

        const promo = await prisma.promoCode.create({
            data: {
                organizationId: orgs[0].id,
                code: pc.code,
                description: `Promo code: ${pc.code}`,
                discountType: pc.type,
                discountValue: pc.value,
                maxUses: pc.maxUses,
                usesCount: pc.status === PromoCodeStatus.EXPIRED ? (pc.maxUses || 50) : faker.number.int({ min: 0, max: Math.floor((pc.maxUses || 100) * 0.3) }),
                validFrom,
                validUntil,
                applicableEvents: [],
                status: pc.status,
            },
        });
        promoCodes.push(promo);
    }
    console.log(`  ✓ ${promoCodes.length} promo codes`);

    // ──────────────────────────────────────────────────────────
    // 7. ORDERS + TICKETS (the big one)
    // ──────────────────────────────────────────────────────────
    console.log('🛒 Generating orders & tickets (this may take a moment)...');

    // Only generate orders for events that sell tickets
    const orderableStatuses: string[] = [EventStatus.COMPLETED, EventStatus.ON_SALE, EventStatus.SOLD_OUT];
    const orderableEvents = events.filter(e => orderableStatuses.includes(e.status));

    let totalOrders = 0;
    let totalTickets = 0;

    for (const ev of orderableEvents) {
        const tts = ticketTypeMap.get(ev.id);
        if (!tts || tts.length === 0) continue;

        // Determine how many orders to generate based on total sold qty
        const totalSold = tts.reduce((sum, tt) => sum + tt.quantitySold, 0);
        if (totalSold === 0) continue;

        // Distribute sold tickets across orders (avg 2.5 tickets per order)
        const orderCount = Math.max(1, Math.floor(totalSold / 2.5));
        let ticketsAssigned = 0;

        // Build sales timeline
        const salesWindow = ev.salesStart && ev.salesEnd
            ? { start: ev.salesStart, end: new Date(Math.min(ev.salesEnd.getTime(), now.getTime())) }
            : { start: new Date(now.getTime() - 45 * 86400000), end: now };

        // Status distribution weights
        const statusChoices: { status: OrderStatus; paymentStatus: PaymentStatus }[] = [
            { status: OrderStatus.PAID, paymentStatus: PaymentStatus.SUCCEEDED },
            { status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PENDING },
            { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED },
            { status: OrderStatus.REFUNDED, paymentStatus: PaymentStatus.SUCCEEDED },
        ];
        const statusWeights = [70, 15, 10, 5];

        for (let i = 0; i < orderCount && ticketsAssigned < totalSold; i++) {
            const customer = allCustomers[i % allCustomers.length];
            const { status, paymentStatus } = weightedPick(statusChoices, statusWeights);

            // Temporal distribution: slight curve (more at start and end)
            const progressRatio = i / orderCount;
            let timeBias: number;
            if (progressRatio < 0.15) timeBias = progressRatio / 0.15 * 0.2; // Early rush → first 20% of time
            else if (progressRatio > 0.85) timeBias = 0.8 + (progressRatio - 0.85) / 0.15 * 0.2; // Late rush
            else timeBias = 0.2 + (progressRatio - 0.15) / 0.7 * 0.6; // Trickle in middle

            const orderTime = new Date(
                salesWindow.start.getTime() + timeBias * (salesWindow.end.getTime() - salesWindow.start.getTime())
            );
            // Add some random jitter
            orderTime.setMinutes(orderTime.getMinutes() + faker.number.int({ min: -120, max: 120 }));

            // Pick ticket type weighted by availability
            const tt = tts[faker.number.int({ min: 0, max: tts.length - 1 })];
            const qty = Math.min(faker.number.int({ min: 1, max: 4 }), totalSold - ticketsAssigned);

            const subtotal = tt.price * qty;
            const fees = subtotal * 0.12;
            const tax = subtotal * 0.08;
            const promoCode = Math.random() > 0.85 ? promoCodes[faker.number.int({ min: 0, max: promoCodes.length - 1 })] : null;
            const discount = promoCode ? subtotal * 0.1 : 0;

            const order = await prisma.order.create({
                data: {
                    orderNumber: `ORD-${faker.string.alphanumeric(10).toUpperCase()}`,
                    userId: customer.id,
                    eventId: ev.id,
                    status,
                    totalAmount: subtotal + fees + tax - discount,
                    feesAmount: fees,
                    taxAmount: tax,
                    discountAmount: discount,
                    paymentStatus,
                    paymentIntentId: paymentStatus === PaymentStatus.SUCCEEDED ? `pi_${faker.string.alphanumeric(24)}` : null,
                    paymentMethod: paymentStatus === PaymentStatus.SUCCEEDED ? 'card' : null,
                    promoCodeId: promoCode?.id || null,
                    ipAddress: faker.internet.ipv4(),
                    userAgent: faker.internet.userAgent(),
                    createdAt: orderTime,
                    updatedAt: orderTime,
                },
            });

            totalOrders++;

            // Create tickets only for PAID orders
            if (status === OrderStatus.PAID) {
                for (let k = 0; k < qty; k++) {
                    await prisma.ticket.create({
                        data: {
                            orderId: order.id,
                            eventId: ev.id,
                            ticketTypeId: tt.id,
                            userId: customer.id,
                            barcode: `TIX-${faker.string.alphanumeric(12).toUpperCase()}`,
                            qrCodeUrl: `https://qr.tixmo.com/${faker.string.alphanumeric(16)}`,
                            status: TicketStatus.VALID,
                            pricePaid: tt.price,
                            createdAt: orderTime,
                        },
                    });
                    totalTickets++;
                }
            }

            ticketsAssigned += qty;
        }
    }
    console.log(`  ✓ ${totalOrders} orders, ${totalTickets} tickets`);

    // ──────────────────────────────────────────────────────────
    // 8. SCANNERS & SCAN LOGS (for completed events)
    // ──────────────────────────────────────────────────────────
    console.log('📱 Simulating check-ins for past events...');

    const completedEvents = events.filter(e => e.status === EventStatus.COMPLETED);
    let totalScans = 0;

    for (const ev of completedEvents) {
        // Create scanners
        const scanner1 = await prisma.scanner.create({
            data: {
                organizationId: orgs[0].id,
                eventId: ev.id,
                name: `Main Entrance - ${ev.name}`,
                apiKey: faker.string.uuid(),
                createdBy: adminUser.id,
                status: ScannerStatus.ACTIVE,
            },
        });
        const scanner2 = await prisma.scanner.create({
            data: {
                organizationId: orgs[0].id,
                eventId: ev.id,
                name: `VIP Entrance - ${ev.name}`,
                apiKey: faker.string.uuid(),
                createdBy: adminUser.id,
                status: ScannerStatus.ACTIVE,
            },
        });

        // Get valid tickets for this event
        const eventTickets = await prisma.ticket.findMany({
            where: { eventId: ev.id, status: TicketStatus.VALID },
        });

        // 85% check-in rate
        const toScan = eventTickets.slice(0, Math.floor(eventTickets.length * 0.85));

        for (const ticket of toScan) {
            // Gaussian-ish around event start
            const minutesOffset = (Math.random() + Math.random() + Math.random() - 1.5) * 60;
            const scanTime = new Date((ev.startDatetime || now).getTime() + minutesOffset * 60 * 1000);

            // Check if VIP ticket
            const tts = ticketTypeMap.get(ev.id);
            const isVip = tts ? ticket.ticketTypeId === tts[2]?.id : false;

            await prisma.scanLog.create({
                data: {
                    scannerId: isVip ? scanner2.id : scanner1.id,
                    ticketId: ticket.id,
                    eventId: ev.id,
                    scanType: 'ENTRY',
                    success: true,
                    scannedAt: scanTime,
                },
            });

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: TicketStatus.USED,
                    checkedInAt: scanTime,
                    checkedInBy: isVip ? scanner2.id : scanner1.id,
                },
            });
            totalScans++;
        }
    }

    // Also create some scanners for upcoming events
    for (const ev of events.filter(e => e.status === EventStatus.ON_SALE)) {
        await prisma.scanner.create({
            data: {
                organizationId: orgs[0].id,
                eventId: ev.id,
                name: `Main Gate - ${ev.name}`,
                apiKey: faker.string.uuid(),
                createdBy: adminUser.id,
                status: ScannerStatus.ACTIVE,
            },
        });
    }

    const scannerCount = await prisma.scanner.count();
    console.log(`  ✓ ${scannerCount} scanners, ${totalScans} scan logs`);

    // ──────────────────────────────────────────────────────────
    // 9. TASKS
    // ──────────────────────────────────────────────────────────
    console.log('📋 Creating tasks...');

    const taskConfigs = [
        { title: 'Design event poster for Summer Beats', tag: TaskTag.DESIGN, status: TaskStatus.DONE, priority: TaskPriority.HIGH },
        { title: 'Review vendor contracts', tag: TaskTag.LEGAL, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH },
        { title: 'Set up social media campaign', tag: TaskTag.MARKETING, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM },
        { title: 'Order stage equipment', tag: TaskTag.OPS, status: TaskStatus.TO_DO, priority: TaskPriority.HIGH },
        { title: 'Update website landing page', tag: TaskTag.DEV, status: TaskStatus.REVIEW, priority: TaskPriority.MEDIUM },
        { title: 'Coordinate security team schedule', tag: TaskTag.OPS, status: TaskStatus.TO_DO, priority: TaskPriority.HIGH },
        { title: 'Finalize VIP experience plan', tag: TaskTag.GENERAL, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM },
        { title: 'Send artist confirmation emails', tag: TaskTag.GENERAL, status: TaskStatus.DONE, priority: TaskPriority.HIGH },
        { title: 'Design VIP badges', tag: TaskTag.DESIGN, status: TaskStatus.REVIEW, priority: TaskPriority.LOW },
        { title: 'Setup merch booth layout', tag: TaskTag.OPS, status: TaskStatus.TO_DO, priority: TaskPriority.LOW },
        { title: 'Create sponsor deck', tag: TaskTag.MARKETING, status: TaskStatus.DONE, priority: TaskPriority.MEDIUM },
        { title: 'Book catering for backstage', tag: TaskTag.OPS, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM },
        { title: 'Prepare emergency protocols', tag: TaskTag.LEGAL, status: TaskStatus.DONE, priority: TaskPriority.HIGH },
        { title: 'Test ticket scanning hardware', tag: TaskTag.DEV, status: TaskStatus.TO_DO, priority: TaskPriority.HIGH },
        { title: 'Draft press release', tag: TaskTag.MARKETING, status: TaskStatus.REVIEW, priority: TaskPriority.LOW },
        { title: 'Arrange parking logistics', tag: TaskTag.OPS, status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM },
        { title: 'Set up livestream infrastructure', tag: TaskTag.DEV, status: TaskStatus.TO_DO, priority: TaskPriority.LOW },
        { title: 'Review accessibility compliance', tag: TaskTag.LEGAL, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH },
        { title: 'Create event day run sheet', tag: TaskTag.GENERAL, status: TaskStatus.TO_DO, priority: TaskPriority.HIGH },
        { title: 'Order branded wristbands', tag: TaskTag.OPS, status: TaskStatus.DONE, priority: TaskPriority.MEDIUM },
    ];

    const orgTeam = teamUsers.filter(u => u.organizationId === orgs[0].id);
    const tasks = [];

    for (let i = 0; i < taskConfigs.length; i++) {
        const tc = taskConfigs[i];
        const assignee = orgTeam[i % orgTeam.length];
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + faker.number.int({ min: -10, max: 30 }));

        const task = await prisma.task.create({
            data: {
                organizationId: orgs[0].id,
                assigneeId: assignee.id,
                title: tc.title,
                description: faker.lorem.paragraph(),
                status: tc.status,
                priority: tc.priority,
                tag: tc.tag,
                dueDate,
            },
        });
        tasks.push(task);

        // Add 0-3 comments per task
        const commentCount = faker.number.int({ min: 0, max: 3 });
        for (let j = 0; j < commentCount; j++) {
            const commenter = orgTeam[faker.number.int({ min: 0, max: orgTeam.length - 1 })];
            await prisma.taskComment.create({
                data: {
                    taskId: task.id,
                    userId: commenter.id,
                    content: faker.lorem.sentences({ min: 1, max: 3 }),
                },
            });
        }
    }

    const commentCount = await prisma.taskComment.count();
    console.log(`  ✓ ${tasks.length} tasks, ${commentCount} comments`);

    // ──────────────────────────────────────────────────────────
    // 10. NOTIFICATIONS
    // ──────────────────────────────────────────────────────────
    console.log('🔔 Creating notifications...');

    const notifTypes = [
        NotificationType.ORDER_CONFIRMATION,
        NotificationType.EVENT_REMINDER,
        NotificationType.WELCOME,
        NotificationType.PROMO,
        NotificationType.ANNOUNCEMENT,
        NotificationType.TASK_MENTION,
    ];
    const notifStatuses = [NotificationStatus.SENT, NotificationStatus.READ, NotificationStatus.PENDING];

    const notifData = [];
    for (let i = 0; i < 100; i++) {
        const type = notifTypes[i % notifTypes.length];
        const status = notifStatuses[i % notifStatuses.length];
        const user = i < 80
            ? allCustomers[i % allCustomers.length]
            : teamUsers[i % teamUsers.length];

        notifData.push({
            userId: user.id,
            type,
            status,
            subject: type === NotificationType.ORDER_CONFIRMATION ? 'Your tickets are confirmed!'
                : type === NotificationType.EVENT_REMINDER ? 'Event coming up soon!'
                    : type === NotificationType.WELCOME ? 'Welcome to TixMo!'
                        : type === NotificationType.PROMO ? 'Special offer just for you!'
                            : type === NotificationType.ANNOUNCEMENT ? 'Important update about your event'
                                : 'You were mentioned in a task',
            message: faker.lorem.paragraph(),
            sentAt: status !== NotificationStatus.PENDING ? randomDate(new Date(now.getTime() - 30 * 86400000), now) : null,
            readAt: status === NotificationStatus.READ ? randomDate(new Date(now.getTime() - 15 * 86400000), now) : null,
        });
    }
    await prisma.notification.createMany({ data: notifData });
    console.log(`  ✓ 100 notifications`);

    // ──────────────────────────────────────────────────────────
    // 11. NOTIFICATION PREFERENCES (for team users)
    // ──────────────────────────────────────────────────────────
    const prefData = teamUsers.map(u => ({
        userId: u.id,
        emailOrderConfirm: true,
        emailTicketTransfer: true,
        emailEventReminder: true,
        emailPromo: faker.datatype.boolean(),
        emailAnnouncement: true,
        smsOrderConfirm: faker.datatype.boolean(),
        smsEventReminder: faker.datatype.boolean(),
    }));
    await prisma.notificationPreference.createMany({ data: prefData });
    console.log(`  ✓ ${prefData.length} notification preferences`);

    // ──────────────────────────────────────────────────────────
    // 12. WAITLIST ENTRIES
    // ──────────────────────────────────────────────────────────
    console.log('⏳ Creating waitlist entries...');

    const soldOutEvents = events.filter(e => e.status === EventStatus.SOLD_OUT);
    let waitlistTotal = 0;

    for (const ev of soldOutEvents) {
        const waitlistSize = faker.number.int({ min: 10, max: 20 });
        const wlData = [];
        for (let i = 0; i < waitlistSize; i++) {
            const cust = allCustomers[(waitlistTotal + i) % allCustomers.length];
            wlData.push({
                eventId: ev.id,
                userId: cust.id,
                status: faker.helpers.arrayElement(['PENDING', 'NOTIFIED', 'EXPIRED']),
            });
        }
        await prisma.waitlist.createMany({ data: wlData, skipDuplicates: true });
        waitlistTotal += waitlistSize;
    }
    console.log(`  ✓ ${waitlistTotal} waitlist entries`);

    // ──────────────────────────────────────────────────────────
    // 13. APPROVAL REQUESTS
    // ──────────────────────────────────────────────────────────
    console.log('✅ Creating approval requests...');

    const approvalStatuses: ApprovalStatus[] = [
        ApprovalStatus.DRAFT,
        ApprovalStatus.PENDING,
        ApprovalStatus.PENDING,
        ApprovalStatus.APPROVED,
        ApprovalStatus.APPROVED,
        ApprovalStatus.CHANGES_REQUESTED,
        ApprovalStatus.REJECTED,
        ApprovalStatus.PENDING,
    ];

    const approvalTitles = [
        'Event poster design - Summer Beats',
        'VIP lounge layout approval',
        'Marketing email copy review',
        'Sponsorship banner designs',
        'Stage setup blueprint',
        'Merch booth graphics',
        'Social media ad creatives',
        'Event program booklet',
    ];

    for (let i = 0; i < approvalTitles.length; i++) {
        const status = approvalStatuses[i];
        const creator = orgTeam[i % orgTeam.length];
        const ev = events[i % events.length];

        const req = await prisma.approvalRequest.create({
            data: {
                organizationId: orgs[0].id,
                eventId: ev.id,
                createdById: creator.id,
                title: approvalTitles[i],
                description: faker.lorem.paragraph(),
                instructions: faker.lorem.sentences(2),
                status,
                priority: faker.helpers.arrayElement([ApprovalPriority.STANDARD, ApprovalPriority.URGENT, ApprovalPriority.CRITICAL]),
                dueDate: new Date(now.getTime() + faker.number.int({ min: 1, max: 14 }) * 86400000),
                version: faker.number.int({ min: 1, max: 3 }),
            },
        });

        // Create 1-2 mock assets (no actual S3, just metadata)
        const assetCount = faker.number.int({ min: 1, max: 2 });
        for (let a = 0; a < assetCount; a++) {
            await prisma.approvalAsset.create({
                data: {
                    approvalRequestId: req.id,
                    filename: `${faker.system.commonFileName('png')}`,
                    originalName: `${faker.system.commonFileName('png')}`,
                    mimeType: 'image/png',
                    size: faker.number.int({ min: 50000, max: 5000000 }),
                    s3Key: `approvals/${req.id}/${faker.string.uuid()}.png`,
                    s3Url: `https://s3.example.com/approvals/${req.id}/${faker.string.uuid()}.png`,
                    version: 1,
                },
            });
        }

        // Create 2-3 reviewers
        const reviewerCount = faker.number.int({ min: 2, max: 3 });
        for (let r = 0; r < reviewerCount; r++) {
            const reviewer = orgTeam[(i + r + 1) % orgTeam.length];
            const hasDecided = status === ApprovalStatus.APPROVED || status === ApprovalStatus.REJECTED || status === ApprovalStatus.CHANGES_REQUESTED;

            await prisma.approvalReviewer.create({
                data: {
                    approvalRequestId: req.id,
                    email: reviewer.email,
                    name: `${reviewer.firstName} ${reviewer.lastName}`,
                    userId: reviewer.id,
                    token: faker.string.uuid(),
                    tokenExpiresAt: new Date(now.getTime() + 7 * 86400000),
                    decision: hasDecided
                        ? (status === ApprovalStatus.APPROVED ? ApprovalDecision.APPROVED
                            : status === ApprovalStatus.REJECTED ? ApprovalDecision.REJECTED
                                : ApprovalDecision.CHANGES_REQUESTED)
                        : null,
                    decisionAt: hasDecided ? randomDate(new Date(now.getTime() - 5 * 86400000), now) : null,
                    decisionNote: hasDecided ? faker.lorem.sentence() : null,
                    viewedAt: hasDecided || Math.random() > 0.3 ? randomDate(new Date(now.getTime() - 7 * 86400000), now) : null,
                },
            });
        }

        // Create 0-4 comments
        const cmtCount = faker.number.int({ min: 0, max: 4 });
        for (let c = 0; c < cmtCount; c++) {
            const commenter = orgTeam[faker.number.int({ min: 0, max: orgTeam.length - 1 })];
            await prisma.approvalComment.create({
                data: {
                    approvalRequestId: req.id,
                    userId: commenter.id,
                    content: faker.lorem.sentences({ min: 1, max: 2 }),
                    resolved: faker.datatype.boolean(),
                    annotation: Math.random() > 0.5
                        ? { x: faker.number.int({ min: 10, max: 90 }), y: faker.number.int({ min: 10, max: 90 }), width: 20, height: 20 }
                        : Prisma.JsonNull,
                },
            });
        }
    }

    const approvalCount = await prisma.approvalRequest.count();
    const approvalAssetCount = await prisma.approvalAsset.count();
    const reviewerCount = await prisma.approvalReviewer.count();
    const approvalCommentCount = await prisma.approvalComment.count();
    console.log(`  ✓ ${approvalCount} approvals, ${approvalAssetCount} assets, ${reviewerCount} reviewers, ${approvalCommentCount} comments`);

    // ──────────────────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(55));
    console.log('  📊 POPULATE SUMMARY');
    console.log('═'.repeat(55));

    const counts = {
        organizations: await prisma.organization.count(),
        users: await prisma.user.count(),
        venues: await prisma.venue.count(),
        events: await prisma.event.count(),
        ticketTypes: await prisma.ticketType.count(),
        ticketTiers: await prisma.ticketTier.count(),
        promoCodes: await prisma.promoCode.count(),
        orders: await prisma.order.count(),
        tickets: await prisma.ticket.count(),
        scanners: await prisma.scanner.count(),
        scanLogs: await prisma.scanLog.count(),
        tasks: await prisma.task.count(),
        taskComments: await prisma.taskComment.count(),
        notifications: await prisma.notification.count(),
        notificationPreferences: await prisma.notificationPreference.count(),
        waitlistEntries: await prisma.waitlist.count(),
        approvalRequests: await prisma.approvalRequest.count(),
        approvalAssets: await prisma.approvalAsset.count(),
        approvalReviewers: await prisma.approvalReviewer.count(),
        approvalComments: await prisma.approvalComment.count(),
    };

    for (const [model, count] of Object.entries(counts)) {
        const label = model.replace(/([A-Z])/g, ' $1').trim();
        console.log(`  ${label.padEnd(25)} ${String(count).padStart(6)}`);
    }

    console.log('═'.repeat(55));
    console.log('\n🔑 Login credentials:');
    console.log('  Email:    admin@tixmo.com');
    console.log('  Password: Password123!');
    console.log('  (All users share this password)\n');
}
