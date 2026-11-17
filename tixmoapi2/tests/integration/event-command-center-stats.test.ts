import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt';

type StaffRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER';
type DeniedRole = 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';

describe('Event Command Center stats HTTP', () => {
  const key = `ecc-stats-${randomUUID()}`;
  const statsPaths = (eventId: string) =>
    [
      `/api/v1/events/${eventId}/occupancy`,
      `/api/v1/events/${eventId}/timeline`,
      `/api/v1/events/${eventId}/scanner-stats`,
    ] as const;

  let organizationId = '';
  let otherOrganizationId = '';
  let eventId = '';
  let emptyEventId = '';
  let otherEventId = '';
  let ownerToken = '';
  let otherOwnerToken = '';
  let emptyOwnerToken = '';
  let roleTokens: Record<StaffRole | DeniedRole | 'ADMIN_GLOBAL', string> = {} as Record<
    StaffRole | DeniedRole | 'ADMIN_GLOBAL',
    string
  >;

  let doorAId = '';
  let doorBId = '';
  let doorCId = '';
  let roamingId = '';

  let tOld: Date;
  let tTwoHours: Date;
  let tOneHourEntry: Date;
  let tOneHourExit: Date;
  let tOneHourFail1: Date;
  let tOneHourFail2: Date;
  let tNowDoorC: Date;
  let tNowValidation: Date;
  let tNowRoaming: Date;
  let tNowRoamingFail: Date;

  const hourBucket = (value: Date) => {
    const hour = new Date(value);
    hour.setMinutes(0, 0, 0);
    return hour.toISOString();
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const tokenFor = (user: {
    id: string;
    email: string;
    role: string;
    organizationId: string | null;
  }) =>
    generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      sessionVersion: 0,
    });

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;
    const otherOrganization = await prisma.organization.create({
      data: { name: `${key}-other`, slug: `${key}-other`, type: 'PROMOTER' },
    });
    otherOrganizationId = otherOrganization.id;
    const emptyOrganization = await prisma.organization.create({
      data: { name: `${key}-empty`, slug: `${key}-empty`, type: 'PROMOTER' },
    });

    const owner = await prisma.user.create({
      data: {
        email: `${key}-owner@test.invalid`,
        passwordHash: 'synthetic',
        firstName: 'Event',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId,
      },
    });
    ownerToken = tokenFor(owner);

    const otherOwner = await prisma.user.create({
      data: {
        email: `${key}-other-owner@test.invalid`,
        passwordHash: 'synthetic',
        firstName: 'Other',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId: otherOrganizationId,
      },
    });
    otherOwnerToken = tokenFor(otherOwner);

    const emptyOwner = await prisma.user.create({
      data: {
        email: `${key}-empty-owner@test.invalid`,
        passwordHash: 'synthetic',
        firstName: 'Empty',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId: emptyOrganization.id,
      },
    });
    emptyOwnerToken = tokenFor(emptyOwner);

    const buyer = await prisma.user.create({
      data: {
        email: `${key}-buyer@test.invalid`,
        passwordHash: 'synthetic',
        firstName: 'Gate',
        lastName: 'Buyer',
        role: 'CUSTOMER',
      },
    });

    const createStaff = async (
      role: StaffRole | DeniedRole,
      extras: {
        isPlatformAdmin?: boolean;
        organizationId?: string | null;
        emailSuffix?: string;
      } = {}
    ) => {
      const user = await prisma.user.create({
        data: {
          email: `${key}-${role.toLowerCase()}${extras.emailSuffix ?? ''}@test.invalid`,
          passwordHash: 'synthetic',
          firstName: role,
          lastName: 'User',
          role,
          organizationId:
            extras.organizationId === undefined ? organizationId : extras.organizationId,
          isPlatformAdmin: extras.isPlatformAdmin ?? false,
        },
      });
      return tokenFor(user);
    };

    roleTokens = {
      OWNER: ownerToken,
      ADMIN: await createStaff('ADMIN', { isPlatformAdmin: false }),
      MANAGER: await createStaff('MANAGER'),
      PROMOTER: await createStaff('PROMOTER'),
      CUSTOMER: await createStaff('CUSTOMER'),
      SCANNER: await createStaff('SCANNER'),
      TEAM_MEMBER: await createStaff('TEAM_MEMBER'),
      ADMIN_GLOBAL: await createStaff('ADMIN', {
        isPlatformAdmin: true,
        organizationId: null,
        emailSuffix: '-global',
      }),
    };

    const event = await prisma.event.create({
      data: {
        organizationId,
        name: `${key}-live`,
        slug: `${key}-live`,
        status: 'ON_SALE',
        timezone: 'UTC',
        capacity: 50,
        startDatetime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        tags: [],
      },
    });
    eventId = event.id;

    const emptyEvent = await prisma.event.create({
      data: {
        organizationId: emptyOrganization.id,
        name: `${key}-empty`,
        slug: `${key}-empty`,
        status: 'PUBLISHED',
        timezone: 'UTC',
        capacity: 100,
        tags: [],
      },
    });
    emptyEventId = emptyEvent.id;

    const otherEvent = await prisma.event.create({
      data: {
        organizationId,
        name: `${key}-other-event`,
        slug: `${key}-other-event`,
        status: 'ON_SALE',
        timezone: 'UTC',
        capacity: 50,
        tags: [],
      },
    });
    otherEventId = otherEvent.id;

    const ga = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'GA',
        price: 20,
        quantityTotal: 20,
        quantityAvailable: 10,
      },
    });
    const vip = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'VIP',
        price: 40,
        quantityTotal: 10,
        quantityAvailable: 6,
      },
    });

    const paid = await prisma.order.create({
      data: {
        orderNumber: `${key}-paid`,
        userId: buyer.id,
        eventId,
        totalAmount: 200,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
      },
    });
    const refunded = await prisma.order.create({
      data: {
        orderNumber: `${key}-refunded`,
        userId: buyer.id,
        eventId,
        totalAmount: 20,
        currency: 'cad',
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    });
    const pending = await prisma.order.create({
      data: {
        orderNumber: `${key}-pending`,
        userId: buyer.id,
        eventId,
        totalAmount: 20,
        currency: 'cad',
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
    });
    const cancelledOrder = await prisma.order.create({
      data: {
        orderNumber: `${key}-cancelled`,
        userId: buyer.id,
        eventId,
        totalAmount: 40,
        currency: 'cad',
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
      },
    });

    const ticket = (
      label: string,
      ticketTypeId: string,
      orderId: string,
      status: 'VALID' | 'USED' | 'CANCELLED' | 'TRANSFERRED',
      inventoryState: 'SOLD' | 'HELD' | 'RELEASED'
    ) =>
      prisma.ticket.create({
        data: {
          orderId,
          eventId,
          ticketTypeId,
          userId: buyer.id,
          barcode: `${key}-${label}`,
          pricePaid: ticketTypeId === vip.id ? 40 : 20,
          status,
          inventoryState,
        },
      });

    await Promise.all([
      ticket('ga-valid-1', ga.id, paid.id, 'VALID', 'SOLD'),
      ticket('ga-valid-2', ga.id, paid.id, 'VALID', 'SOLD'),
      ticket('ga-valid-3', ga.id, paid.id, 'VALID', 'SOLD'),
      ticket('ga-valid-4', ga.id, paid.id, 'VALID', 'SOLD'),
      ticket('ga-used-1', ga.id, paid.id, 'USED', 'SOLD'),
      ticket('ga-used-2', ga.id, paid.id, 'USED', 'SOLD'),
      ticket('vip-cancelled-1', vip.id, paid.id, 'CANCELLED', 'SOLD'),
      ticket('vip-cancelled-2', vip.id, paid.id, 'CANCELLED', 'SOLD'),
      ticket('vip-transferred', vip.id, paid.id, 'TRANSFERRED', 'SOLD'),
      ticket('ga-refunded', ga.id, refunded.id, 'VALID', 'SOLD'),
      ticket('ga-held', ga.id, pending.id, 'VALID', 'HELD'),
      ticket('vip-order-cancelled', vip.id, cancelledOrder.id, 'CANCELLED', 'RELEASED'),
    ]);

    const doorA = await prisma.scanner.create({
      data: {
        name: 'Door A',
        apiKey: `${key}-a`,
        organizationId,
        eventId,
        createdBy: owner.id,
        status: 'ACTIVE',
      },
    });
    const doorB = await prisma.scanner.create({
      data: {
        name: 'Door B',
        apiKey: `${key}-b`,
        organizationId,
        eventId,
        createdBy: owner.id,
        status: 'ACTIVE',
      },
    });
    const doorC = await prisma.scanner.create({
      data: {
        name: 'Door C',
        apiKey: `${key}-c`,
        organizationId,
        eventId,
        createdBy: owner.id,
        status: 'DISABLED',
      },
    });
    const roaming = await prisma.scanner.create({
      data: {
        name: 'Roaming',
        apiKey: `${key}-roam`,
        organizationId,
        eventId: null,
        createdBy: owner.id,
        status: 'ACTIVE',
      },
    });
    const otherDoor = await prisma.scanner.create({
      data: {
        name: 'Other Event Door',
        apiKey: `${key}-other`,
        organizationId,
        eventId: otherEventId,
        createdBy: owner.id,
        status: 'ACTIVE',
      },
    });
    doorAId = doorA.id;
    doorBId = doorB.id;
    doorCId = doorC.id;
    roamingId = roaming.id;

    const atHour = (hoursAgo: number, minute: number) => {
      const when = new Date();
      when.setHours(when.getHours() - hoursAgo, minute, 0, 0);
      return when;
    };
    tOld = new Date(Date.now() - 30 * 60 * 60 * 1000);
    tTwoHours = atHour(2, 20);
    tOneHourEntry = atHour(1, 20);
    tOneHourExit = atHour(1, 35);
    tOneHourFail1 = atHour(1, 40);
    tOneHourFail2 = atHour(1, 45);
    tNowDoorC = atHour(0, 20);
    tNowValidation = atHour(0, 25);
    tNowRoaming = atHour(0, 30);
    tNowRoamingFail = atHour(0, 35);

    await prisma.scanLog.createMany({
      data: [
        { scannerId: doorAId, eventId, scanType: 'ENTRY', success: true, scannedAt: tOld },
        { scannerId: doorAId, eventId, scanType: 'ENTRY', success: true, scannedAt: tTwoHours },
        { scannerId: doorAId, eventId, scanType: 'ENTRY', success: true, scannedAt: tTwoHours },
        { scannerId: doorAId, eventId, scanType: 'ENTRY', success: true, scannedAt: tTwoHours },
        { scannerId: doorAId, eventId, scanType: 'EXIT', success: true, scannedAt: tOneHourExit },
        {
          scannerId: doorAId,
          eventId,
          scanType: 'ENTRY',
          success: false,
          failureReason: 'duplicate',
          scannedAt: tOneHourFail1,
        },
        {
          scannerId: doorAId,
          eventId,
          scanType: 'ENTRY',
          success: false,
          failureReason: 'rejected',
          scannedAt: tOneHourFail2,
        },
        { scannerId: doorBId, eventId, scanType: 'ENTRY', success: true, scannedAt: tOneHourEntry },
        { scannerId: doorBId, eventId, scanType: 'ENTRY', success: true, scannedAt: tOneHourEntry },
        {
          scannerId: doorBId,
          eventId,
          scanType: 'VALIDATION',
          success: true,
          scannedAt: tNowValidation,
        },
        { scannerId: doorCId, eventId, scanType: 'ENTRY', success: true, scannedAt: tNowDoorC },
        { scannerId: roamingId, eventId, scanType: 'ENTRY', success: true, scannedAt: tNowRoaming },
        {
          scannerId: roamingId,
          eventId,
          scanType: 'ENTRY',
          success: false,
          failureReason: 'void',
          scannedAt: tNowRoamingFail,
        },
        {
          scannerId: otherDoor.id,
          eventId: otherEventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: tNowDoorC,
        },
        {
          scannerId: otherDoor.id,
          eventId: otherEventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: tNowDoorC,
        },
        {
          scannerId: otherDoor.id,
          eventId: otherEventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: tNowDoorC,
        },
        {
          scannerId: otherDoor.id,
          eventId: otherEventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: tNowDoorC,
        },
        {
          scannerId: otherDoor.id,
          eventId: otherEventId,
          scanType: 'ENTRY',
          success: true,
          scannedAt: tNowDoorC,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({
      where: { scanner: { apiKey: { startsWith: key } } },
    });
    await prisma.scanner.deleteMany({ where: { apiKey: { startsWith: key } } });
    await prisma.ticket.deleteMany({ where: { barcode: { startsWith: key } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: key } } });
    await prisma.ticketType.deleteMany({
      where: { event: { slug: { startsWith: key } } },
    });
    await prisma.event.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.$disconnect();
  });

  it('refuses unauthenticated occupancy, timeline, and scanner-stats reads', async () => {
    for (const path of statsPaths(eventId)) {
      const missing = await request(app).get(path);
      expect(missing.status).toBe(401);
      expect(missing.body.message).toBe('No token provided');

      const invalid = await request(app).get(path).set(auth('not-a-token'));
      expect(invalid.status).toBe(401);
      expect(invalid.body.message).toBe('Invalid token');
    }
  });

  it.each(['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER', 'ADMIN_GLOBAL'] as const)(
    'allows %s to read command-center stats',
    async (role) => {
      for (const path of statsPaths(eventId)) {
        const response = await request(app).get(path).set(auth(roleTokens[role]));
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    }
  );

  it.each(['CUSTOMER', 'SCANNER', 'TEAM_MEMBER'] as const)(
    'refuses %s occupancy, timeline, and scanner-stats reads',
    async (role) => {
      for (const path of statsPaths(eventId)) {
        const response = await request(app).get(path).set(auth(roleTokens[role]));
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Insufficient permissions');
      }
    }
  );

  it('does not let another organization read this event’s stats', async () => {
    for (const path of statsPaths(eventId)) {
      const response = await request(app).get(path).set(auth(otherOwnerToken));
      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You do not have access to this organization's resources");
    }
  });

  it('returns 404 for an unknown event id', async () => {
    const missingId = randomUUID();
    for (const path of statsPaths(missingId)) {
      const response = await request(app).get(path).set(auth(ownerToken));
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    }
  });

  it('returns zeros and empty arrays for an event with no tickets or scans', async () => {
    const occupancy = await request(app)
      .get(`/api/v1/events/${emptyEventId}/occupancy`)
      .set(auth(emptyOwnerToken));
    expect(occupancy.status).toBe(200);
    expect(occupancy.body.data).toEqual({
      eventId: emptyEventId,
      currentOccupancy: 0,
      capacity: 100,
      percentageFull: 0,
    });

    const timeline = await request(app)
      .get(`/api/v1/events/${emptyEventId}/timeline`)
      .set(auth(emptyOwnerToken));
    expect(timeline.status).toBe(200);
    expect(timeline.body.data).toEqual([]);

    const scanners = await request(app)
      .get(`/api/v1/events/${emptyEventId}/scanner-stats`)
      .set(auth(emptyOwnerToken));
    expect(scanners.status).toBe(200);
    expect(scanners.body.data).toEqual({
      totalScanners: 0,
      activeScanners: 0,
      scannerActivity: [],
    });
  });

  it('returns hand-computed occupancy from successful entry and exit scans', async () => {
    // Successful ENTRY this event: 1 old + 3 at 2h + 2 at 1h + door C + roaming = 8.
    // Successful EXIT: 1. Duplicate/rejected/VALIDATION/other-event scans excluded.
    // Occupancy = max(0, 8 - 1) = 7. Capacity 50 => 14% full.
    const response = await request(app)
      .get(`/api/v1/events/${eventId}/occupancy`)
      .set(auth(ownerToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      eventId,
      currentOccupancy: 7,
      capacity: 50,
      percentageFull: 14,
    });

    // Ticket counts are owned by the same service as occupancy. Seeded tickets:
    // 4 VALID/SOLD/PAID, 2 USED/SOLD/PAID, 2 CANCELLED/SOLD/PAID, 1 TRANSFERRED/SOLD/PAID,
    // 1 VALID/SOLD/REFUNDED, 1 VALID/HELD/PENDING, 1 CANCELLED/RELEASED/CANCELLED.
    const stats = await request(app).get(`/api/v1/events/${eventId}/stats`).set(auth(ownerToken));
    expect(stats.status).toBe(200);
    expect(stats.body.data).toEqual({
      eventId,
      eventName: `${key}-live`,
      totalTickets: 12,
      ticketsSold: 9,
      ticketsUsed: 2,
      ticketsValid: 4,
      ticketsCancelled: 3,
      currentOccupancy: 7,
      entryCount: 8,
      exitCount: 1,
      scanSuccessRate: 76.92,
      lastScanAt: tNowRoamingFail.toISOString(),
    });
  });

  it('returns hand-computed 24h timeline buckets excluding scans outside the window', async () => {
    const response = await request(app)
      .get(`/api/v1/events/${eventId}/timeline`)
      .set(auth(ownerToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        timestamp: hourBucket(tTwoHours),
        entryCount: 3,
        exitCount: 0,
        occupancy: 3,
      },
      {
        timestamp: hourBucket(tOneHourEntry),
        entryCount: 2,
        exitCount: 1,
        occupancy: 4,
      },
      {
        timestamp: hourBucket(tNowDoorC),
        entryCount: 2,
        exitCount: 0,
        occupancy: 6,
      },
    ]);
  });

  it('includes the 30-hour-old entry when timeline hours=48', async () => {
    const response = await request(app)
      .get(`/api/v1/events/${eventId}/timeline?hours=48`)
      .set(auth(ownerToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        timestamp: hourBucket(tOld),
        entryCount: 1,
        exitCount: 0,
        occupancy: 1,
      },
      {
        timestamp: hourBucket(tTwoHours),
        entryCount: 3,
        exitCount: 0,
        occupancy: 4,
      },
      {
        timestamp: hourBucket(tOneHourEntry),
        entryCount: 2,
        exitCount: 1,
        occupancy: 5,
      },
      {
        timestamp: hourBucket(tNowDoorC),
        entryCount: 2,
        exitCount: 0,
        occupancy: 7,
      },
    ]);
  });

  it('returns hand-computed scanner-stats excluding other-event scanners', async () => {
    const response = await request(app)
      .get(`/api/v1/events/${eventId}/scanner-stats`)
      .set(auth(ownerToken));
    expect(response.status).toBe(200);
    expect(response.body.data.totalScanners).toBe(4);
    expect(response.body.data.activeScanners).toBe(3);
    expect(response.body.data.scannerActivity).toEqual([
      {
        scannerId: doorAId,
        scannerName: 'Door A',
        scanCount: 7,
        successRate: 71.43,
        lastScanAt: tOneHourFail2.toISOString(),
      },
      {
        scannerId: doorBId,
        scannerName: 'Door B',
        scanCount: 3,
        successRate: 100,
        lastScanAt: tNowValidation.toISOString(),
      },
      {
        scannerId: roamingId,
        scannerName: 'Roaming',
        scanCount: 2,
        successRate: 50,
        lastScanAt: tNowRoamingFail.toISOString(),
      },
      {
        scannerId: doorCId,
        scannerName: 'Door C',
        scanCount: 1,
        successRate: 100,
        lastScanAt: tNowDoorC.toISOString(),
      },
    ]);
  });
});
