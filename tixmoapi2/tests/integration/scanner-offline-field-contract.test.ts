import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { SCAN_REASON } from '../../src/api/scanners/public-scan';
import { generateTicketQRData } from '../../src/utils/qrcode';
import { prisma } from '../utils/testUtils';

jest.setTimeout(60000);

type ValidateRow = {
  qrData: string;
  success: boolean;
  reason?: string;
  reasonCode?: string;
};

describe('offline door scanning field contract', () => {
  const suffix = randomUUID().slice(0, 8);
  const offlineIp = '203.0.113.98';
  let userId = '';
  let orgId = '';
  let eventId = '';
  let otherEventId = '';
  let ticketTypeId = '';
  let otherTicketTypeId = '';
  let offlineKey = '';
  let offlineScannerId = '';

  const qr = (ticket: { id: string; barcode: string; eventId: string }) =>
    generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);

  const scannerAuth = (apiKey: string, ip: string) => ({
    Authorization: `Bearer ${apiKey}`,
    'X-Forwarded-For': ip,
  });

  const issuePaid = async (event: string, type: string, name: string) => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `T99-${name}-${randomUUID()}`,
        eventId: event,
        userId,
        totalAmount: 10,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        tickets: {
          create: {
            eventId: event,
            ticketTypeId: type,
            userId,
            pricePaid: 10,
            barcode: `T99-${name}-${randomUUID()}`,
            inventoryState: 'SOLD',
            status: 'VALID',
          },
        },
      },
      include: { tickets: true },
    });
    return { id: order.tickets[0].id, barcode: order.tickets[0].barcode, eventId: event };
  };

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: `T99 Gate ${suffix}`, slug: `t99-gate-${suffix}`, type: 'PROMOTER' },
    });
    orgId = organization.id;
    const user = await prisma.user.create({
      data: {
        email: `t99-buyer-${suffix}@test.invalid`,
        firstName: 'Ada',
        lastName: 'Door',
        passwordHash: 'synthetic',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;
    const start = new Date(Date.now() - 60 * 60 * 1000);
    const end = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const event = await prisma.event.create({
      data: {
        organizationId: orgId,
        name: 'T99 Door Night',
        slug: `t99-door-${suffix}`,
        status: 'ON_SALE',
        timezone: 'UTC',
        startDatetime: start,
        endDatetime: end,
        tags: [],
      },
    });
    eventId = event.id;
    const otherEvent = await prisma.event.create({
      data: {
        organizationId: orgId,
        name: 'T99 Other Hall',
        slug: `t99-other-${suffix}`,
        status: 'ON_SALE',
        timezone: 'UTC',
        startDatetime: start,
        endDatetime: end,
        tags: [],
      },
    });
    otherEventId = otherEvent.id;
    const ticketType = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'GA',
        price: 10,
        quantityTotal: 50,
        quantityAvailable: 50,
      },
    });
    ticketTypeId = ticketType.id;
    const otherType = await prisma.ticketType.create({
      data: {
        eventId: otherEventId,
        name: 'GA Other',
        price: 10,
        quantityTotal: 10,
        quantityAvailable: 10,
      },
    });
    otherTicketTypeId = otherType.id;

    const offlineScanner = await prisma.scanner.create({
      data: {
        name: 'T99 offline door',
        apiKey: `sk_scanner_t99off_${suffix}`,
        organizationId: orgId,
        eventId,
        createdBy: userId,
      },
    });
    offlineKey = offlineScanner.apiKey;
    offlineScannerId = offlineScanner.id;
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { scannerId: offlineScannerId } });
    await prisma.ticket.deleteMany({ where: { eventId: { in: [eventId, otherEventId] } } });
    await prisma.order.deleteMany({ where: { eventId: { in: [eventId, otherEventId] } } });
    await prisma.scanner.deleteMany({ where: { id: offlineScannerId } });
    await prisma.ticketType.deleteMany({
      where: { id: { in: [ticketTypeId, otherTicketTypeId] } },
    });
    await prisma.event.deleteMany({ where: { id: { in: [eventId, otherEventId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  // Ported un-skipped from draft PR #200 (T98) on cursor/t98-offline-door-scanning-0a66.
  // That branch still has it.skip; after this merges, #200 should merge main,
  // keep all tests, and drop the duplicate skip.
  it('keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403', async () => {
    const other = await issuePaid(otherEventId, otherTicketTypeId, 'wrong-row');
    const scannedAt = new Date().toISOString();
    const upload = await request(app)
      .post('/api/v1/scanners/validate')
      .set(scannerAuth(offlineKey, offlineIp))
      .send({ scans: [{ qrData: qr(other), scannedAt, scanType: 'ENTRY' }] });
    expect(upload.status).toBe(200);
    const row = upload.body.data.results[0] as ValidateRow;
    expect(row.success).toBe(false);
    expect(row.reasonCode).toBe(SCAN_REASON.WRONG_EVENT);
    expect(row.reason).toBe('This ticket is for T99 Other Hall.');
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(
      'VALID'
    );
    expect(
      await prisma.scanLog.findFirst({
        where: { scannerId: offlineScannerId, ticketId: other.id },
      })
    ).toMatchObject({
      success: false,
      failureReason: SCAN_REASON.WRONG_EVENT,
    });
  });

  it('still returns 403 WRONG_EVENT on the live scan path and leaves sync assignment 403 without a scan code', async () => {
    const other = await issuePaid(otherEventId, otherTicketTypeId, 'wrong-live');
    const live = await request(app)
      .post('/api/v1/scanners/scan')
      .set(scannerAuth(offlineKey, offlineIp))
      .send({ qrData: qr(other), scanType: 'ENTRY' });
    expect(live.status).toBe(403);
    expect(live.body.message).toBe('Scanner is not assigned to this event');
    expect(live.body.data).toMatchObject({
      valid: false,
      reason: SCAN_REASON.WRONG_EVENT,
      reasonCode: SCAN_REASON.WRONG_EVENT,
      message: 'This ticket is for T99 Other Hall.',
      eventName: 'T99 Other Hall',
    });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: other.id } })).status).toBe(
      'VALID'
    );

    const sync = await request(app)
      .get('/api/v1/scanners/sync')
      .set(scannerAuth(offlineKey, offlineIp))
      .query({ eventId: otherEventId });
    expect(sync.status).toBe(403);
    expect(sync.body.message).toBe('Scanner is not assigned to this event');
    expect(sync.body.data).toBeUndefined();
    expect(sync.body.data?.reasonCode).toBeUndefined();
  });
});
