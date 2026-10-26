import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { randomUUID } from 'crypto';
import {
  SCANNER_ADMISSION_LIMIT_MESSAGE,
  SCANNER_AUTH_FAILURE_LIMIT_MESSAGE,
} from '../../src/middleware/rateLimiter';

jest.setTimeout(120000);

const DOOR_SCANS = 1000;
const VENUE_IP = '203.0.113.77';
const FLOOD_IP = '203.0.113.78';
const BURST_IP = '203.0.113.79';

describe('scanner admission rate limit', () => {
  let userId: string;
  let orgId: string;
  const scannerIds: string[] = [];
  const gateKeys: string[] = [];
  let burstKey: string;
  let otherBurstKey: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: {
        email: `scanner-rate-${suffix}@example.com`,
        passwordHash: 'no-password-login-for-this-fixture',
        firstName: 'Gate',
        lastName: 'Rate',
        role: 'ADMIN',
        isPlatformAdmin: true,
      },
    });
    userId = user.id;
    const org = await prisma.organization.create({
      data: {
        name: `Gate ${suffix}`,
        slug: `gate-rate-${suffix}`,
        type: 'PROMOTER',
        status: 'ACTIVE',
      },
    });
    orgId = org.id;

    const created = await Promise.all(
      ['North', 'South', 'West', 'Burst', 'Other'].map((name, index) =>
        prisma.scanner.create({
          data: {
            name: `${name} gate`,
            apiKey: `sk_scanner_${suffix}${index}`,
            organizationId: org.id,
            createdBy: user.id,
            status: 'ACTIVE',
          },
        })
      )
    );
    scannerIds.push(...created.map((scanner) => scanner.id));
    gateKeys.push(created[0].apiKey, created[1].apiKey, created[2].apiKey);
    burstKey = created[3].apiKey;
    otherBurstKey = created[4].apiKey;
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { scannerId: { in: scannerIds } } });
    await prisma.scanner.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  async function scan(apiKey: string, ip: string, header?: { name: string; value: string }) {
    const call = request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('X-Forwarded-For', ip)
      .send({ qrData: 'not-a-ticket', scanType: 'ENTRY' });
    if (header) call.set(header.name, header.value);
    return call;
  }

  it('lets 1000 scans from one IP and one scanner key through in one window', async () => {
    const apiKey = gateKeys[0];
    for (let start = 0; start < DOOR_SCANS; start += 25) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(25, DOOR_SCANS - start) }, () =>
          scan(apiKey, VENUE_IP, { name: 'X-Test-Rate-Limit', value: 'strict' })
        )
      );
      for (const response of batch) {
        expect(response.status).not.toBe(429);
        expect(response.status).toBe(200);
        expect(response.body.data.success).toBe(false);
        expect(response.body.data.reason).toBe('Invalid QR code format');
      }
    }

    const sync = await request(app)
      .get('/api/v1/scanners/sync')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('X-Forwarded-For', VENUE_IP)
      .set('X-Test-Rate-Limit', 'strict');
    expect(sync.status).not.toBe(429);
    expect(sync.status).toBe(400);
    expect(sync.body.message).toBe('Event ID is required for sync');

    const validate = await request(app)
      .post('/api/v1/scanners/validate')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('X-Forwarded-For', VENUE_IP)
      .set('X-Test-Rate-Limit', 'strict')
      .send({
        scans: [
          {
            qrData: 'not-a-ticket',
            scannedAt: new Date().toISOString(),
            scanType: 'ENTRY',
          },
        ],
      });
    expect(validate.status).not.toBe(429);
    expect(validate.status).toBe(200);
    expect(validate.body.data.processed).toBe(1);
  });

  it('still applies the per-IP write limit to other POST routes', async () => {
    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .post('/api/v1/scanners/auth')
        .set('X-Forwarded-For', VENUE_IP)
        .set('X-Test-Rate-Limit', 'strict')
        .send({ apiKey: 'sk_scanner_shared-ip-control' });
      expect(response.status).not.toBe(429);
    }

    const sharedWrite = await request(app)
      .post('/api/v1/scanners/auth')
      .set('X-Forwarded-For', VENUE_IP)
      .set('X-Test-Rate-Limit', 'strict')
      .send({ apiKey: 'sk_scanner_shared-ip-control' });
    expect(sharedWrite.status).toBe(429);
    expect(sharedWrite.body.message).toMatch(/too many changes submitted/i);
  });

  it('throttles invalid and missing scanner keys per IP and still admits a valid key', async () => {
    const missing = await request(app)
      .post('/api/v1/scanners/scan')
      .set('X-Forwarded-For', FLOOD_IP)
      .send({ qrData: 'not-a-ticket', scanType: 'ENTRY' });
    expect(missing.status).toBe(401);

    for (let index = 0; index < 29; index += 1) {
      const response = await request(app)
        .post('/api/v1/scanners/scan')
        .set('Authorization', 'Bearer sk_scanner_not-a-real-key')
        .set('X-Forwarded-For', FLOOD_IP)
        .send({ qrData: 'not-a-ticket', scanType: 'ENTRY' });
      expect(response.status).toBe(401);
    }

    const flooded = await request(app)
      .post('/api/v1/scanners/scan')
      .set('Authorization', 'Bearer sk_scanner_not-a-real-key')
      .set('X-Forwarded-For', FLOOD_IP)
      .send({ qrData: 'not-a-ticket', scanType: 'ENTRY' });
    expect(flooded.status).toBe(429);
    expect(flooded.body.success).toBe(false);
    expect(flooded.body.message).toBe(SCANNER_AUTH_FAILURE_LIMIT_MESSAGE);

    const admitted = await scan(gateKeys[0], FLOOD_IP);
    expect(admitted.status).toBe(200);
    expect(admitted.body.message).not.toBe(SCANNER_AUTH_FAILURE_LIMIT_MESSAGE);
  });

  it('tells one scanner to wait without blocking the other phones on that IP', async () => {
    const low = { name: 'X-Test-Scanner-Rate-Limit', value: 'low' };
    for (let index = 0; index < 3; index += 1) {
      const response = await scan(burstKey, BURST_IP, low);
      expect(response.status).toBe(200);
    }

    const limited = await scan(burstKey, BURST_IP, low);
    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.message).toBe(SCANNER_ADMISSION_LIMIT_MESSAGE);

    const otherPhone = await scan(otherBurstKey, BURST_IP, low);
    expect(otherPhone.status).toBe(200);
  });
});
