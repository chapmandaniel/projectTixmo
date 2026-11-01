import { randomUUID } from 'crypto';
import { DOORS_BEFORE_START_MS } from '../../src/config/doors';
import { scannerService } from '../../src/api/scanners/service';
import { presentScanResult, SCAN_REASON } from '../../src/api/scanners/public-scan';
import { ticketService } from '../../src/api/tickets/service';
import { generateTicketQRData } from '../../src/utils/qrcode';
import { cleanupTestData, prisma } from '../utils/testUtils';

describe('scanner doors and end time', () => {
  let userId = '';
  let eventId = '';
  let ticketTypeId = '';
  let scannerId = '';

  beforeAll(async () => {
    await cleanupTestData();
    const organization = await prisma.organization.create({
      data: { name: 'Gate Org', slug: randomUUID(), type: 'PROMOTER' },
    });
    const user = await prisma.user.create({
      data: {
        email: 'gate-buyer@test.com',
        firstName: 'Ada',
        lastName: 'Buyer',
        passwordHash: 'synthetic',
        role: 'CUSTOMER',
      },
    });
    const event = await prisma.event.create({
      data: {
        organizationId: organization.id,
        name: 'Gate Night',
        slug: randomUUID(),
        status: 'ON_SALE',
        timezone: 'UTC',
        startDatetime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 6 * 60 * 60 * 1000),
        tags: [],
      },
    });
    const ticketType = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'GA',
        price: 10,
        quantityTotal: 20,
        quantityAvailable: 20,
      },
    });
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Main gate',
        apiKey: randomUUID(),
        organizationId: organization.id,
        eventId: event.id,
        createdBy: user.id,
      },
    });
    userId = user.id;
    eventId = event.id;
    ticketTypeId = ticketType.id;
    scannerId = scanner.id;
  });

  afterAll(cleanupTestData);

  const placeEvent = (start: Date, end: Date) =>
    prisma.event.update({
      where: { id: eventId },
      data: { startDatetime: start, endDatetime: end },
    });

  const issueTicket = async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `GATE-${randomUUID()}`,
        eventId,
        userId,
        totalAmount: 10,
        currency: 'cad',
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        tickets: {
          create: {
            eventId,
            ticketTypeId,
            userId,
            pricePaid: 10,
            barcode: randomUUID(),
            inventoryState: 'SOLD',
            status: 'VALID',
          },
        },
      },
      include: { tickets: true },
    });
    return order.tickets[0];
  };

  const scan = (ticket: { id: string; barcode: string }, admittedAt?: Date) =>
    scannerService.scanTicket({
      scannerId,
      qrData: generateTicketQRData(ticket.id, ticket.barcode, eventId),
      scanType: 'ENTRY',
      admittedAt,
    });

  const expectUntouched = async (ticketId: string) => {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe('VALID');
    expect(ticket.checkedInAt).toBeNull();
  };

  it('denies a live scan before doors and does not consume the ticket', async () => {
    const start = new Date(Date.now() + DOORS_BEFORE_START_MS + 10 * 60 * 1000);
    await placeEvent(start, new Date(start.getTime() + 3 * 60 * 60 * 1000));
    const ticket = await issueTicket();
    await expect(ticketService.checkInTicket(ticket.barcode, userId)).rejects.toThrow(
      'Event has not started yet'
    );
    const denied = await scan(ticket);
    expect(denied.success).toBe(false);
    expect(denied.reason).toBe('Event has not started yet');
    expect(denied.reasonCode).toBe(SCAN_REASON.NOT_STARTED);
    expect(presentScanResult(denied)).toMatchObject({
      valid: false,
      reason: SCAN_REASON.NOT_STARTED,
      message: 'Event has not started yet',
    });
    expect(denied.scanLog.failureReason).toBe(SCAN_REASON.NOT_STARTED);
    await expectUntouched(ticket.id);
  });

  it('admits a live scan at doors', async () => {
    const start = new Date(Date.now() + DOORS_BEFORE_START_MS);
    await placeEvent(start, new Date(start.getTime() + 3 * 60 * 60 * 1000));
    const ticket = await issueTicket();
    const admitted = await scan(ticket);
    expect(admitted.success).toBe(true);
    expect(admitted.reasonCode).toBe(SCAN_REASON.ADMITTED);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'USED'
    );
  });

  it('denies a live scan after the event has ended', async () => {
    const end = new Date(Date.now() - 60 * 1000);
    await placeEvent(new Date(end.getTime() - 3 * 60 * 60 * 1000), end);
    const ticket = await issueTicket();
    const denied = await scan(ticket);
    expect(denied.success).toBe(false);
    expect(denied.reason).toBe('Event has already ended');
    expect(denied.reasonCode).toBe(SCAN_REASON.EVENT_ENDED);
    expect(presentScanResult(denied).reason).toBe(SCAN_REASON.EVENT_ENDED);
    await expectUntouched(ticket.id);
  });

  it('accepts an offline scan recorded during doors and uploaded after the end', async () => {
    const end = new Date(Date.now() - 60 * 60 * 1000);
    const start = new Date(end.getTime() - 3 * 60 * 60 * 1000);
    await placeEvent(start, end);
    const ticket = await issueTicket();
    const recordedAt = new Date(end.getTime() - 30 * 60 * 1000);
    const uploaded = await scannerService.processOfflineScans(scannerId, [
      {
        qrData: generateTicketQRData(ticket.id, ticket.barcode, eventId),
        scannedAt: recordedAt.toISOString(),
        scanType: 'ENTRY',
      },
    ]);
    expect(uploaded).toMatchObject({
      processed: 1,
      success: 1,
      failed: 0,
      results: [{ success: true, reasonCode: SCAN_REASON.ADMITTED }],
    });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'USED'
    );
  });

  it('denies an offline scan recorded before doors even when the upload is in window', async () => {
    const start = new Date(Date.now() - 30 * 60 * 1000);
    await placeEvent(start, new Date(Date.now() + 3 * 60 * 60 * 1000));
    const ticket = await issueTicket();
    const recordedAt = new Date(start.getTime() - DOORS_BEFORE_START_MS - 60 * 1000);
    const uploaded = await scannerService.processOfflineScans(scannerId, [
      {
        qrData: generateTicketQRData(ticket.id, ticket.barcode, eventId),
        scannedAt: recordedAt.toISOString(),
        scanType: 'ENTRY',
      },
    ]);
    expect(uploaded.success).toBe(0);
    expect(uploaded.results[0]).toMatchObject({
      success: false,
      reason: 'Event has not started yet',
      reasonCode: SCAN_REASON.NOT_STARTED,
    });
    await expectUntouched(ticket.id);
  });

  it('judges a future or ancient offline stamp at server time', async () => {
    const start = new Date(Date.now() - 60 * 60 * 1000);
    await placeEvent(start, new Date(Date.now() + 3 * 60 * 60 * 1000));
    const futureTicket = await issueTicket();
    const future = await scannerService.processOfflineScans(scannerId, [
      {
        qrData: generateTicketQRData(futureTicket.id, futureTicket.barcode, eventId),
        scannedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scanType: 'ENTRY',
      },
    ]);
    expect(future.success).toBe(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: futureTicket.id } })).status).toBe(
      'USED'
    );

    const ancientTicket = await issueTicket();
    const ancient = await scannerService.processOfflineScans(scannerId, [
      {
        qrData: generateTicketQRData(ancientTicket.id, ancientTicket.barcode, eventId),
        scannedAt: '2001-01-01T00:00:00.000Z',
        scanType: 'ENTRY',
      },
    ]);
    expect(ancient.success).toBe(1);
  });
});
