import request from 'supertest';
import type { Application } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import prisma from '../../src/config/prisma';
import { hashPassword } from '../../src/utils/password';
import { redisLockService } from '../../src/services/redis-lock.service';

jest.setTimeout(20000);

const PASSWORD = 'SecurePass123!';
const DEADLINE_MS = 1000;

async function withinOneSecond<T>(run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis outage request exceeded ${DEADLINE_MS}ms`)),
          DEADLINE_MS
        );
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    expect(Date.now() - started).toBeLessThan(DEADLINE_MS);
  }
}

describe('Redis outage on request paths', () => {
  let app: Application;
  let email: string;
  let apiKey: string;
  let firstQr: string;
  let secondQr: string;
  let firstTicketId: string;
  let orgId: string;
  let eventId: string;
  let userId: string;
  let resetFallback: () => void;

  beforeAll(async () => {
    const redis = await import('../../src/config/redis');
    const started = Date.now();
    await redis.connectRedis();
    expect(Date.now() - started).toBeLessThan(1500);
    expect(redis.getRedisClient().isReady).toBe(false);

    app = (await import('../../src/app')).default;
    resetFallback = (await import('../../src/middleware/rateLimiter'))
      .resetRedisRateLimitFallbackForTests;
    resetFallback();

    const suffix = randomUUID().slice(0, 8);
    email = `redis-outage-${suffix}@example.com`;
    const passwordHash = await hashPassword(PASSWORD);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Redis',
        lastName: 'Outage',
        role: 'CUSTOMER',
      },
    });
    userId = user.id;
    const org = await prisma.organization.create({
      data: {
        name: `Outage ${suffix}`,
        slug: `outage-${suffix}`,
        type: 'PROMOTER',
        status: 'ACTIVE',
      },
    });
    orgId = org.id;
    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Outage Gate',
        slug: `outage-gate-${suffix}`,
        status: 'ON_SALE',
      },
    });
    eventId = event.id;
    const ticketType = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'General',
        price: '20.00',
        quantityTotal: 10,
        quantityAvailable: 8,
        quantitySold: 2,
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `OUTAGE-${suffix}`,
        userId: user.id,
        eventId: event.id,
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        totalAmount: '40.00',
      },
    });
    const tickets = await Promise.all(
      [0, 1].map((index) =>
        prisma.ticket.create({
          data: {
            orderId: order.id,
            eventId: event.id,
            ticketTypeId: ticketType.id,
            userId: user.id,
            barcode: `outage${suffix}${index}`,
            status: 'VALID',
            inventoryState: 'SOLD',
            pricePaid: '20.00',
          },
        })
      )
    );
    firstTicketId = tickets[0].id;
    firstQr = `TICKET:${tickets[0].id}:${tickets[0].barcode}:${event.id}`;
    secondQr = `TICKET:${tickets[1].id}:${tickets[1].barcode}:${event.id}`;
    apiKey = `sk_scanner_${randomBytes(16).toString('hex')}`;
    await prisma.scanner.create({
      data: {
        name: 'Outage gate',
        apiKey,
        organizationId: org.id,
        eventId: event.id,
        createdBy: user.id,
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { eventId } }).catch(() => undefined);
    await prisma.ticket.deleteMany({ where: { eventId } }).catch(() => undefined);
    await prisma.scanner.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.order.deleteMany({ where: { eventId } }).catch(() => undefined);
    await prisma.ticketType.deleteMany({ where: { eventId } }).catch(() => undefined);
    await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    const redis = await import('../../src/config/redis');
    await redis.disconnectRedis();
    await prisma.$disconnect();
  });

  async function login() {
    return withinOneSecond(() =>
      request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD })
    );
  }

  async function listPublicEvents() {
    return withinOneSecond(() => request(app).get('/api/v1/events/public'));
  }

  async function scan(qrData: string) {
    return withinOneSecond(() =>
      request(app)
        .post('/api/v1/scanners/scan')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ qrData, scanType: 'ENTRY' })
    );
  }

  it('serves login, public events, and scans while Redis is unreachable', async () => {
    resetFallback();
    const ready = await withinOneSecond(() => request(app).get('/ready'));
    expect(ready.status).toBe(503);
    expect(ready.body.checks).toMatchObject({ database: true, redis: false });

    const signedIn = await login();
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.success).toBe(true);
    expect(signedIn.body.data.accessToken).toEqual(expect.any(String));

    const events = await listPublicEvents();
    expect(events.status).toBe(200);
    expect(events.body.success).toBe(true);

    const admitted = await scan(firstQr);
    expect(admitted.status).toBe(200);
    expect(admitted.body.data.valid).toBe(true);
    expect(admitted.body.data.reason).toBeNull();
    const replay = await scan(firstQr);
    expect(replay.status).toBe(200);
    expect(replay.body.data.valid).toBe(false);
    expect(replay.body.data.reason).toBe('ALREADY_USED');
    expect(replay.body.data.message).toMatch(/already been used/i);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: firstTicketId } });
    expect(ticket.status).toBe('USED');
    const successes = await prisma.scanLog.count({
      where: { ticketId: firstTicketId, success: true },
    });
    expect(successes).toBe(1);
  });

  it('still answers within a second when Redis commands hang', async () => {
    resetFallback();
    const redis = await import('../../src/config/redis');
    const client = redis.getRedisClient();
    let commandCalls = 0;
    const original = client.sendCommand.bind(client);
    client.sendCommand = (...args: Parameters<typeof original>) => {
      commandCalls += 1;
      void args;
      return new Promise(() => undefined);
    };
    try {
      const signedIn = await login();
      expect(signedIn.status).toBe(200);
      expect(commandCalls).toBeGreaterThan(0);

      resetFallback();
      const events = await listPublicEvents();
      expect(events.status).toBe(200);

      resetFallback();
      const admitted = await scan(secondQr);
      expect(admitted.status).toBe(200);
      expect(admitted.body.data.valid).toBe(true);
      expect(admitted.body.data.reason).toBeNull();

      const started = Date.now();
      await expect(
        redisLockService.acquireLock('inventory:payment:outage', 1000)
      ).rejects.toMatchObject({
        statusCode: 503,
      });
      expect(Date.now() - started).toBeLessThan(DEADLINE_MS);
    } finally {
      client.sendCommand = original;
      resetFallback();
    }
  });
});
