import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { SCAN_REASON } from '../../src/api/scanners/public-scan';
import { generateTicketQRData, parseTicketQRData } from '../../src/utils/qrcode';
import { prisma } from '../utils/testUtils';

jest.setTimeout(60000);

type SyncTicket = {
  id: string;
  barcode: string;
  status: string;
  ticketTypeId: string;
  hash: string;
};

type OfflineScan = {
  qrData: string;
  scannedAt: string;
  scanType: 'ENTRY';
};

type ValidateRow = {
  qrData: string;
  success: boolean;
  reason?: string;
  reasonCode?: string;
};

const byQr = (results: ValidateRow[], qrData: string) =>
  results.find((row) => row.qrData === qrData);

const localDecision = (snapshot: SyncTicket[], qrData: string) => {
  const parsed = parseTicketQRData(qrData);
  if (!parsed) return { admit: false as const, reason: 'INVALID_QR' };
  const row = snapshot.find((ticket) => ticket.id === parsed.ticketId);
  if (!row) return { admit: false as const, reason: 'NOT_FOUND' };
  if (row.status === 'VALID' && row.barcode === parsed.barcode) {
    return { admit: true as const, reason: 'ADMITTED' };
  }
  if (row.status === 'USED') return { admit: false as const, reason: 'ALREADY_USED' };
  return { admit: false as const, reason: row.status };
};

describe('offline door scanning field contract', () => {
  const suffix = randomUUID().slice(0, 8);
  const offlineIp = '203.0.113.98';
  const onlineIp = '203.0.113.99';
  let userId = '';
  let orgId = '';
  let eventId = '';
  let otherEventId = '';
  let ticketTypeId = '';
  let otherTicketTypeId = '';
  let offlineKey = '';
  let onlineKey = '';
  let offlineScannerId = '';
  let onlineScannerId = '';

  const tickets: Record<
    | 'freshAdmit'
    | 'batchDup'
    | 'stolenByB'
    | 'usedBeforeSync'
    | 'unpaid'
    | 'refunded'
    | 'wrongEvent',
    { id: string; barcode: string; eventId: string }
  > = {
    freshAdmit: { id: '', barcode: '', eventId: '' },
    batchDup: { id: '', barcode: '', eventId: '' },
    stolenByB: { id: '', barcode: '', eventId: '' },
    usedBeforeSync: { id: '', barcode: '', eventId: '' },
    unpaid: { id: '', barcode: '', eventId: '' },
    refunded: { id: '', barcode: '', eventId: '' },
    wrongEvent: { id: '', barcode: '', eventId: '' },
  };

  const qr = (ticket: { id: string; barcode: string; eventId: string }) =>
    generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId);

  const scannerAuth = (apiKey: string, ip: string) => ({
    Authorization: `Bearer ${apiKey}`,
    'X-Forwarded-For': ip,
  });

  const issuePaid = async (event: string, type: string, name: string) => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `T98-${name}-${randomUUID()}`,
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
            barcode: `T98-${name}-${randomUUID()}`,
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
      data: { name: `T98 Gate ${suffix}`, slug: `t98-gate-${suffix}`, type: 'PROMOTER' },
    });
    orgId = organization.id;
    const user = await prisma.user.create({
      data: {
        email: `t98-buyer-${suffix}@test.invalid`,
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
        name: 'T98 Door Night',
        slug: `t98-door-${suffix}`,
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
        name: 'T98 Other Hall',
        slug: `t98-other-${suffix}`,
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

    const unpaidOrder = await prisma.order.create({
      data: {
        orderNumber: `T98-unpaid-${randomUUID()}`,
        eventId,
        userId,
        totalAmount: 10,
        currency: 'cad',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        tickets: {
          create: {
            eventId,
            ticketTypeId,
            userId,
            pricePaid: 10,
            barcode: `T98-unpaid-${randomUUID()}`,
            inventoryState: 'HELD',
            status: 'VALID',
          },
        },
      },
      include: { tickets: true },
    });
    tickets.unpaid = {
      id: unpaidOrder.tickets[0].id,
      barcode: unpaidOrder.tickets[0].barcode,
      eventId,
    };

    tickets.freshAdmit = await issuePaid(eventId, ticketTypeId, 'fresh');
    tickets.batchDup = await issuePaid(eventId, ticketTypeId, 'dup');
    tickets.stolenByB = await issuePaid(eventId, ticketTypeId, 'stolen');
    tickets.usedBeforeSync = await issuePaid(eventId, ticketTypeId, 'used');
    tickets.refunded = await issuePaid(eventId, ticketTypeId, 'refund');
    tickets.wrongEvent = await issuePaid(otherEventId, otherTicketTypeId, 'wrong');

    const offlineScanner = await prisma.scanner.create({
      data: {
        name: 'T98 offline door',
        apiKey: `sk_scanner_t98off_${suffix}`,
        organizationId: orgId,
        eventId,
        createdBy: userId,
      },
    });
    offlineKey = offlineScanner.apiKey;
    offlineScannerId = offlineScanner.id;
    const onlineScanner = await prisma.scanner.create({
      data: {
        name: 'T98 online door',
        apiKey: `sk_scanner_t98on_${suffix}`,
        organizationId: orgId,
        eventId,
        createdBy: userId,
      },
    });
    onlineKey = onlineScanner.apiKey;
    onlineScannerId = onlineScanner.id;
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({
      where: { scannerId: { in: [offlineScannerId, onlineScannerId] } },
    });
    await prisma.ticket.deleteMany({
      where: { eventId: { in: [eventId, otherEventId] } },
    });
    await prisma.order.deleteMany({
      where: { eventId: { in: [eventId, otherEventId] } },
    });
    await prisma.scanner.deleteMany({
      where: { id: { in: [offlineScannerId, onlineScannerId] } },
    });
    await prisma.ticketType.deleteMany({
      where: { id: { in: [ticketTypeId, otherTicketTypeId] } },
    });
    await prisma.event.deleteMany({ where: { id: { in: [eventId, otherEventId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it('authenticates the scanner and downloads one event snapshot, then preserves server outcomes on reconnect', async () => {
    const auth = await request(app).post('/api/v1/scanners/auth').send({ apiKey: offlineKey });
    expect(auth.status).toBe(200);
    expect(auth.body.success).toBe(true);
    expect(auth.body.data).toMatchObject({
      id: offlineScannerId,
      name: 'T98 offline door',
      status: 'ACTIVE',
      eventId,
    });
    expect(auth.body.data.apiKey).toBeUndefined();

    const usedOnline = await request(app)
      .post('/api/v1/scanners/scan')
      .set(scannerAuth(onlineKey, onlineIp))
      .send({ qrData: qr(tickets.usedBeforeSync), scanType: 'ENTRY' });
    expect(usedOnline.status).toBe(200);
    expect(usedOnline.body.data.valid).toBe(true);

    const sync = await request(app)
      .get('/api/v1/scanners/sync')
      .set(scannerAuth(offlineKey, offlineIp))
      .query({ eventId });
    expect(sync.status).toBe(200);
    expect(sync.body.success).toBe(true);
    expect(typeof sync.body.data.timestamp).toBe('string');
    const snapshot = sync.body.data.tickets as SyncTicket[];
    expect(snapshot.some((row) => row.id === tickets.wrongEvent.id)).toBe(false);

    const snapshotById = Object.fromEntries(snapshot.map((row) => [row.id, row]));
    expect(snapshotById[tickets.freshAdmit.id]).toMatchObject({
      status: 'VALID',
      barcode: tickets.freshAdmit.barcode,
    });
    expect(snapshotById[tickets.batchDup.id].status).toBe('VALID');
    expect(snapshotById[tickets.stolenByB.id].status).toBe('VALID');
    expect(snapshotById[tickets.refunded.id]).toMatchObject({
      status: 'VALID',
      barcode: tickets.refunded.barcode,
    });
    expect(snapshotById[tickets.usedBeforeSync.id]).toMatchObject({
      status: 'USED',
      barcode: tickets.usedBeforeSync.barcode,
    });
    expect(snapshotById[tickets.unpaid.id]).toMatchObject({ status: 'CANCELLED', barcode: '' });

    const scannedAt = new Date().toISOString();
    const unknownQr = `TICKET:${randomUUID()}:T98-missing-${suffix}:${eventId}`;
    const garbageQr = 'not-a-ticket';
    const queue: OfflineScan[] = [
      { qrData: qr(tickets.freshAdmit), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.batchDup), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.batchDup), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.stolenByB), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.usedBeforeSync), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.unpaid), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.refunded), scannedAt, scanType: 'ENTRY' },
      { qrData: qr(tickets.wrongEvent), scannedAt, scanType: 'ENTRY' },
      { qrData: unknownQr, scannedAt, scanType: 'ENTRY' },
      { qrData: garbageQr, scannedAt, scanType: 'ENTRY' },
    ];

    expect(localDecision(snapshot, qr(tickets.freshAdmit)).admit).toBe(true);
    expect(localDecision(snapshot, qr(tickets.batchDup)).admit).toBe(true);
    expect(localDecision(snapshot, qr(tickets.stolenByB)).admit).toBe(true);
    expect(localDecision(snapshot, qr(tickets.refunded)).admit).toBe(true);
    expect(localDecision(snapshot, qr(tickets.usedBeforeSync))).toEqual({
      admit: false,
      reason: 'ALREADY_USED',
    });
    expect(localDecision(snapshot, qr(tickets.unpaid)).admit).toBe(false);
    expect(localDecision(snapshot, qr(tickets.wrongEvent)).admit).toBe(false);
    expect(localDecision(snapshot, unknownQr)).toEqual({ admit: false, reason: 'NOT_FOUND' });
    expect(localDecision(snapshot, garbageQr)).toEqual({ admit: false, reason: 'INVALID_QR' });

    const stolenLive = await request(app)
      .post('/api/v1/scanners/scan')
      .set(scannerAuth(onlineKey, onlineIp))
      .send({ qrData: qr(tickets.stolenByB), scanType: 'ENTRY' });
    expect(stolenLive.status).toBe(200);
    expect(stolenLive.body.data.valid).toBe(true);
    const stolenCheckedIn = await prisma.ticket.findUniqueOrThrow({
      where: { id: tickets.stolenByB.id },
    });
    expect(stolenCheckedIn.status).toBe('USED');
    expect(stolenCheckedIn.checkedInBy).toBe(onlineScannerId);
    const stolenAt = stolenCheckedIn.checkedInAt;

    const refundedTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: tickets.refunded.id },
    });
    await prisma.order.update({
      where: { id: refundedTicket.orderId },
      data: { status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
    });
    await prisma.ticket.update({
      where: { id: tickets.refunded.id },
      data: { status: 'CANCELLED', inventoryState: 'RELEASED' },
    });

    const unreachable = await request(app)
      .get('/api/v1/scanners/sync')
      .set(scannerAuth('sk_scanner_t98-missing-key', offlineIp))
      .query({ eventId });
    expect(unreachable.status).toBe(401);

    const upload = await request(app)
      .post('/api/v1/scanners/validate')
      .set(scannerAuth(offlineKey, offlineIp))
      .send({ scans: queue });
    expect(upload.status).toBe(200);
    expect(upload.body.success).toBe(true);
    expect(upload.body.data.processed).toBe(queue.length);
    const results = upload.body.data.results as ValidateRow[];
    expect(results).toHaveLength(queue.length);

    const admitted = byQr(results, qr(tickets.freshAdmit));
    expect(admitted).toMatchObject({ success: true, reasonCode: SCAN_REASON.ADMITTED });
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: tickets.freshAdmit.id } })).status
    ).toBe('USED');

    const firstDup = results.find((row) => row.qrData === qr(tickets.batchDup) && row.success);
    const secondDup = results.find((row) => row.qrData === qr(tickets.batchDup) && !row.success);
    expect(firstDup).toMatchObject({ success: true, reasonCode: SCAN_REASON.ADMITTED });
    expect(secondDup).toMatchObject({
      success: false,
      reason: 'Ticket has already been used',
      reasonCode: SCAN_REASON.ALREADY_USED,
    });

    const stolenUpload = byQr(results, qr(tickets.stolenByB));
    expect(stolenUpload).toMatchObject({
      success: false,
      reason: 'Ticket has already been used',
      reasonCode: SCAN_REASON.ALREADY_USED,
    });
    const stolenAfter = await prisma.ticket.findUniqueOrThrow({
      where: { id: tickets.stolenByB.id },
    });
    expect(stolenAfter.status).toBe('USED');
    expect(stolenAfter.checkedInBy).toBe(onlineScannerId);
    expect(stolenAfter.checkedInAt?.toISOString()).toBe(stolenAt?.toISOString());

    expect(byQr(results, qr(tickets.usedBeforeSync))).toMatchObject({
      success: false,
      reason: 'Ticket has already been used',
      reasonCode: SCAN_REASON.ALREADY_USED,
    });

    expect(byQr(results, qr(tickets.unpaid))).toMatchObject({
      success: false,
      reason: 'Ticket is not valid until payment is completed',
      reasonCode: SCAN_REASON.UNPAID,
    });
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: tickets.unpaid.id } })).status
    ).toBe('VALID');

    expect(byQr(results, qr(tickets.refunded))).toMatchObject({
      success: false,
      reasonCode: SCAN_REASON.REFUNDED,
    });
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: tickets.refunded.id } })).status
    ).toBe('CANCELLED');

    const wrong = byQr(results, qr(tickets.wrongEvent));
    expect(wrong).toMatchObject({ success: false });
    expect(wrong?.reason).toBe('Scanner is not assigned to this event');
    expect(
      (await prisma.ticket.findUniqueOrThrow({ where: { id: tickets.wrongEvent.id } })).status
    ).toBe('VALID');
    const wrongLog = await prisma.scanLog.findFirst({
      where: { scannerId: offlineScannerId, ticketId: tickets.wrongEvent.id },
    });
    expect(wrongLog).toMatchObject({
      success: false,
      failureReason: SCAN_REASON.WRONG_EVENT,
    });

    expect(byQr(results, unknownQr)).toMatchObject({
      success: false,
      reason: 'Ticket not found',
      reasonCode: SCAN_REASON.NOT_FOUND,
    });
    expect(byQr(results, garbageQr)).toMatchObject({
      success: false,
      reason: 'Invalid QR code format',
      reasonCode: SCAN_REASON.INVALID_QR,
    });

    expect(upload.body.data.success).toBe(2);
    expect(upload.body.data.failed).toBe(queue.length - 2);

    const resync = await request(app)
      .get('/api/v1/scanners/sync')
      .set(scannerAuth(offlineKey, offlineIp))
      .query({ eventId });
    expect(resync.status).toBe(200);
    const later = Object.fromEntries(
      (resync.body.data.tickets as SyncTicket[]).map((row) => [row.id, row])
    );
    expect(later[tickets.freshAdmit.id].status).toBe('USED');
    expect(later[tickets.batchDup.id].status).toBe('USED');
    expect(later[tickets.stolenByB.id].status).toBe('USED');
    expect(later[tickets.usedBeforeSync.id].status).toBe('USED');
    expect(later[tickets.refunded.id]).toMatchObject({ status: 'CANCELLED', barcode: '' });
    expect(later[tickets.unpaid.id]).toMatchObject({ status: 'CANCELLED', barcode: '' });
  });

  // Bug: scanTicket throws ApiError.forbidden for WRONG_EVENT after committing
  // the scan log, and processOfflineScans' catch only copies error.message.
  // File: tixmoapi2/src/api/scanners/service.ts (throw at 451-457, catch at 756-770).
  // Expected: results[].reasonCode === WRONG_EVENT. Actual: reasonCode omitted,
  // reason is "Scanner is not assigned to this event". Not fixed in T98.
  it.skip('keeps a wrong-event denial on the validate row as WRONG_EVENT rather than a throw-only 403', async () => {
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
  });
});
