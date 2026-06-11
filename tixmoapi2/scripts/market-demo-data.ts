/* eslint-disable no-console */
import {
  ApprovalCommentVisibility,
  ApprovalDecision,
  ApprovalReviewerAssociation,
  ApprovalReviewerType,
  ApprovalStatus,
  DiscountType,
  EventStatus,
  NotificationStatus,
  NotificationType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PromoCodeStatus,
  ScannerStatus,
  TaskPriority,
  TaskStatus,
  TaskTag,
  TicketStatus,
  TicketTypeStatus,
  User,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEMO_ORG_SLUG = 'tixmo-market-demo';
const DEMO_PASSWORD = 'DemoPass123!';
const MARKET_DEMO_MAIN_SCANNER_KEY = 'sk_scanner_market_demo_main_gate';
const MARKET_DEMO_COMPLETED_SCANNER_KEY = 'sk_scanner_market_demo_founders_checkin';
const DEMO_USER_EMAILS = [
  'demo.admin@tixmo.test',
  'demo.manager@tixmo.test',
  'demo.ops@tixmo.test',
  'demo.scanner@tixmo.test',
  'demo.customer+maya@tixmo.test',
  'demo.customer+eli@tixmo.test',
  'demo.customer+nia@tixmo.test',
  'demo.customer+omar@tixmo.test',
  'demo.customer+jules@tixmo.test',
  'demo.customer+sam@tixmo.test',
  'demo.customer+alex@tixmo.test',
  'demo.customer+ren@tixmo.test',
  'demo.customer+taylor@tixmo.test',
  'demo.customer+casey@tixmo.test',
  'demo.customer+morgan@tixmo.test',
  'demo.customer+riley@tixmo.test',
];

type DemoCommand = 'seed' | 'reset' | 'verify';
type DemoUserMap = Record<'admin' | 'manager' | 'ops' | 'scanner', User>;
type TicketTypeMap = Record<string, { id: string; name: string; price: Prisma.Decimal }>;

function daysFromNow(days: number, hour = 19) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function hoursFrom(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function tokenHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isProductionLikeDatabase(databaseUrl: string) {
  const lower = databaseUrl.toLowerCase();
  const localMarkers = [
    'localhost',
    '127.0.0.1',
    'host.docker.internal',
    'tixmo_dev',
    'tixmo_test',
    'project_tixmo',
  ];

  return !localMarkers.some((marker) => lower.includes(marker));
}

function assertSafeToRun(command: DemoCommand) {
  const allowProduction = process.env.ALLOW_MARKET_DEMO_DATA_IN_PRODUCTION === 'true';
  const databaseUrl = process.env.DATABASE_URL || '';

  if (process.env.NODE_ENV === 'production' && !allowProduction) {
    throw new Error(
      `Refusing to ${command} market demo data with NODE_ENV=production. Set ALLOW_MARKET_DEMO_DATA_IN_PRODUCTION=true only for an intentional scoped demo seed.`
    );
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before running the market demo data script.');
  }

  if (isProductionLikeDatabase(databaseUrl) && !allowProduction) {
    throw new Error(
      `Refusing to ${command} market demo data against a non-local DATABASE_URL. Set ALLOW_MARKET_DEMO_DATA_IN_PRODUCTION=true only after confirming the target database.`
    );
  }
}

async function resetMarketDemo() {
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true },
  });

  if (!org) {
    await prisma.user.deleteMany({ where: { email: { in: DEMO_USER_EMAILS } } });
    return {
      organizationDeleted: false,
      usersDeleted: DEMO_USER_EMAILS.length,
    };
  }

  const events = await prisma.event.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const eventIds = events.map((event) => event.id);

  const orders = await prisma.order.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true, paymentIntentId: true },
  });
  const orderIds = orders.map((order) => order.id);
  const paymentIntentIds = orders
    .map((order) => order.paymentIntentId)
    .filter((paymentIntentId): paymentIntentId is string => Boolean(paymentIntentId));

  const tickets = await prisma.ticket.findMany({
    where: { OR: [{ eventId: { in: eventIds } }, { orderId: { in: orderIds } }] },
    select: { id: true },
  });
  const ticketIds = tickets.map((ticket) => ticket.id);

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true },
  });
  const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id);

  const scanners = await prisma.scanner.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const scannerIds = scanners.map((scanner) => scanner.id);

  const tasks = await prisma.task.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const taskIds = tasks.map((task) => task.id);

  const approvals = await prisma.approvalRequest.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const approvalIds = approvals.map((approval) => approval.id);

  const revisions = await prisma.approvalRevision.findMany({
    where: { approvalRequestId: { in: approvalIds } },
    select: { id: true },
  });
  const revisionIds = revisions.map((revision) => revision.id);

  const reviewers = await prisma.approvalReviewer.findMany({
    where: { approvalRequestId: { in: approvalIds } },
    select: { id: true },
  });
  const reviewerIds = reviewers.map((reviewer) => reviewer.id);

  const folders = await prisma.assetLibraryFolder.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const folderIds = folders.map((folder) => folder.id);

  const shares = await prisma.assetLibraryFolderShare.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const shareIds = shares.map((share) => share.id);

  await prisma.$transaction(
    async (tx) => {
      await tx.paymentWebhookEvent.deleteMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            { paymentIntentId: { in: paymentIntentIds } },
            { id: { startsWith: 'evt_market_demo_' } },
          ],
        },
      });

      await tx.scanLog.deleteMany({
        where: {
          OR: [
            { eventId: { in: eventIds } },
            { ticketId: { in: ticketIds } },
            { scannerId: { in: scannerIds } },
          ],
        },
      });
      await tx.scanner.deleteMany({ where: { organizationId: org.id } });

      await tx.assetLibraryFolderShareFolder.deleteMany({
        where: { OR: [{ shareId: { in: shareIds } }, { folderId: { in: folderIds } }] },
      });
      await tx.assetLibraryFolderShare.deleteMany({ where: { organizationId: org.id } });
      await tx.assetLibraryAsset.deleteMany({ where: { organizationId: org.id } });
      await tx.assetLibraryFolder.deleteMany({ where: { organizationId: org.id } });

      await tx.approvalComment.deleteMany({
        where: { OR: [{ approvalRequestId: { in: approvalIds } }, { approvalRevisionId: { in: revisionIds } }] },
      });
      await tx.approvalReviewDecision.deleteMany({
        where: {
          OR: [
            { approvalRequestId: { in: approvalIds } },
            { approvalRevisionId: { in: revisionIds } },
            { reviewerId: { in: reviewerIds } },
          ],
        },
      });
      await tx.approvalReminder.deleteMany({
        where: { OR: [{ approvalRevisionId: { in: revisionIds } }, { reviewerId: { in: reviewerIds } }] },
      });
      await tx.approvalAsset.deleteMany({ where: { approvalRevisionId: { in: revisionIds } } });
      await tx.approvalReviewer.deleteMany({ where: { approvalRequestId: { in: approvalIds } } });
      await tx.approvalRevision.deleteMany({ where: { approvalRequestId: { in: approvalIds } } });
      await tx.approvalRequest.deleteMany({ where: { organizationId: org.id } });

      await tx.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { organizationId: org.id } });

      await tx.waitlist.deleteMany({ where: { eventId: { in: eventIds } } });
      await tx.notification.deleteMany({ where: { user: { email: { in: DEMO_USER_EMAILS } } } });
      await tx.notificationPreference.deleteMany({ where: { user: { email: { in: DEMO_USER_EMAILS } } } });

      await tx.ticket.deleteMany({
        where: { OR: [{ eventId: { in: eventIds } }, { orderId: { in: orderIds } }, { id: { in: ticketIds } }] },
      });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });

      await tx.ticketTier.deleteMany({ where: { ticketTypeId: { in: ticketTypeIds } } });
      await tx.ticketType.deleteMany({ where: { id: { in: ticketTypeIds } } });
      await tx.promoCode.deleteMany({ where: { organizationId: org.id } });
      await tx.event.deleteMany({ where: { organizationId: org.id } });
      await tx.venue.deleteMany({ where: { organizationId: org.id } });
      await tx.user.deleteMany({
        where: { OR: [{ organizationId: org.id }, { email: { in: DEMO_USER_EMAILS } }] },
      });
      await tx.organization.delete({ where: { id: org.id } });
    },
    { maxWait: 30000, timeout: 60000 }
  );

  return {
    organizationDeleted: true,
    eventsDeleted: eventIds.length,
    ordersDeleted: orderIds.length,
    ticketsDeleted: ticketIds.length,
  };
}

async function createDemoUsers(tx: Prisma.TransactionClient, organizationId: string): Promise<DemoUserMap & { customers: User[] }> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await tx.user.create({
    data: {
      email: 'demo.admin@tixmo.test',
      passwordHash,
      firstName: 'Avery',
      lastName: 'Stone',
      title: 'Founder',
      role: UserRole.OWNER,
      organizationId,
      emailVerified: true,
      phone: '555-0101',
    },
  });

  const manager = await tx.user.create({
    data: {
      email: 'demo.manager@tixmo.test',
      passwordHash,
      firstName: 'Jordan',
      lastName: 'Vale',
      title: 'Marketing Lead',
      role: UserRole.MANAGER,
      organizationId,
      emailVerified: true,
      phone: '555-0102',
      permissions: {
        canManageEvents: true,
        canViewAnalytics: true,
        canManageOrders: true,
        canManageAssets: true,
      },
    },
  });

  const ops = await tx.user.create({
    data: {
      email: 'demo.ops@tixmo.test',
      passwordHash,
      firstName: 'Parker',
      lastName: 'Reed',
      title: 'Event Operations',
      role: UserRole.TEAM_MEMBER,
      organizationId,
      emailVerified: true,
      phone: '555-0103',
      permissions: {
        canManageEvents: true,
        canManageOrders: true,
        canManageScanners: true,
      },
    },
  });

  const scanner = await tx.user.create({
    data: {
      email: 'demo.scanner@tixmo.test',
      passwordHash,
      firstName: 'Quinn',
      lastName: 'Harper',
      title: 'Scanner Lead',
      role: UserRole.SCANNER,
      organizationId,
      emailVerified: true,
      phone: '555-0104',
    },
  });

  const customerNames = [
    ['Maya', 'Lopez'],
    ['Eli', 'Grant'],
    ['Nia', 'Brooks'],
    ['Omar', 'Kim'],
    ['Jules', 'Carter'],
    ['Sam', 'Nguyen'],
    ['Alex', 'Patel'],
    ['Ren', 'Morgan'],
    ['Taylor', 'West'],
    ['Casey', 'Lane'],
    ['Morgan', 'Drew'],
    ['Riley', 'Cole'],
  ];

  const customers: User[] = [];
  for (let index = 0; index < customerNames.length; index += 1) {
    const [firstName, lastName] = customerNames[index];
    const email = DEMO_USER_EMAILS[index + 4];
    customers.push(
      await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: UserRole.CUSTOMER,
          emailVerified: index < 10,
          phone: `555-02${String(index).padStart(2, '0')}`,
        },
      })
    );
  }

  await tx.notificationPreference.createMany({
    data: [admin, manager, ops, scanner].map((user) => ({
      userId: user.id,
      emailOrderConfirm: true,
      emailTicketTransfer: true,
      emailEventReminder: true,
      emailPromo: false,
      emailAnnouncement: true,
      smsOrderConfirm: false,
      smsEventReminder: false,
    })),
  });

  return { admin, manager, ops, scanner, customers };
}

async function createTicketType(
  tx: Prisma.TransactionClient,
  eventId: string,
  input: {
    name: string;
    description: string;
    price: number;
    quantityTotal: number;
    maxPerOrder: number;
    sortOrder: number;
    salesStart: Date;
    salesEnd: Date;
  }
) {
  const ticketType = await tx.ticketType.create({
    data: {
      eventId,
      name: input.name,
      description: input.description,
      price: input.price,
      quantityTotal: input.quantityTotal,
      quantityAvailable: input.quantityTotal,
      quantitySold: 0,
      quantityHeld: 0,
      salesStart: input.salesStart,
      salesEnd: input.salesEnd,
      maxPerOrder: input.maxPerOrder,
      sortOrder: input.sortOrder,
      status: TicketTypeStatus.ACTIVE,
    },
  });

  if (input.name === 'VIP Table') {
    await tx.ticketTier.createMany({
      data: [
        {
          ticketTypeId: ticketType.id,
          name: 'VIP Standard',
          price: input.price,
          quantityLimit: 30,
          quantitySold: 0,
          sortOrder: 0,
          isActive: true,
        },
        {
          ticketTypeId: ticketType.id,
          name: 'VIP Last Call',
          price: input.price + 25,
          quantityLimit: 20,
          quantitySold: 0,
          sortOrder: 1,
          isActive: true,
        },
      ],
    });
  }

  return ticketType;
}

async function createPaidOrder(
  tx: Prisma.TransactionClient,
  input: {
    orderIndex: number;
    eventId: string;
    customerId: string;
    createdAt: Date;
    items: Array<{ ticketType: { id: string; name: string; price: Prisma.Decimal }; quantity: number }>;
    promoCodeId?: string;
    discountRate?: number;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
  }
) {
  const subtotal = input.items.reduce(
    (sum, item) => sum + Number(item.ticketType.price) * item.quantity,
    0
  );
  const discount = subtotal * (input.discountRate || 0);
  const fees = subtotal * 0.085;
  const tax = Math.max(subtotal - discount, 0) * 0.07;
  const total = subtotal + fees + tax - discount;
  const isPaid = (input.status || OrderStatus.PAID) === OrderStatus.PAID;
  const paymentIntentId = isPaid ? `pi_market_demo_${String(input.orderIndex).padStart(4, '0')}` : null;

  const order = await tx.order.create({
    data: {
      orderNumber: `MKT-DEMO-${String(input.orderIndex).padStart(5, '0')}`,
      userId: input.customerId,
      eventId: input.eventId,
      status: input.status || OrderStatus.PAID,
      totalAmount: money(total),
      feesAmount: money(fees),
      taxAmount: money(tax),
      discountAmount: money(discount),
      paymentStatus: input.paymentStatus || (isPaid ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING),
      paymentIntentId,
      paymentMethod: isPaid ? 'card' : null,
      promoCodeId: input.promoCodeId || null,
      ipAddress: `192.0.2.${input.orderIndex}`,
      userAgent: 'Tixmo market demo seed',
      expiresAt: isPaid ? null : addDays(input.createdAt, 1),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
  });

  if (isPaid && paymentIntentId) {
    await tx.paymentWebhookEvent.create({
      data: {
        id: `evt_market_demo_${String(input.orderIndex).padStart(4, '0')}`,
        type: 'payment_intent.succeeded',
        paymentIntentId,
        orderId: order.id,
        status: 'PROCESSED',
        processingStartedAt: input.createdAt,
        processedAt: input.createdAt,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      },
    });
  }

  if (!isPaid) {
    return { order, ticketIds: [] };
  }

  const ticketIds: string[] = [];
  let ticketIndex = 1;
  for (const item of input.items) {
    for (let count = 0; count < item.quantity; count += 1) {
      const ticket = await tx.ticket.create({
        data: {
          orderId: order.id,
          eventId: input.eventId,
          ticketTypeId: item.ticketType.id,
          userId: input.customerId,
          barcode: `MKT-${String(input.orderIndex).padStart(5, '0')}-${String(ticketIndex).padStart(2, '0')}`,
          qrCodeUrl: `https://demo.tixmo.test/qr/MKT-${String(input.orderIndex).padStart(5, '0')}-${String(ticketIndex).padStart(2, '0')}`,
          status: TicketStatus.VALID,
          pricePaid: item.ticketType.price,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
      });
      ticketIds.push(ticket.id);
      ticketIndex += 1;
    }

    await tx.ticketType.update({
      where: { id: item.ticketType.id },
      data: {
        quantitySold: { increment: item.quantity },
        quantityAvailable: { decrement: item.quantity },
      },
    });
  }

  return { order, ticketIds };
}

async function seedMarketDemo() {
  const summary = await prisma.$transaction(
    async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: 'Tixmo Market Demo',
          slug: DEMO_ORG_SLUG,
          type: 'PROMOTER',
          status: 'ACTIVE',
          settings: {
            currency: 'USD',
            timezone: 'America/New_York',
            demoData: true,
            resetCommand: 'npm --prefix tixmoapi2 run demo:market:reseed',
          },
        },
      });

      const users = await createDemoUsers(tx, org.id);

      const venue = await tx.venue.create({
        data: {
          organizationId: org.id,
          name: 'Pier 17 Rooftop',
          address: {
            street: '89 South Street',
            city: 'New York',
            state: 'NY',
            zip: '10038',
            country: 'USA',
          },
          capacity: 3200,
          timezone: 'America/New_York',
          metadata: {
            demoData: true,
            doors: '6:30 PM',
            notes: 'Waterfront outdoor venue with VIP deck and two entry gates.',
          },
        },
      });

      const warehouse = await tx.venue.create({
        data: {
          organizationId: org.id,
          name: 'Foundry Hall',
          address: {
            street: '410 Market Avenue',
            city: 'Brooklyn',
            state: 'NY',
            zip: '11222',
            country: 'USA',
          },
          capacity: 1200,
          timezone: 'America/New_York',
          metadata: {
            demoData: true,
            doors: '8:00 PM',
          },
        },
      });

      const harborStart = daysFromNow(24, 20);
      const afterglowStart = daysFromNow(46, 22);
      const showcaseStart = daysFromNow(-12, 19);
      const previewStart = daysFromNow(72, 18);

      const events = {
        harbor: await tx.event.create({
          data: {
            organizationId: org.id,
            venueId: venue.id,
            name: 'Harborlight Summer Session',
            slug: 'market-demo-harborlight-summer-session',
            description:
              'A high-energy waterfront concert used for the Tixmo market demo. Includes active sales, VIP packages, scanner setup, approvals, and asset sharing.',
            category: 'CONCERT',
            tags: ['demo', 'concert', 'waterfront'],
            startDatetime: harborStart,
            endDatetime: hoursFrom(harborStart, 4),
            timezone: 'America/New_York',
            status: EventStatus.ON_SALE,
            images: {
              hero: 'https://assets.tixmo.test/demo/harborlight-hero.jpg',
              poster: 'https://assets.tixmo.test/demo/harborlight-poster.jpg',
            },
            metadata: { demoData: true, runOfShowStatus: 'ready' },
            salesStart: addDays(harborStart, -60),
            salesEnd: addDays(harborStart, -1),
            capacity: 3200,
            minTicketPrice: 49,
            maxTicketPrice: 225,
          },
        }),
        afterglow: await tx.event.create({
          data: {
            organizationId: org.id,
            venueId: warehouse.id,
            name: 'Afterglow Warehouse',
            slug: 'market-demo-afterglow-warehouse',
            description: 'Late-night electronic showcase with steady sales and a smaller inventory profile.',
            category: 'CONCERT',
            tags: ['demo', 'electronic', 'late-night'],
            startDatetime: afterglowStart,
            endDatetime: hoursFrom(afterglowStart, 5),
            timezone: 'America/New_York',
            status: EventStatus.ON_SALE,
            metadata: { demoData: true, runOfShowStatus: 'in-progress' },
            salesStart: addDays(afterglowStart, -45),
            salesEnd: addDays(afterglowStart, -1),
            capacity: 1200,
            minTicketPrice: 39,
            maxTicketPrice: 125,
          },
        }),
        showcase: await tx.event.create({
          data: {
            organizationId: org.id,
            venueId: warehouse.id,
            name: 'Founders Circle Showcase',
            slug: 'market-demo-founders-circle-showcase',
            description: 'Completed demo event with checked-in tickets and scan logs for attendance reporting.',
            category: 'PRIVATE_EVENT',
            tags: ['demo', 'completed', 'vip'],
            startDatetime: showcaseStart,
            endDatetime: hoursFrom(showcaseStart, 3),
            timezone: 'America/New_York',
            status: EventStatus.COMPLETED,
            metadata: { demoData: true, settlementStatus: 'reviewed' },
            salesStart: addDays(showcaseStart, -45),
            salesEnd: addDays(showcaseStart, -1),
            capacity: 450,
            minTicketPrice: 95,
            maxTicketPrice: 185,
          },
        }),
        preview: await tx.event.create({
          data: {
            organizationId: org.id,
            venueId: venue.id,
            name: 'Sponsor Preview Night',
            slug: 'market-demo-sponsor-preview-night',
            description: 'Published future event with no sales yet for pipeline and planning views.',
            category: 'SPECIAL_EVENT',
            tags: ['demo', 'sponsor', 'planning'],
            startDatetime: previewStart,
            endDatetime: hoursFrom(previewStart, 3),
            timezone: 'America/New_York',
            status: EventStatus.PUBLISHED,
            metadata: { demoData: true, launchChecklist: ['copy', 'assets', 'ticket tiers'] },
            salesStart: addDays(previewStart, 14),
            salesEnd: addDays(previewStart, -1),
            capacity: 650,
            minTicketPrice: 75,
            maxTicketPrice: 150,
          },
        }),
      };

      const ticketTypesByEvent: Record<string, TicketTypeMap> = {};
      for (const event of [events.harbor, events.afterglow, events.showcase]) {
        const salesStart = event.salesStart || addDays(new Date(), -14);
        const salesEnd = event.salesEnd || addDays(new Date(), 14);
        const configs =
          event.id === events.harbor.id
            ? [
                ['General Admission', 'Standing room waterfront access', 49, 1800, 8],
                ['VIP Table', 'Reserved VIP deck table with host check-in', 225, 160, 4],
                ['Group Pack', 'Four-ticket bundle for teams and partners', 160, 300, 3],
              ]
            : event.id === events.afterglow.id
              ? [
                  ['General Admission', 'Late-night floor access', 39, 900, 8],
                  ['VIP Table', 'Balcony table and priority entry', 125, 80, 4],
                ]
              : [
                  ['Showcase Pass', 'Founder showcase admission', 95, 350, 6],
                  ['Patron Seat', 'Reserved patron seating', 185, 100, 4],
                ];

        ticketTypesByEvent[event.id] = {};
        for (let index = 0; index < configs.length; index += 1) {
          const [name, description, price, quantityTotal, maxPerOrder] = configs[index] as [
            string,
            string,
            number,
            number,
            number,
          ];
          const ticketType = await createTicketType(tx, event.id, {
            name,
            description,
            price,
            quantityTotal,
            maxPerOrder,
            sortOrder: index,
            salesStart,
            salesEnd,
          });
          ticketTypesByEvent[event.id][name] = ticketType;
        }
      }

      const promo = await tx.promoCode.create({
        data: {
          organizationId: org.id,
          code: 'MARKETDEMO15',
          description: 'Sales-demo promo code for walkthroughs.',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
          maxUses: 250,
          usesCount: 4,
          validFrom: addDays(new Date(), -30),
          validUntil: addDays(new Date(), 90),
          applicableEvents: [events.harbor.id, events.afterglow.id],
          minOrderValue: 75,
          status: PromoCodeStatus.ACTIVE,
        },
      });

      let orderIndex = 1;
      const allTicketIds: string[] = [];
      const completedTicketIds: string[] = [];

      const paidOrderPlans = [
        {
          eventId: events.harbor.id,
          ticketTypes: ticketTypesByEvent[events.harbor.id],
          customerOffset: 0,
          dayOffset: -16,
          items: [
            ['General Admission', 2],
            ['VIP Table', 1],
          ],
          discountRate: 0.15,
        },
        {
          eventId: events.harbor.id,
          ticketTypes: ticketTypesByEvent[events.harbor.id],
          customerOffset: 1,
          dayOffset: -13,
          items: [['Group Pack', 2]],
        },
        {
          eventId: events.harbor.id,
          ticketTypes: ticketTypesByEvent[events.harbor.id],
          customerOffset: 2,
          dayOffset: -10,
          items: [['General Admission', 4]],
        },
        {
          eventId: events.harbor.id,
          ticketTypes: ticketTypesByEvent[events.harbor.id],
          customerOffset: 3,
          dayOffset: -7,
          items: [
            ['General Admission', 2],
            ['Group Pack', 1],
          ],
        },
        {
          eventId: events.harbor.id,
          ticketTypes: ticketTypesByEvent[events.harbor.id],
          customerOffset: 4,
          dayOffset: -3,
          items: [['VIP Table', 2]],
        },
        {
          eventId: events.afterglow.id,
          ticketTypes: ticketTypesByEvent[events.afterglow.id],
          customerOffset: 5,
          dayOffset: -12,
          items: [['General Admission', 3]],
        },
        {
          eventId: events.afterglow.id,
          ticketTypes: ticketTypesByEvent[events.afterglow.id],
          customerOffset: 6,
          dayOffset: -8,
          items: [
            ['General Admission', 2],
            ['VIP Table', 1],
          ],
          discountRate: 0.15,
        },
        {
          eventId: events.afterglow.id,
          ticketTypes: ticketTypesByEvent[events.afterglow.id],
          customerOffset: 7,
          dayOffset: -2,
          items: [['General Admission', 5]],
        },
        {
          eventId: events.showcase.id,
          ticketTypes: ticketTypesByEvent[events.showcase.id],
          customerOffset: 8,
          dayOffset: -32,
          items: [
            ['Showcase Pass', 2],
            ['Patron Seat', 1],
          ],
        },
        {
          eventId: events.showcase.id,
          ticketTypes: ticketTypesByEvent[events.showcase.id],
          customerOffset: 9,
          dayOffset: -28,
          items: [['Showcase Pass', 3]],
        },
        {
          eventId: events.showcase.id,
          ticketTypes: ticketTypesByEvent[events.showcase.id],
          customerOffset: 10,
          dayOffset: -21,
          items: [['Patron Seat', 2]],
        },
        {
          eventId: events.showcase.id,
          ticketTypes: ticketTypesByEvent[events.showcase.id],
          customerOffset: 11,
          dayOffset: -18,
          items: [['Showcase Pass', 4]],
        },
      ];

      for (const plan of paidOrderPlans) {
        const result = await createPaidOrder(tx, {
          orderIndex,
          eventId: plan.eventId,
          customerId: users.customers[plan.customerOffset].id,
          createdAt: daysFromNow(plan.dayOffset, 14 + (orderIndex % 6)),
          items: plan.items.map(([ticketTypeName, quantity]) => ({
            ticketType: plan.ticketTypes[ticketTypeName as string],
            quantity: quantity as number,
          })),
          promoCodeId: plan.discountRate ? promo.id : undefined,
          discountRate: plan.discountRate,
        });
        allTicketIds.push(...result.ticketIds);
        if (plan.eventId === events.showcase.id) completedTicketIds.push(...result.ticketIds);
        orderIndex += 1;
      }

      await createPaidOrder(tx, {
        orderIndex,
        eventId: events.harbor.id,
        customerId: users.customers[2].id,
        createdAt: daysFromNow(-1, 12),
        items: [{ ticketType: ticketTypesByEvent[events.harbor.id]['General Admission'], quantity: 2 }],
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
      });

      const mainScanner = await tx.scanner.create({
        data: {
          organizationId: org.id,
          eventId: events.harbor.id,
          name: 'Harborlight Main Gate',
          deviceId: 'market-demo-main-gate',
          apiKey: MARKET_DEMO_MAIN_SCANNER_KEY,
          createdBy: users.ops.id,
          status: ScannerStatus.ACTIVE,
          lastUsedAt: daysFromNow(-1, 16),
        },
      });

      const completedScanner = await tx.scanner.create({
        data: {
          organizationId: org.id,
          eventId: events.showcase.id,
          name: 'Founders Circle Check-In',
          deviceId: 'market-demo-founders-checkin',
          apiKey: MARKET_DEMO_COMPLETED_SCANNER_KEY,
          createdBy: users.ops.id,
          status: ScannerStatus.ACTIVE,
          lastUsedAt: showcaseStart,
        },
      });

      const scannedTickets = completedTicketIds.slice(0, 9);
      for (let index = 0; index < scannedTickets.length; index += 1) {
        const scannedAt = new Date(showcaseStart.getTime() - (45 - index * 5) * 60 * 1000);
        await tx.scanLog.create({
          data: {
            scannerId: completedScanner.id,
            ticketId: scannedTickets[index],
            eventId: events.showcase.id,
            scanType: 'ENTRY',
            success: true,
            metadata: { lane: index % 2 === 0 ? 'main' : 'vip', demoData: true },
            scannedAt,
          },
        });
        await tx.ticket.update({
          where: { id: scannedTickets[index] },
          data: {
            status: TicketStatus.USED,
            checkedInAt: scannedAt,
            checkedInBy: completedScanner.id,
          },
        });
      }

      const brandFolder = await tx.assetLibraryFolder.create({
        data: {
          organizationId: org.id,
          eventId: null,
          createdById: users.manager.id,
          name: 'Brand Kit',
          category: 'Brand',
          usageType: 'BRAND',
        },
      });

      const eventFolder = await tx.assetLibraryFolder.create({
        data: {
          organizationId: org.id,
          parentId: brandFolder.id,
          eventId: events.harbor.id,
          createdById: users.manager.id,
          name: 'Harborlight Launch Assets',
          category: 'Event Marketing',
          usageType: 'EVENT',
        },
      });

      await tx.assetLibraryAsset.createMany({
        data: [
          {
            organizationId: org.id,
            folderId: brandFolder.id,
            eventId: null,
            uploadedById: users.manager.id,
            filename: 'tixmo-market-demo-logo.png',
            originalName: 'Tixmo Market Demo Logo.png',
            mimeType: 'image/png',
            size: 284000,
            s3Key: 'demo/market-demo/logo.png',
            s3Url: 'https://assets.tixmo.test/demo/market-demo/logo.png',
            category: 'Logo',
            usageType: 'BRAND',
          },
          {
            organizationId: org.id,
            folderId: eventFolder.id,
            eventId: events.harbor.id,
            uploadedById: users.manager.id,
            filename: 'harborlight-poster-v3.png',
            originalName: 'Harborlight Poster v3.png',
            mimeType: 'image/png',
            size: 924000,
            s3Key: 'demo/market-demo/harborlight-poster-v3.png',
            s3Url: 'https://assets.tixmo.test/demo/market-demo/harborlight-poster-v3.png',
            category: 'Poster',
            usageType: 'EVENT',
          },
          {
            organizationId: org.id,
            folderId: eventFolder.id,
            eventId: events.harbor.id,
            uploadedById: users.manager.id,
            filename: 'harborlight-social-pack.zip',
            originalName: 'Harborlight Social Pack.zip',
            mimeType: 'application/zip',
            size: 3480000,
            s3Key: 'demo/market-demo/harborlight-social-pack.zip',
            s3Url: 'https://assets.tixmo.test/demo/market-demo/harborlight-social-pack.zip',
            category: 'Social',
            usageType: 'EVENT',
          },
        ],
      });

      const share = await tx.assetLibraryFolderShare.create({
        data: {
          organizationId: org.id,
          folderId: eventFolder.id,
          createdById: users.manager.id,
          tokenHash: tokenHash('market-demo-share-token'),
          tokenCiphertext: 'market-demo-share-token-ciphertext',
          recipientLabel: 'Sponsor preview deck',
          expiresAt: addDays(new Date(), 21),
          lastViewedAt: addDays(new Date(), -1),
          viewCount: 3,
        },
      });

      await tx.assetLibraryFolderShareFolder.create({
        data: {
          shareId: share.id,
          folderId: brandFolder.id,
        },
      });

      const approval = await tx.approvalRequest.create({
        data: {
          organizationId: org.id,
          eventId: events.harbor.id,
          createdById: users.manager.id,
          title: 'Harborlight campaign artwork',
          description: 'External artist and sponsor review for the launch poster and social cutdowns.',
          status: ApprovalStatus.CHANGES_REQUESTED,
          deadline: addDays(new Date(), 5),
          latestRevisionNumber: 2,
          submittedAt: addDays(new Date(), -4),
          lastCommentAt: addDays(new Date(), -1),
        },
      });

      const revision = await tx.approvalRevision.create({
        data: {
          approvalRequestId: approval.id,
          revisionNumber: 2,
          summary: 'Updated sponsor placement and resized headline for mobile crops.',
          uploadedById: users.manager.id,
          createdAt: addDays(new Date(), -2),
        },
      });

      const approvalAsset = await tx.approvalAsset.create({
        data: {
          approvalRevisionId: revision.id,
          filename: 'harborlight-campaign-v2.png',
          originalName: 'Harborlight Campaign v2.png',
          mimeType: 'image/png',
          size: 1184000,
          s3Key: 'demo/approvals/harborlight-campaign-v2.png',
          s3Url: 'https://assets.tixmo.test/demo/approvals/harborlight-campaign-v2.png',
        },
      });

      const reviewer = await tx.approvalReviewer.create({
        data: {
          approvalRequestId: approval.id,
          email: 'artist.manager@example.test',
          name: 'Rae Artist Management',
          reviewerType: ApprovalReviewerType.EXTERNAL,
          association: ApprovalReviewerAssociation.MANAGEMENT,
          token: 'market-demo-approval-token',
          tokenExpiresAt: addDays(new Date(), 10),
          firstViewedAt: addDays(new Date(), -2),
          lastViewedAt: addDays(new Date(), -1),
          lastCommentAt: addDays(new Date(), -1),
          lastInteractionAt: addDays(new Date(), -1),
          lastInteractionRevisionNumber: 2,
        },
      });

      await tx.approvalComment.create({
        data: {
          approvalRequestId: approval.id,
          approvalRevisionId: revision.id,
          reviewerId: reviewer.id,
          visibility: ApprovalCommentVisibility.GLOBAL,
          content: 'Please increase the artist logo contrast on the mobile story crop.',
          createdAt: addDays(new Date(), -1),
        },
      });

      await tx.approvalReviewDecision.create({
        data: {
          approvalRequestId: approval.id,
          approvalRevisionId: revision.id,
          reviewerId: reviewer.id,
          decision: ApprovalDecision.CHANGES_REQUESTED,
          note: 'Approved directionally after contrast update.',
          createdAt: addDays(new Date(), -1),
        },
      });

      const tasks = await tx.task.createMany({
        data: [
          {
            organizationId: org.id,
            assigneeId: users.ops.id,
            title: 'Confirm Harborlight scanner stations',
            description: 'Validate device assignments and offline sync before field test.',
            status: TaskStatus.IN_PROGRESS,
            priority: TaskPriority.HIGH,
            tag: TaskTag.OPS,
            dueDate: addDays(new Date(), 3),
          },
          {
            organizationId: org.id,
            assigneeId: users.manager.id,
            title: 'Send sponsor asset share',
            description: 'Share launch artwork folder after final approval update.',
            status: TaskStatus.REVIEW,
            priority: TaskPriority.MEDIUM,
            tag: TaskTag.MARKETING,
            dueDate: addDays(new Date(), 5),
          },
          {
            organizationId: org.id,
            assigneeId: users.admin.id,
            title: 'Review refund policy copy',
            description: 'Confirm customer-facing policy before public demo.',
            status: TaskStatus.TO_DO,
            priority: TaskPriority.HIGH,
            tag: TaskTag.LEGAL,
            dueDate: addDays(new Date(), 7),
          },
        ],
      });

      const taskForComment = await tx.task.findFirst({
        where: { organizationId: org.id, title: 'Confirm Harborlight scanner stations' },
        select: { id: true },
      });

      if (taskForComment) {
        await tx.taskComment.create({
          data: {
            taskId: taskForComment.id,
            userId: users.ops.id,
            content: 'Main gate device is paired. Need one more private-window scanner check.',
          },
        });
      }

      await tx.notification.createMany({
        data: [
          {
            userId: users.admin.id,
            type: NotificationType.ANNOUNCEMENT,
            status: NotificationStatus.READ,
            subject: 'Market demo org is ready',
            message: 'Sales, scanner, approval, and asset-share data are available for walkthroughs.',
            sentAt: addDays(new Date(), -1),
            readAt: new Date(),
          },
          {
            userId: users.ops.id,
            type: NotificationType.TASK_MENTION,
            status: NotificationStatus.SENT,
            subject: 'Scanner field test task assigned',
            message: 'Confirm scanner station setup before the external walkthrough.',
            sentAt: addDays(new Date(), -1),
          },
        ],
      });

      await tx.waitlist.createMany({
        data: users.customers.slice(0, 4).map((customer) => ({
          eventId: events.preview.id,
          userId: customer.id,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });

      const paidOrders = await tx.order.count({ where: { event: { organizationId: org.id }, status: OrderStatus.PAID } });
      const paidTickets = await tx.ticket.count({
        where: { event: { organizationId: org.id }, order: { status: OrderStatus.PAID } },
      });
      const revenue = await tx.order.aggregate({
        where: { event: { organizationId: org.id }, status: OrderStatus.PAID },
        _sum: { totalAmount: true },
      });

      return {
        organizationId: org.id,
        organizationSlug: org.slug,
        loginEmail: users.admin.email,
        loginPassword: DEMO_PASSWORD,
        events: Object.keys(events).length,
        venues: 2,
        paidOrders,
        paidTickets,
        scanners: 2,
        scanLogs: scannedTickets.length,
        assetFolders: 2,
        assetShareToken: 'market-demo-share-token',
        approvalReviewerToken: reviewer.token,
        approvalAssetId: approvalAsset.id,
        tasks: tasks.count,
        revenue: Number(revenue._sum.totalAmount || 0),
        harborScannerApiKey: mainScanner.apiKey,
      };
    },
    { maxWait: 30000, timeout: 60000 }
  );

  return summary;
}

async function verifyMarketDemo() {
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    throw new Error(`Market demo organization was not found: ${DEMO_ORG_SLUG}`);
  }

  const demoEvents = await prisma.event.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const eventIds = demoEvents.map((event) => event.id);

  const [events, activeEvents, paidOrders, paidTickets, scanners, scanLogs, assetShares, approvals, tasks] =
    await Promise.all([
      prisma.event.count({ where: { organizationId: org.id } }),
      prisma.event.count({ where: { organizationId: org.id, status: { in: [EventStatus.PUBLISHED, EventStatus.ON_SALE] } } }),
      prisma.order.count({ where: { event: { organizationId: org.id }, status: OrderStatus.PAID } }),
      prisma.ticket.count({ where: { event: { organizationId: org.id }, order: { status: OrderStatus.PAID } } }),
      prisma.scanner.count({ where: { organizationId: org.id } }),
      prisma.scanLog.count({ where: { eventId: { in: eventIds } } }),
      prisma.assetLibraryFolderShare.count({ where: { organizationId: org.id, revokedAt: null } }),
      prisma.approvalRequest.count({ where: { organizationId: org.id } }),
      prisma.task.count({ where: { organizationId: org.id } }),
    ]);

  const revenue = await prisma.order.aggregate({
    where: { event: { organizationId: org.id }, status: OrderStatus.PAID },
    _sum: { totalAmount: true },
  });

  const expectations = [
    [events >= 4, 'expected at least 4 demo events'],
    [activeEvents >= 3, 'expected at least 3 active/published demo events'],
    [paidOrders >= 10, 'expected at least 10 paid demo orders'],
    [paidTickets >= 25, 'expected at least 25 paid demo tickets'],
    [scanners >= 2, 'expected scanner setup data'],
    [scanLogs >= 5, 'expected completed-event scan logs'],
    [assetShares >= 1, 'expected an active asset folder share'],
    [approvals >= 1, 'expected an approval request'],
    [tasks >= 3, 'expected operator tasks'],
  ] as const;

  for (const [passed, message] of expectations) {
    if (!passed) throw new Error(`Market demo verification failed: ${message}`);
  }

  return {
    organization: org.name,
    slug: org.slug,
    events,
    activeEvents,
    paidOrders,
    paidTickets,
    revenue: Number(revenue._sum.totalAmount || 0),
    scanners,
    scanLogs,
    assetShares,
    approvals,
    tasks,
  };
}

function printObject(title: string, value: Record<string, unknown>) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  for (const [key, entry] of Object.entries(value)) {
    console.log(`${key.padEnd(24)} ${entry}`);
  }
}

async function main() {
  const command = (process.argv[2] || 'seed') as DemoCommand;
  const resetFirst = process.argv.includes('--reset');

  if (!['seed', 'reset', 'verify'].includes(command)) {
    console.log(`
Market Demo Data CLI

Usage:
  npm --prefix tixmoapi2 run demo:market          Reset and seed the market demo org
  npm --prefix tixmoapi2 run demo:market:reset    Delete only the market demo org
  npm --prefix tixmoapi2 run demo:market:verify   Verify demo org counts

Environment guard:
  Refuses production or non-local DATABASE_URL unless ALLOW_MARKET_DEMO_DATA_IN_PRODUCTION=true.
`);
    process.exit(1);
  }

  assertSafeToRun(command);

  if (command === 'reset') {
    const result = await resetMarketDemo();
    printObject('Market demo reset', result);
    return;
  }

  if (command === 'verify') {
    const result = await verifyMarketDemo();
    printObject('Market demo verification', result);
    return;
  }

  const existing = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG }, select: { id: true } });
  if (existing && !resetFirst) {
    throw new Error(
      `Market demo org already exists. Re-run with --reset or use npm --prefix tixmoapi2 run demo:market:reseed.`
    );
  }

  if (resetFirst) {
    await resetMarketDemo();
  }

  const result = await seedMarketDemo();
  printObject('Market demo seeded', result);
  const verification = await verifyMarketDemo();
  printObject('Market demo verification', verification);
}

main()
  .catch((error) => {
    console.error('\nMarket demo data failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
