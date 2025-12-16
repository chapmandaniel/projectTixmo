# Comprehensive Demo Data Implementation Plan for Tixmo API

## Overview

This document provides a complete implementation plan for creating comprehensive, realistic demo data for any project instance of the Tixmo API. The demo data system will support development, testing, sales demonstrations, and QA activities.

## Project Context

**Tixmo API** is an enterprise-grade event ticketing platform with:
- 14 core database models (Users, Organizations, Venues, Events, Tickets, Orders, etc.)
- 49 production-ready API endpoints
- PostgreSQL database with Prisma ORM
- Multi-organization architecture (Promoters, Venues, Resellers)
- Complete ticket lifecycle management (purchase, transfer, check-in, cancellation)

---

## Phase 1: Foundation & Architecture (Days 1-2)

### 1.1 File Structure

Create the following directory structure under `prisma/`:

```
prisma/
├── seed.ts                          # Main seed orchestrator
├── seeders/
│   ├── index.ts                     # Export all seeders
│   ├── 01-users.seeder.ts           # User creation
│   ├── 02-organizations.seeder.ts   # Organization creation
│   ├── 03-venues.seeder.ts          # Venue creation
│   ├── 04-events.seeder.ts          # Event creation
│   ├── 05-ticket-types.seeder.ts    # Ticket tier creation
│   ├── 06-promo-codes.seeder.ts     # Promo code creation
│   ├── 07-orders.seeder.ts          # Order creation
│   ├── 08-tickets.seeder.ts         # Ticket generation
│   ├── 09-scanners.seeder.ts        # Scanner device creation
│   └── 10-notifications.seeder.ts   # Notification creation
├── factories/
│   ├── user.factory.ts              # User data generator
│   ├── organization.factory.ts      # Organization data generator
│   ├── venue.factory.ts             # Venue data generator
│   ├── event.factory.ts             # Event data generator
│   ├── ticket-type.factory.ts       # Ticket type generator
│   ├── promo-code.factory.ts        # Promo code generator
│   └── order.factory.ts             # Order generator
├── fixtures/
│   ├── addresses.json               # Real US/international addresses
│   ├── event-templates.json         # Event categories & themes
│   ├── venue-templates.json         # Venue types & capacities
│   ├── pricing-strategies.json      # Ticket pricing patterns
│   └── promo-templates.json         # Common promo code patterns
└── utils/
    ├── seed-logger.ts               # Custom logging for seed process
    ├── data-generator.ts            # Common data generation utilities
    └── cleanup.ts                   # Database cleanup utilities
```

### 1.2 Dependencies

Install required packages:

```bash
npm install --save-dev @faker-js/faker
npm install --save-dev chalk
```

### 1.3 Data Creation Order & Dependencies

The seed process must follow this dependency graph:

```
1. Users (independent)
   ↓
2. Organizations (requires: admin users)
   ↓
3. Venues (requires: organizations)
   ↓
4. Events (requires: organizations, venues)
   ↓
5. TicketTypes (requires: events)
   ↓
6. PromoCodes (requires: organizations)
   ↓
7. Orders (requires: users, events, ticket types, optional promo codes)
   ↓
8. Tickets (auto-generated from orders, requires: orders)
   ↓
9. Scanners (requires: organizations, events)
   ↓
10. ScanLogs (requires: scanners, tickets)
    ↓
11. Notifications (requires: users)
```

---

## Phase 2: Demo Data Scenarios & Personas (Day 3)

### 2.1 User Personas (15-20 total users)

#### Admins (2 users)
- System admin with full access
- Operations admin for monitoring

#### Promoters (4-5 users)
- Major concert promoter (LiveNation-style)
- Independent music promoter
- Sports venue manager
- Theater/arts promoter
- Corporate events coordinator

#### Customers (8-10 users)
- Frequent attendee (multiple orders)
- First-time buyer
- VIP customer (high-value orders)
- Group ticket buyer
- Last-minute purchaser
- Customer with transferred tickets
- Customer with cancelled order
- Inactive customer (registered, no orders)

#### Scanners (2-3 users)
- Main venue scanner operator
- Mobile scanner operator

### 2.2 Organization Scenarios (5-7 organizations)

#### Type: PROMOTER

**1. "Starlight Events"** - Major concert promoter
- Multiple high-capacity events
- Premium pricing strategy
- Active promo campaigns

**2. "Underground Productions"** - Indie/alternative promoter
- Smaller venue events
- Student discounts
- Early bird pricing

**3. "Champions Sports Group"** - Sports organization
- Stadium events
- Season ticket packages
- Group sales focus

#### Type: VENUE

**4. "The Grand Theater"** - Performing arts venue
- Theater shows, comedy, concerts
- Tiered seating
- Member discounts

**5. "Metro Convention Center"** - Conference venue
- Corporate events
- Trade shows
- Multi-day events

#### Type: RESELLER

**6. "TicketHub Resale"** - Secondary market
- Resale listings
- Dynamic pricing

### 2.3 Venue Scenarios (8-12 venues)

#### Large Capacity (10,000+)
- Outdoor amphitheater
- Sports stadium
- Convention center

#### Medium Capacity (1,000-10,000)
- Concert hall
- Theater
- Arena

#### Small Capacity (<1,000)
- Comedy club
- Jazz club
- Black box theater
- Community center

#### Geographic Distribution
- New York, NY
- Los Angeles, CA
- Chicago, IL
- Austin, TX
- Nashville, TN
- Portland, OR

### 2.4 Event Scenarios (20-30 events)

#### Status Distribution
- 40% ON_SALE (active, available)
- 20% PUBLISHED (upcoming sales)
- 15% SOLD_OUT (high demand)
- 10% COMPLETED (past events with check-ins)
- 10% DRAFT (in planning)
- 5% CANCELLED (edge cases)

#### Categories
- Concerts (rock, pop, hip-hop, jazz, classical)
- Sports (basketball, football, soccer)
- Comedy shows
- Theater/Broadway
- Conferences/trade shows
- Festivals (multi-day)
- Family events
- Food & wine events

#### Timing
- 30% in next 7-30 days (urgent sales)
- 50% in 1-3 months (main window)
- 15% in 3-6 months (early planning)
- 5% past events (completed/cancelled)

### 2.5 Ticket Type Scenarios (60-90 ticket types)

#### Typical Event Structure (3-4 tiers per event)
- General Admission (lowest price, highest quantity)
- Reserved Seating (mid price, moderate quantity)
- VIP/Premium (high price, limited quantity)
- Early Bird (discount, limited time)
- Student/Senior (discount, requires verification)
- Group Packages (bulk discount, minimum quantity)

#### Pricing Examples
- Small club show: $15-$40
- Concert hall: $50-$150
- Stadium concert: $75-$500
- Theater: $40-$125
- Sports game: $30-$300
- Conference: $99-$1,500

### 2.6 Promo Code Scenarios (15-20 codes)

#### Active Codes (60%)
- `EARLYBIRD10` - 10% off, limited uses
- `STUDENT15` - 15% off for students
- `GROUP20` - 20% off for 5+ tickets
- `FLASH25` - 25% off, expires soon
- `WELCOME10` - New customer discount
- `VIP50` - $50 off $200+
- `LOYALTY` - 20% off for returning customers

#### Expired Codes (20%)
- `NEWYEAR25` - Expired Jan 2025
- `HOLIDAY20` - Expired Dec 2024

#### Disabled Codes (10%)
- `FRAUD` - Disabled due to abuse

#### Event-Specific Codes (10%)
- `ROCKFEST20` - Valid for specific event

### 2.7 Order & Ticket Scenarios (30-50 orders)

#### Payment Status Distribution
- 70% PAID (successful orders)
- 15% PENDING (in-progress)
- 10% CANCELLED (user/system cancelled)
- 5% REFUNDED (customer service)

#### Order Types
- Single ticket purchase
- Multiple ticket types in one order
- Group purchases (5-10 tickets)
- VIP package purchases
- Orders with promo codes applied
- High-value orders ($500+)
- Last-minute purchases

#### Ticket States
- 60% VALID (unused, active)
- 20% USED (checked in)
- 10% TRANSFERRED (ownership changed)
- 10% CANCELLED (refunded)

---

## Phase 3: Implementation Strategy (Days 4-7)

### 3.1 Factory Pattern Implementation

#### Example: User Factory

**File: `prisma/factories/user.factory.ts`**

```typescript
import { faker } from '@faker-js/faker';
import { Role } from '@prisma/client';
import { hashPassword } from '../../src/utils/password';

export interface UserFactoryOptions {
  role?: Role;
  organizationId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

export async function createUserData(options: UserFactoryOptions = {}) {
  const firstName = options.firstName || faker.person.firstName();
  const lastName = options.lastName || faker.person.lastName();

  return {
    email: options.email || faker.internet.email({ firstName, lastName }).toLowerCase(),
    passwordHash: await hashPassword('Password123!'), // Standard demo password
    firstName,
    lastName,
    phone: faker.phone.number('###-###-####'),
    role: options.role || Role.CUSTOMER,
    organizationId: options.organizationId || null,
    emailVerified: options.emailVerified ?? true,
    emailVerifiedAt: options.emailVerified ? new Date() : null,
  };
}

export function generateBulkUsers(count: number, role: Role): Promise<any[]> {
  return Promise.all(
    Array.from({ length: count }, () => createUserData({ role }))
  );
}
```

#### Example: Event Factory

**File: `prisma/factories/event.factory.ts`**

```typescript
import { faker } from '@faker-js/faker';
import { EventStatus } from '@prisma/client';

export interface EventFactoryOptions {
  organizationId: string;
  venueId: string;
  template?: any;
  status?: EventStatus;
  daysFromNow?: number;
}

export function createEventData(options: EventFactoryOptions) {
  const daysFromNow = options.daysFromNow || faker.number.int({ min: 7, max: 90 });
  const startDatetime = faker.date.soon({ days: daysFromNow });
  const endDatetime = new Date(startDatetime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

  return {
    organizationId: options.organizationId,
    venueId: options.venueId,
    name: options.template?.name || faker.music.songName() + ' Concert',
    slug: faker.helpers.slugify(options.template?.name || faker.music.songName()).toLowerCase(),
    description: faker.lorem.paragraphs(2),
    category: options.template?.category || faker.helpers.arrayElement(['CONCERT', 'SPORTS', 'COMEDY', 'THEATER']),
    tags: options.template?.tags || [faker.music.genre(), faker.helpers.arrayElement(['live', 'outdoor', 'family-friendly'])],
    startDatetime,
    endDatetime,
    timezone: 'America/New_York',
    status: options.status || EventStatus.ON_SALE,
    salesStart: faker.date.recent({ days: 30 }),
    salesEnd: new Date(startDatetime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before event
    capacity: faker.number.int({ min: 100, max: 10000 }),
    images: [
      { url: faker.image.url(), alt: 'Event banner' }
    ],
  };
}
```

### 3.2 Seeder Implementation Pattern

#### Example: Events Seeder

**File: `prisma/seeders/04-events.seeder.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedLogger } from '../utils/seed-logger';
import { createEventData } from '../factories/event.factory';
import eventTemplates from '../fixtures/event-templates.json';

export async function seedEvents(
  prisma: PrismaClient,
  organizations: any[],
  venues: any[]
) {
  seedLogger.info('Seeding events...');

  const events = [];
  const eventCount = parseInt(process.env.SEED_EVENT_COUNT || '25');

  // Create events from templates
  for (let i = 0; i < eventCount; i++) {
    const template = eventTemplates[i % eventTemplates.length];
    const org = organizations.find(o => o.type === 'PROMOTER');
    const venue = venues[i % venues.length];

    if (org && venue) {
      const eventData = createEventData({
        organizationId: org.id,
        venueId: venue.id,
        template,
      });

      const event = await prisma.event.create({ data: eventData });
      events.push(event);
      seedLogger.success(`Created event: ${event.name}`);
    }
  }

  seedLogger.info(`✓ Created ${events.length} events`);
  return events;
}
```

### 3.3 Main Seed Orchestrator

**File: `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedLogger } from './utils/seed-logger';
import { cleanupDatabase } from './utils/cleanup';
import { seedUsers } from './seeders/01-users.seeder';
import { seedOrganizations } from './seeders/02-organizations.seeder';
import { seedVenues } from './seeders/03-venues.seeder';
import { seedEvents } from './seeders/04-events.seeder';
import { seedTicketTypes } from './seeders/05-ticket-types.seeder';
import { seedPromoCodes } from './seeders/06-promo-codes.seeder';
import { seedOrders } from './seeders/07-orders.seeder';
import { seedTickets } from './seeders/08-tickets.seeder';
import { seedScanners } from './seeders/09-scanners.seeder';
import { seedNotifications } from './seeders/10-notifications.seeder';

const prisma = new PrismaClient();

async function main() {
  seedLogger.info('🌱 Starting database seed...\n');

  // Optional: Clean existing data
  const shouldClean = process.env.SEED_CLEAN === 'true';
  if (shouldClean) {
    await cleanupDatabase(prisma);
  }

  try {
    // Execute seeders in dependency order
    const users = await seedUsers(prisma);
    const organizations = await seedOrganizations(prisma, users);
    const venues = await seedVenues(prisma, organizations);
    const events = await seedEvents(prisma, organizations, venues);
    const ticketTypes = await seedTicketTypes(prisma, events);
    const promoCodes = await seedPromoCodes(prisma, organizations);
    const orders = await seedOrders(prisma, users, events, ticketTypes, promoCodes);
    const tickets = await seedTickets(prisma, orders);
    const scanners = await seedScanners(prisma, organizations, events);
    const notifications = await seedNotifications(prisma, users);

    // Summary
    seedLogger.info('\n📊 Seed Summary:');
    seedLogger.info(`Users: ${users.length}`);
    seedLogger.info(`Organizations: ${organizations.length}`);
    seedLogger.info(`Venues: ${venues.length}`);
    seedLogger.info(`Events: ${events.length}`);
    seedLogger.info(`Ticket Types: ${ticketTypes.length}`);
    seedLogger.info(`Promo Codes: ${promoCodes.length}`);
    seedLogger.info(`Orders: ${orders.length}`);
    seedLogger.info(`Tickets: ${tickets.length}`);
    seedLogger.info(`Scanners: ${scanners.length}`);

    seedLogger.success('\n✅ Database seeded successfully!\n');

    // Print demo credentials
    printDemoCredentials(users);

  } catch (error) {
    seedLogger.error('❌ Seed failed:', error);
    throw error;
  }
}

function printDemoCredentials(users: any[]) {
  seedLogger.info('🔑 Demo Credentials:');
  seedLogger.info('─'.repeat(50));

  const admin = users.find(u => u.role === 'ADMIN');
  if (admin) {
    seedLogger.info(`Admin: ${admin.email} / Password123!`);
  }

  const promoter = users.find(u => u.role === 'PROMOTER');
  if (promoter) {
    seedLogger.info(`Promoter: ${promoter.email} / Password123!`);
  }

  const customer = users.find(u => u.role === 'CUSTOMER');
  if (customer) {
    seedLogger.info(`Customer: ${customer.email} / Password123!`);
  }

  seedLogger.info('─'.repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 3.4 Utility Functions

#### Seed Logger

**File: `prisma/utils/seed-logger.ts`**

```typescript
import chalk from 'chalk';

export const seedLogger = {
  info: (message: string, ...args: any[]) => {
    console.log(chalk.blue('ℹ'), message, ...args);
  },
  success: (message: string, ...args: any[]) => {
    console.log(chalk.green('✓'), message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.log(chalk.red('✗'), message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.log(chalk.yellow('⚠'), message, ...args);
  },
};
```

#### Database Cleanup

**File: `prisma/utils/cleanup.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';

export async function cleanupDatabase(prisma: PrismaClient) {
  seedLogger.warn('Cleaning database...');

  // Delete in reverse dependency order
  await prisma.notification.deleteMany();
  await prisma.scanLog.deleteMany();
  await prisma.scanner.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.user.deleteMany();

  seedLogger.success('Database cleaned');
}
```

---

## Phase 4: Data Quality & Realism (Day 8)

### 4.1 Data Validation Rules

All demo data must meet these validation criteria:

#### Uniqueness Constraints
- ✓ All email addresses are unique
- ✓ All order numbers are unique
- ✓ All barcodes are unique
- ✓ All organization slugs are unique
- ✓ All event slugs are unique

#### Business Logic Validation
- ✓ Ticket quantities don't exceed event capacity
- ✓ Ticket quantities sold + available = total quantity
- ✓ Order totals match: (ticket prices + fees + tax - discounts)
- ✓ Event end times are after start times
- ✓ Sales end dates are before event start dates
- ✓ Promo code valid dates are logical (start before end)
- ✓ Foreign key relationships are valid

#### Data Type Validation
- ✓ Email addresses are valid format
- ✓ Phone numbers follow US format
- ✓ Dates are valid ISO 8601 format
- ✓ Prices are non-negative decimals
- ✓ Quantities are positive integers

### 4.2 Realistic Data Patterns

#### Dates & Times
- Use proper timezone handling (America/New_York, America/Los_Angeles, etc.)
- Events mostly on Friday/Saturday evenings (7-9 PM start times)
- Some weekday events (conferences, theater matinees)
- Multi-day festivals span consecutive days
- Sales windows typically 30-90 days before event

#### Pricing
- Follow industry standards by category:
  - Small club shows: $15-$40
  - Concert halls: $50-$150
  - Stadium concerts: $75-$500
  - Theater: $40-$125
  - Sports games: $30-$300
  - Conferences: $99-$1,500
- VIP tickets typically 2-5x general admission price
- Early bird discounts: 10-20% off
- Group discounts: 15-25% off
- Add realistic fees: 10-15% of ticket price

#### Inventory Management
- Most events 60-80% sold (realistic sell-through)
- Some sold out (100% sold)
- Some low inventory (90-99% sold, create urgency)
- Some just announced (<10% sold)
- Distribute inventory logically across ticket tiers

#### User Behavior Patterns
- Most customers have 1-2 orders (realistic distribution)
- Power users have 5-10 orders (top 10% of customers)
- Average 2.3 tickets per order
- Most orders purchased 2-4 weeks before event
- Higher price tickets sell closer to event date

#### Geographic Distribution
- Venues distributed across major US markets
- Address data uses real city/state/zip combinations
- Timezone matches geographic location

---

## Phase 5: CLI & Scripts (Day 9)

### 5.1 NPM Scripts Configuration

**Update `package.json`:**

```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:seed:clean": "SEED_CLEAN=true tsx prisma/seed.ts",
    "db:seed:minimal": "SEED_MODE=minimal tsx prisma/seed.ts",
    "db:seed:full": "SEED_MODE=full tsx prisma/seed.ts",
    "db:reset": "npm run db:drop && npm run db:migrate && npm run db:seed",
    "db:drop": "npx prisma migrate reset --force --skip-seed"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### 5.2 Environment Variables

**Add to `.env.example`:**

```bash
# Seed Configuration
SEED_CLEAN=false                    # Clean database before seeding
SEED_MODE=default                   # default | minimal | full
SEED_USER_COUNT=15                  # Number of users to create
SEED_ORG_COUNT=6                    # Number of organizations
SEED_VENUE_COUNT=10                 # Number of venues
SEED_EVENT_COUNT=25                 # Number of events
SEED_ORDER_COUNT=40                 # Number of orders
SEED_DEFAULT_PASSWORD=Password123!  # Default password for demo users
```

### 5.3 Seed Modes

#### Minimal Mode (Quick Testing)
Use: `npm run db:seed:minimal`

Quantities:
- 5 users
- 2 organizations
- 3 venues
- 5 events
- 10 ticket types
- 5 promo codes
- 10 orders

Time: ~10 seconds

#### Default Mode (Standard Demo)
Use: `npm run db:seed`

Quantities:
- 15 users
- 6 organizations
- 10 venues
- 25 events
- 75 ticket types
- 15 promo codes
- 40 orders

Time: ~30 seconds

#### Full Mode (Comprehensive Demo)
Use: `npm run db:seed:full`

Quantities:
- 30 users
- 10 organizations
- 20 venues
- 50 events
- 150 ticket types
- 30 promo codes
- 100 orders

Time: ~60 seconds

### 5.4 Common Commands

```bash
# Fresh start: drop database, migrate, and seed
npm run db:reset

# Seed with clean slate
npm run db:seed:clean

# Seed without cleaning (add to existing data)
npm run db:seed

# Quick minimal seed for testing
npm run db:seed:minimal

# Comprehensive seed for demos
npm run db:seed:full
```

### 5.5 Rollback & Recovery Strategy

A comprehensive rollback plan is essential for safely managing demo data, especially when seeding into environments with existing data or when testing seed scripts.

#### 5.5.1 Tagging Strategy

**Mark all demo data for identification:**

**Update Prisma schema to add metadata field:**

```prisma
// Add to each model that will have demo data
model User {
  // ... existing fields
  metadata  Json?  // Can store { isDemo: true, seedVersion: "1.0.0" }
}
```

**Alternative: Use specific patterns in IDs or emails:**

```typescript
// In factories, mark demo users with recognizable patterns
export async function createUserData(options: UserFactoryOptions = {}) {
  return {
    email: options.email || `demo.${faker.internet.userName()}@tixmo-demo.com`,
    // ... other fields
  };
}
```

#### 5.5.2 Database Backup Before Seeding

**Automatic backup utility:**

**File: `prisma/utils/backup.ts`**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { seedLogger } from './seed-logger';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function backupDatabase(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  seedLogger.info('Creating database backup...');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  // Parse database URL
  const url = new URL(dbUrl);
  const database = url.pathname.slice(1);
  const host = url.hostname;
  const port = url.port || '5432';
  const username = url.username;
  const password = url.password;

  try {
    // Use pg_dump to create backup
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F p -f "${backupFile}"`;
    await execAsync(command);

    seedLogger.success(`Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    seedLogger.error('Backup failed:', error);
    throw error;
  }
}

export async function restoreDatabase(backupFile: string): Promise<void> {
  seedLogger.info(`Restoring database from: ${backupFile}`);

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  const url = new URL(dbUrl);
  const database = url.pathname.slice(1);
  const host = url.hostname;
  const port = url.port || '5432';
  const username = url.username;
  const password = url.password;

  try {
    // Drop and recreate database, then restore
    const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${backupFile}"`;
    await execAsync(command);

    seedLogger.success('Database restored successfully');
  } catch (error) {
    seedLogger.error('Restore failed:', error);
    throw error;
  }
}

export async function listBackups(): Promise<string[]> {
  const backupDir = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.sql'))
    .map(file => path.join(backupDir, file))
    .sort()
    .reverse(); // Most recent first

  return files;
}
```

#### 5.5.3 Rollback Commands

**Update `package.json` scripts:**

```json
{
  "scripts": {
    "db:backup": "tsx prisma/utils/backup.ts backup",
    "db:restore": "tsx prisma/utils/backup.ts restore",
    "db:restore:latest": "tsx prisma/utils/backup.ts restore-latest",
    "db:seed:safe": "npm run db:backup && npm run db:seed",
    "db:rollback": "tsx prisma/utils/rollback.ts",
    "db:remove-demo": "tsx prisma/utils/remove-demo-data.ts"
  }
}
```

#### 5.5.4 Selective Demo Data Removal

**Remove only demo data, preserve production data:**

**File: `prisma/utils/remove-demo-data.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';

const prisma = new PrismaClient();

async function removeDemoData() {
  seedLogger.info('Removing demo data...');

  try {
    // Method 1: Using metadata field (if implemented)
    if (await hasMetadataField()) {
      await prisma.user.deleteMany({
        where: {
          metadata: {
            path: ['isDemo'],
            equals: true
          }
        }
      });
      // ... repeat for other models
    }

    // Method 2: Using email pattern
    const demoUsers = await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@tixmo-demo.com'
        }
      }
    });

    // Method 3: Using seed version tracking
    const latestSeed = await prisma.seedVersion.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (latestSeed) {
      // Delete all data created after the last seed
      await prisma.user.deleteMany({
        where: {
          createdAt: {
            gte: latestSeed.createdAt
          }
        }
      });
      // ... repeat for other models

      // Delete the seed version record
      await prisma.seedVersion.delete({
        where: { id: latestSeed.id }
      });
    }

    seedLogger.success('Demo data removed successfully');
  } catch (error) {
    seedLogger.error('Failed to remove demo data:', error);
    throw error;
  }
}

async function hasMetadataField(): Promise<boolean> {
  // Check if User model has metadata field
  try {
    await prisma.user.findFirst({
      select: { metadata: true }
    });
    return true;
  } catch {
    return false;
  }
}

removeDemoData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

#### 5.5.5 Rollback Workflow

**Update main seed orchestrator:**

**File: `prisma/seed.ts`**

```typescript
import { backupDatabase, listBackups } from './utils/backup';

async function main() {
  seedLogger.info('🌱 Starting database seed...\n');

  // Create backup before seeding (optional, controlled by env var)
  const shouldBackup = process.env.SEED_BACKUP === 'true';
  let backupFile: string | null = null;

  if (shouldBackup) {
    try {
      backupFile = await backupDatabase();
      seedLogger.info(`Backup created: ${backupFile}\n`);
    } catch (error) {
      seedLogger.warn('Backup failed, continuing without backup');
    }
  }

  // Optional: Clean existing data
  const shouldClean = process.env.SEED_CLEAN === 'true';
  if (shouldClean) {
    await cleanupDatabase(prisma);
  }

  try {
    // Execute seeders...
    const users = await seedUsers(prisma);
    // ... rest of seeders

    // Record seed version for tracking
    await prisma.seedVersion.create({
      data: {
        version: process.env.SEED_VERSION || '1.0.0',
        mode: process.env.SEED_MODE || 'default',
        metadata: {
          userCount: users.length,
          backupFile: backupFile,
          // ... other counts
        }
      }
    });

    seedLogger.success('\n✅ Database seeded successfully!');

  } catch (error) {
    seedLogger.error('❌ Seed failed:', error);

    // Offer to restore from backup
    if (backupFile) {
      seedLogger.warn(`\nTo rollback, run: npm run db:restore -- ${backupFile}`);
    }

    throw error;
  }
}
```

#### 5.5.6 Docker Snapshot Strategy

**For Docker-based databases:**

```bash
# Create a snapshot of the database container
docker commit tixmo_postgres tixmo_postgres_backup

# Rollback by stopping current and starting from snapshot
docker stop tixmo_postgres
docker run --name tixmo_postgres_restored tixmo_postgres_backup

# Or use volumes for data persistence
docker run -v tixmo_data:/var/lib/postgresql/data postgres:14
```

#### 5.5.7 Transaction-Based Seeding (Advanced)

**For atomic seed operations:**

```typescript
async function main() {
  // Use a transaction for all seed operations
  await prisma.$transaction(async (tx) => {
    const users = await seedUsers(tx);
    const organizations = await seedOrganizations(tx, users);
    const venues = await seedVenues(tx, organizations);
    // ... rest of seeders

    // If any seeder fails, entire transaction rolls back automatically
  }, {
    maxWait: 60000, // 60 seconds
    timeout: 300000, // 5 minutes
  });
}
```

**Note:** Transaction-based approach has limitations:
- All operations must complete within timeout
- May not work with very large datasets
- Some operations (like file uploads) can't be rolled back

#### 5.5.8 Rollback Safety Checklist

Before running seed in non-development environments:

- [ ] Create database backup: `npm run db:backup`
- [ ] Verify backup was created in `./backups/` directory
- [ ] Test rollback procedure in staging first
- [ ] Document the backup file location
- [ ] Set environment variables correctly
- [ ] Review seed counts to avoid excessive data
- [ ] Ensure sufficient database storage
- [ ] Plan for downtime if required
- [ ] Notify team members
- [ ] Have rollback command ready

#### 5.5.9 Environment-Specific Rollback Strategies

**Development:**
```bash
# Fast rollback: just reset everything
npm run db:reset
```

**Staging:**
```bash
# Safe rollback: backup then seed
npm run db:seed:safe

# If something goes wrong:
npm run db:restore:latest
```

**Production-like:**
```bash
# Never seed directly in production
# Use selective data import instead
npm run db:import -- --file=demo-data.json --tagged-only
```

#### 5.5.10 Automated Backup Rotation

**Keep last N backups, delete older ones:**

**File: `prisma/utils/backup-rotation.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { seedLogger } from './seed-logger';

export async function rotateBackups(keepCount: number = 5): Promise<void> {
  const backupDir = path.join(process.cwd(), 'backups');

  if (!fs.existsSync(backupDir)) {
    return;
  }

  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.sql'))
    .map(file => ({
      name: file,
      path: path.join(backupDir, file),
      time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time); // Newest first

  // Delete backups beyond keepCount
  const toDelete = files.slice(keepCount);

  for (const file of toDelete) {
    seedLogger.info(`Deleting old backup: ${file.name}`);
    fs.unlinkSync(file.path);
  }

  seedLogger.success(`Kept ${Math.min(files.length, keepCount)} most recent backups`);
}
```

#### 5.5.11 Quick Reference: Rollback Commands

| Scenario | Command | Description |
|----------|---------|-------------|
| Backup current state | `npm run db:backup` | Create backup before changes |
| Restore latest backup | `npm run db:restore:latest` | Restore most recent backup |
| Restore specific backup | `npm run db:restore -- backups/backup-2025-01-15.sql` | Restore from specific file |
| Safe seed (auto-backup) | `npm run db:seed:safe` | Backup then seed |
| Remove demo data only | `npm run db:remove-demo` | Delete demo data, keep real data |
| Full reset | `npm run db:reset` | Drop, migrate, seed (no backup) |
| List backups | `ls -lh backups/` | View available backups |

---

## Phase 6: Testing & Validation (Day 10)

### 6.1 Automated Validation

**File: `prisma/utils/validate-seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedLogger } from './seed-logger';

interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export async function validateSeedData(prisma: PrismaClient): Promise<boolean> {
  seedLogger.info('\n🔍 Validating seed data...\n');

  const checks: ValidationCheck[] = [];

  // Check 1: All users have unique emails
  const duplicateEmails = await prisma.user.groupBy({
    by: ['email'],
    having: {
      email: {
        _count: {
          gt: 1
        }
      }
    }
  });
  checks.push({
    name: 'Unique user emails',
    passed: duplicateEmails.length === 0,
    message: duplicateEmails.length > 0 ? `Found ${duplicateEmails.length} duplicate emails` : undefined
  });

  // Check 2: All orders have valid totals
  const orders = await prisma.order.findMany({
    include: { tickets: true },
  });
  const invalidTotals = orders.filter(order => {
    const ticketTotal = order.tickets.reduce((sum, t) => sum + t.pricePaid, 0);
    return Math.abs(ticketTotal - order.totalAmount) > 0.01;
  });
  checks.push({
    name: 'Order totals match ticket prices',
    passed: invalidTotals.length === 0,
    message: invalidTotals.length > 0 ? `Found ${invalidTotals.length} orders with invalid totals` : undefined
  });

  // Check 3: Events have valid date ranges
  const invalidEvents = await prisma.event.count({
    where: {
      endDatetime: {
        lte: prisma.event.fields.startDatetime
      }
    }
  });
  checks.push({
    name: 'Event dates are logical',
    passed: invalidEvents === 0,
    message: invalidEvents > 0 ? `Found ${invalidEvents} events with invalid dates` : undefined
  });

  // Check 4: All foreign keys are valid
  const orphanedVenues = await prisma.venue.count({
    where: { organization: null }
  });
  checks.push({
    name: 'All venues have valid organizations',
    passed: orphanedVenues === 0,
    message: orphanedVenues > 0 ? `Found ${orphanedVenues} orphaned venues` : undefined
  });

  // Check 5: Ticket inventory is consistent
  const ticketTypes = await prisma.ticketType.findMany();
  const inventoryErrors = ticketTypes.filter(tt =>
    tt.quantitySold + tt.quantityAvailable !== tt.quantityTotal
  );
  checks.push({
    name: 'Ticket inventory is consistent',
    passed: inventoryErrors.length === 0,
    message: inventoryErrors.length > 0 ? `Found ${inventoryErrors.length} ticket types with inventory errors` : undefined
  });

  // Check 6: Promo code values are valid
  const invalidPromos = await prisma.promoCode.count({
    where: {
      AND: [
        { discountType: 'PERCENTAGE' },
        { discountValue: { gt: 100 } }
      ]
    }
  });
  checks.push({
    name: 'Promo code percentages are valid',
    passed: invalidPromos === 0,
    message: invalidPromos > 0 ? `Found ${invalidPromos} promo codes with invalid percentages` : undefined
  });

  // Print results
  let allPassed = true;
  for (const check of checks) {
    if (check.passed) {
      seedLogger.success(check.name);
    } else {
      seedLogger.error(`${check.name}: ${check.message}`);
      allPassed = false;
    }
  }

  seedLogger.info('');
  return allPassed;
}
```

### 6.2 Manual Testing Checklist

After seeding, manually verify:

- [ ] Run `npm run db:seed` successfully without errors
- [ ] Verify API responses return seeded data (`GET /api/v1/events`)
- [ ] Test authentication with demo user credentials
- [ ] Create new order against seeded events (`POST /api/v1/orders`)
- [ ] Test promo code application in order creation
- [ ] Verify ticket transfer functionality works with seeded tickets
- [ ] Test scanner check-in with seeded tickets (`POST /api/v1/scanners/:id/scan`)
- [ ] Confirm organization permissions work correctly
- [ ] Test search/filter endpoints with seeded data
- [ ] Verify analytics endpoints return meaningful data
- [ ] Check Swagger UI displays all endpoints correctly
- [ ] Confirm seeded data appears realistic in UI/frontend

### 6.3 Integration Test Updates

Update existing integration tests to optionally use seed data:

```typescript
// tests/setup.ts
beforeAll(async () => {
  if (process.env.USE_SEED_DATA === 'true') {
    // Use seeded data instead of creating test fixtures
  } else {
    // Create minimal test fixtures as before
  }
});
```

---

## Phase 7: Documentation (Day 11)

### 7.1 Demo Data Usage Guide

**Create: `docs/DEMO_DATA.md`**

```markdown
# Demo Data Guide

## Overview

This document describes the demo data available in the Tixmo API after running the seed script. Demo data is useful for development, testing, sales demonstrations, and API exploration.

## Quick Start

```bash
# Seed the database
npm run db:seed

# Or start fresh (drop all data and re-seed)
npm run db:reset
```

## Demo Credentials

All demo users use the password: `Password123!`

### Admin Users

| Email | Role | Organization | Notes |
|-------|------|--------------|-------|
| admin@tixmo.com | ADMIN | - | Full system access |
| operations@tixmo.com | ADMIN | - | Operations monitoring |

### Promoter Users

| Email | Role | Organization | Notes |
|-------|------|--------------|-------|
| promoter@starlight.com | PROMOTER | Starlight Events | Major concert promoter |
| promoter@underground.com | PROMOTER | Underground Productions | Indie music promoter |
| promoter@champions.com | PROMOTER | Champions Sports Group | Sports venue manager |

### Customer Users

| Email | Role | Orders | Notes |
|-------|------|--------|-------|
| customer1@example.com | CUSTOMER | 5 | Frequent attendee |
| customer2@example.com | CUSTOMER | 1 | First-time buyer |
| vip@example.com | CUSTOMER | 3 | VIP customer (high-value) |
| group@example.com | CUSTOMER | 2 | Group ticket buyer |

### Scanner Users

| Email | Role | Notes |
|-------|------|-------|
| scanner@venue.com | SCANNER | Main venue operator |

## Demo Scenarios

### Scenario 1: Browse and Purchase Tickets

1. **Login as customer**
   ```bash
   POST /api/v1/auth/login
   {
     "email": "customer1@example.com",
     "password": "Password123!"
   }
   ```

2. **Browse available events**
   ```bash
   GET /api/v1/events?status=ON_SALE
   ```

3. **View event details**
   ```bash
   GET /api/v1/events/{eventId}
   ```

4. **Create order with promo code**
   ```bash
   POST /api/v1/orders
   {
     "items": [
       { "ticketTypeId": "{ticketTypeId}", "quantity": 2 }
     ],
     "promoCode": "EARLYBIRD10"
   }
   ```

### Scenario 2: Promoter Creates Event

1. **Login as promoter**
   ```bash
   POST /api/v1/auth/login
   {
     "email": "promoter@starlight.com",
     "password": "Password123!"
   }
   ```

2. **List your organization's venues**
   ```bash
   GET /api/v1/venues?organizationId={orgId}
   ```

3. **Create new event**
   ```bash
   POST /api/v1/events
   {
     "name": "Rock Concert 2025",
     "venueId": "{venueId}",
     "startDatetime": "2025-12-31T20:00:00Z",
     ...
   }
   ```

4. **Add ticket types**
   ```bash
   POST /api/v1/ticket-types
   {
     "eventId": "{eventId}",
     "name": "General Admission",
     "price": 50.00,
     "quantity": 1000
   }
   ```

### Scenario 3: Scanner Check-In

1. **Login as scanner**
   ```bash
   POST /api/v1/auth/login
   {
     "email": "scanner@venue.com",
     "password": "Password123!"
   }
   ```

2. **Scan ticket**
   ```bash
   POST /api/v1/scanners/{scannerId}/scan
   {
     "barcode": "{ticketBarcode}"
   }
   ```

## Data Summary

After running the default seed (`npm run db:seed`):

- **Users**: 15 total
  - 2 Admins
  - 5 Promoters
  - 8 Customers
  - 2 Scanners

- **Organizations**: 6 total
  - 3 Promoters (Starlight Events, Underground Productions, Champions Sports)
  - 2 Venues (The Grand Theater, Metro Convention Center)
  - 1 Reseller (TicketHub Resale)

- **Venues**: 10 venues across 6 cities
  - 3 large capacity (10,000+)
  - 4 medium capacity (1,000-10,000)
  - 3 small capacity (<1,000)

- **Events**: 25 events
  - 40% ON_SALE
  - 20% PUBLISHED
  - 15% SOLD_OUT
  - 10% COMPLETED
  - 10% DRAFT
  - 5% CANCELLED

- **Ticket Types**: ~75 types (avg 3 per event)
  - General Admission, VIP, Early Bird, Student discounts

- **Orders**: 40 orders
  - 70% PAID
  - 15% PENDING
  - 10% CANCELLED
  - 5% REFUNDED

- **Promo Codes**: 15 codes
  - 60% active
  - 20% expired
  - 10% disabled
  - 10% event-specific

## Customization

### Environment Variables

Control seed behavior via `.env`:

```bash
SEED_CLEAN=true              # Clean database before seeding
SEED_MODE=full               # minimal | default | full
SEED_USER_COUNT=20           # Override default user count
SEED_EVENT_COUNT=50          # Override default event count
```

### Seed Modes

**Minimal** (`npm run db:seed:minimal`): 5 events, 10 orders
**Default** (`npm run db:seed`): 25 events, 40 orders
**Full** (`npm run db:seed:full`): 50 events, 100 orders

## Troubleshooting

### Error: "Unique constraint violation"

The database already has data. Run with clean flag:
```bash
npm run db:seed:clean
```

### Error: "Foreign key constraint failed"

Dependencies are missing. Run a full reset:
```bash
npm run db:reset
```

### Slow seed performance

Use minimal mode for faster seeding:
```bash
npm run db:seed:minimal
```

## Maintenance

The seed script should be updated:
- **Monthly**: Update event dates to keep them future-dated
- **Per schema change**: Update factories and seeders
- **Per release**: Test seed script in production-like environment
```

### 7.2 Update Main README

Add section to `README.md`:

```markdown
## Demo Data

To quickly populate the database with realistic demo data for development and testing:

```bash
# Seed the database with demo data
npm run db:seed

# Or start completely fresh
npm run db:reset
```

Demo credentials and scenarios are documented in [Demo Data Guide](./docs/DEMO_DATA.md).
```

### 7.3 API Documentation Updates

Update Swagger documentation to mention demo data availability:

```typescript
// src/config/swagger.ts
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Tixmo API',
    version: '1.0.0',
    description: `
      Enterprise ticketing platform API.

      ## Demo Data
      This API includes comprehensive demo data. See the Demo Data Guide for credentials.

      Quick start:
      - Admin: admin@tixmo.com / Password123!
      - Customer: customer1@example.com / Password123!
    `
  },
  // ...
};
```

---

## Phase 8: Advanced Features (Days 12-14)

### 8.1 Incremental Seeding

Allow seeding individual modules without recreating everything:

```typescript
// Update prisma/seed.ts
const skipExisting = process.env.SEED_SKIP_EXISTING === 'true';

async function main() {
  if (skipExisting) {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      seedLogger.info('Skipping users (already exist)');
      // Load existing users instead of creating new ones
      const users = await prisma.user.findMany();
      // Continue with other seeders...
    }
  }
}
```

### 8.2 Seed from External Data

Support importing from CSV/JSON files:

**File: `prisma/utils/import-seed.ts`**

```typescript
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

export async function importFromCSV(
  prisma: PrismaClient,
  filePath: string,
  model: string
) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  for (const record of records) {
    await (prisma as any)[model].create({ data: record });
  }
}

// Usage:
// npm run db:seed:import -- --file=./data/users.csv --model=user
```

### 8.3 Seed Versioning

Track seed versions for reproducibility:

**Update `prisma/schema.prisma`:**

```prisma
model SeedVersion {
  id        String   @id @default(uuid())
  version   String   @unique
  mode      String   // minimal | default | full
  createdAt DateTime @default(now())
  metadata  Json?    // counts, config, etc.
}
```

**Update `prisma/seed.ts`:**

```typescript
// After successful seed
await prisma.seedVersion.create({
  data: {
    version: '1.0.0',
    mode: process.env.SEED_MODE || 'default',
    metadata: {
      userCount: users.length,
      eventCount: events.length,
      orderCount: orders.length,
    }
  }
});
```

### 8.4 Custom Seed Scenarios

Allow developers to define custom scenarios for specific testing needs:

**File: `prisma/scenarios/high-volume-sales.scenario.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export async function highVolumeSalesScenario(prisma: PrismaClient) {
  // Create scenario: major concert with high demand
  // - Event with 50,000 capacity
  // - 45,000 tickets sold (90% sold out)
  // - 5,000 orders (avg 9 tickets per order)
  // - Heavy load on specific date/time
  // - Multiple promo codes being used simultaneously
}
```

**File: `prisma/scenarios/cancelled-event.scenario.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export async function cancelledEventScenario(prisma: PrismaClient) {
  // Create scenario: event cancellation with refunds
  // - Event was ON_SALE, now CANCELLED
  // - All orders moved to REFUNDED status
  // - All tickets moved to CANCELLED status
  // - Notifications sent to all customers
}
```

**Usage:**

```bash
npm run db:seed:scenario -- --name=high-volume-sales
```

### 8.5 Seed Performance Optimization

For large datasets, implement batch operations:

```typescript
// Batch insert instead of sequential
const userData = await Promise.all(
  Array.from({ length: 100 }, () => createUserData())
);

await prisma.user.createMany({
  data: userData,
  skipDuplicates: true
});
```

### 8.6 Seed Monitoring & Logging

Add detailed progress tracking:

```typescript
import cliProgress from 'cli-progress';

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

progressBar.start(totalSteps, 0);
// Update progress as seeders complete
progressBar.update(currentStep);
progressBar.stop();
```

---

## Success Metrics

### Immediate Success (Day 14)

- ✅ Seed script runs without errors on clean database
- ✅ All foreign key relationships are valid
- ✅ Data passes all validation checks
- ✅ API endpoints return seeded data correctly
- ✅ Demo credentials work for authentication
- ✅ Documentation is complete and accurate
- ✅ Integration tests pass with seeded data

### Long-term Success

- ✅ New developers can set up demo environment in <5 minutes
- ✅ Sales team uses seeded data effectively for demos
- ✅ QA team relies on seed data for manual testing
- ✅ Seed data stays updated as schema evolves
- ✅ Seed script runs in CI/CD pipeline successfully
- ✅ Performance remains acceptable (<60 seconds for full seed)

---

## Maintenance Plan

### Monthly Maintenance

- Update event dates to keep them future-dated (roll forward 30 days)
- Review pricing to match current market trends
- Add new event categories based on product evolution
- Update promo codes to keep some active, some expired

### Per Schema Change

- Update factories to include new required fields
- Add validation checks for new constraints
- Update seeders if new models are added
- Test seed script after migration

### Per Release

- Test seed script against production-like data volumes
- Verify backward compatibility with previous seed versions
- Update demo credentials if authentication changes
- Review and update documentation

### Annual Review

- Audit all demo data for realism and relevance
- Update personas based on product direction
- Refresh fixture data (addresses, event types, pricing)
- Performance optimization review

---

## Estimated Timeline

### Quick Start (5 days)
- **Day 1**: Infrastructure (factories, utilities)
- **Day 2**: Core seeders (users, orgs, venues, events)
- **Day 3**: Additional seeders (tickets, orders, promos)
- **Day 4**: Testing and validation
- **Day 5**: Documentation

### Comprehensive Implementation (14 days)
- **Phase 1** (Infrastructure): 2 days
- **Phase 2** (Scenarios): 1 day
- **Phase 3** (Implementation): 4 days
- **Phase 4** (Quality): 1 day
- **Phase 5** (CLI): 1 day
- **Phase 6** (Testing): 1 day
- **Phase 7** (Documentation): 1 day
- **Phase 8** (Advanced): 3 days

---

## Implementation Checklist

### Infrastructure
- [ ] Create `prisma/seeders/` directory
- [ ] Create `prisma/factories/` directory
- [ ] Create `prisma/fixtures/` directory
- [ ] Create `prisma/utils/` directory
- [ ] Install @faker-js/faker dependency
- [ ] Install chalk dependency
- [ ] Create seed logger utility
- [ ] Create cleanup utility
- [ ] Create validation utility

### Core Seeders
- [ ] Implement user seeder
- [ ] Implement organization seeder
- [ ] Implement venue seeder
- [ ] Implement event seeder
- [ ] Implement ticket type seeder
- [ ] Implement promo code seeder
- [ ] Implement order seeder
- [ ] Implement ticket seeder
- [ ] Implement scanner seeder
- [ ] Implement notification seeder

### Factories
- [ ] Create user factory
- [ ] Create organization factory
- [ ] Create venue factory
- [ ] Create event factory
- [ ] Create ticket type factory
- [ ] Create promo code factory
- [ ] Create order factory

### Fixtures
- [ ] Create addresses.json
- [ ] Create event-templates.json
- [ ] Create venue-templates.json
- [ ] Create pricing-strategies.json
- [ ] Create promo-templates.json

### Main Orchestrator
- [ ] Create prisma/seed.ts
- [ ] Implement dependency order
- [ ] Add progress logging
- [ ] Add summary output
- [ ] Add credential printing
- [ ] Add error handling

### Testing
- [ ] Implement automated validation
- [ ] Test minimal seed mode
- [ ] Test default seed mode
- [ ] Test full seed mode
- [ ] Test clean seed
- [ ] Manual testing checklist
- [ ] Integration test updates

### Documentation
- [ ] Create DEMO_DATA.md guide
- [ ] Update README.md
- [ ] Document all demo credentials
- [ ] Document usage scenarios
- [ ] Update API documentation
- [ ] Add troubleshooting section

### Configuration
- [ ] Update package.json scripts
- [ ] Add seed environment variables to .env.example
- [ ] Configure seed modes
- [ ] Set up CI/CD integration

### Advanced Features (Optional)
- [ ] Implement incremental seeding
- [ ] Add CSV import support
- [ ] Add seed versioning
- [ ] Create custom scenarios
- [ ] Add performance optimization
- [ ] Add progress bars

---

## Conclusion

This comprehensive plan provides a complete roadmap for implementing demo data for the Tixmo API. Following this plan will result in:

- **Realistic demo data** that accurately represents production use cases
- **Developer productivity** with fast, reliable database seeding
- **Sales enablement** with comprehensive demo scenarios
- **Testing support** with reproducible fixtures
- **Maintainability** with clear structure and documentation

The modular design allows for incremental implementation, starting with core functionality and expanding to advanced features as needed.