import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt';
import { randomUUID } from 'crypto';
import {
  CHECKOUT_ACTOR_LIMIT_MESSAGE,
  CHECKOUT_IP_LIMIT_MESSAGE,
} from '../../src/middleware/rateLimiter';

jest.setTimeout(120000);

const NAT_IP = '203.0.113.150';
const ABUSE_IP = '203.0.113.151';
const CEILING_IP = '203.0.113.152';
const OTHER_IP = '203.0.113.153';
const GUEST_IP = '203.0.113.154';
const ANON_IP = '203.0.113.155';
const WEBHOOK_IP = '203.0.113.156';
const BUYER_COUNT = 20;

describe('checkout rate limit', () => {
  const buyers: Array<{ id: string; token: string }> = [];

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    for (let index = 0; index < BUYER_COUNT; index += 1) {
      const id = randomUUID();
      await prisma.user.create({
        data: {
          id,
          email: `checkout-rate-${suffix}-${index}@example.com`,
          passwordHash: 'no-password-login-for-this-fixture',
          firstName: 'Buyer',
          lastName: String(index),
          role: 'CUSTOMER',
        },
      });
      buyers.push({
        id,
        token: generateAccessToken({
          userId: id,
          email: `checkout-rate-${suffix}-${index}@example.com`,
          role: 'CUSTOMER',
          organizationId: null,
          emailVerified: true,
          sessionVersion: 0,
        }),
      });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: buyers.map((buyer) => buyer.id) } } });
  });

  function checkout(
    path: string,
    token: string | undefined,
    ip: string,
    headers?: Record<string, string>
  ) {
    const call = request(app).post(path).set('X-Forwarded-For', ip);
    if (token) call.set('Authorization', `Bearer ${token}`);
    for (const [name, value] of Object.entries(headers ?? {})) call.set(name, value);
    return call.send({});
  }

  it('lets many buyers on one NAT IP through checkout writes while the general write cap stays strict', async () => {
    const orderId = randomUUID();
    const paths = [
      '/api/v1/orders',
      '/api/v1/payments/create-intent',
      `/api/v1/orders/${orderId}/cancel`,
      `/api/v1/orders/${orderId}/confirm`,
    ];

    for (const buyer of buyers.slice(0, BUYER_COUNT - 2)) {
      for (const path of paths) {
        const response = await checkout(path, buyer.token, NAT_IP, {
          'X-Test-Rate-Limit': 'strict',
        });
        expect(response.status).not.toBe(429);
      }
    }

    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .post('/api/v1/scanners/auth')
        .set('X-Forwarded-For', NAT_IP)
        .set('X-Test-Rate-Limit', 'strict')
        .send({ apiKey: 'sk_scanner_checkout-nat-control' });
      expect(response.status).not.toBe(429);
    }

    const sharedWrite = await request(app)
      .post('/api/v1/scanners/auth')
      .set('X-Forwarded-For', NAT_IP)
      .set('X-Test-Rate-Limit', 'strict')
      .send({ apiKey: 'sk_scanner_checkout-nat-control' });
    expect(sharedWrite.status).toBe(429);
    expect(sharedWrite.body.message).toMatch(/too many changes submitted/i);
  });

  it('stops one buyer who keeps writing and still admits the next buyer on that IP', async () => {
    const low = { 'X-Test-Checkout-Rate-Limit': 'low' };
    const [abuser, neighbour] = buyers.slice(-2);

    for (let index = 0; index < 3; index += 1) {
      const response = await checkout(
        '/api/v1/payments/create-intent',
        abuser.token,
        ABUSE_IP,
        low
      );
      expect(response.status).not.toBe(429);
    }

    const limited = await checkout('/api/v1/orders', abuser.token, ABUSE_IP, low);
    expect(limited.status).toBe(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.message).toBe(CHECKOUT_ACTOR_LIMIT_MESSAGE);

    const otherBuyer = await checkout('/api/v1/orders', neighbour.token, ABUSE_IP, low);
    expect(otherBuyer.status).not.toBe(429);
  });

  it('caps a shared IP and still accepts a guest session as its own actor', async () => {
    const lowIp = { 'X-Test-Checkout-Ip-Rate-Limit': 'low' };
    for (let index = 0; index < 4; index += 1) {
      const response = await checkout('/api/v1/orders', undefined, CEILING_IP, lowIp);
      expect(response.status).not.toBe(429);
    }

    const ceiling = await checkout('/api/v1/payments/create-intent', undefined, CEILING_IP, lowIp);
    expect(ceiling.status).toBe(429);
    expect(ceiling.body.success).toBe(false);
    expect(ceiling.body.message).toBe(CHECKOUT_IP_LIMIT_MESSAGE);

    const otherNetwork = await checkout('/api/v1/orders', undefined, OTHER_IP, lowIp);
    expect(otherNetwork.status).not.toBe(429);

    const lowActor = { 'X-Test-Checkout-Rate-Limit': 'low' };
    const sessionA = 'guest-session-alpha1';
    const sessionB = 'guest-session-bravo2';
    for (let index = 0; index < 3; index += 1) {
      const response = await checkout('/api/v1/orders', undefined, GUEST_IP, {
        ...lowActor,
        'X-Checkout-Session': sessionA,
      });
      expect(response.status).not.toBe(429);
    }

    const guestLimited = await checkout('/api/v1/orders', undefined, GUEST_IP, {
      ...lowActor,
      'X-Checkout-Session': sessionA,
    });
    expect(guestLimited.status).toBe(429);
    expect(guestLimited.body.message).toBe(CHECKOUT_ACTOR_LIMIT_MESSAGE);

    const otherGuest = await checkout('/api/v1/orders', undefined, GUEST_IP, {
      ...lowActor,
      Cookie: `tixmo_checkout_session=${sessionB}`,
    });
    expect(otherGuest.status).not.toBe(429);

    for (let index = 0; index < 4; index += 1) {
      const response = await checkout('/api/v1/orders', undefined, ANON_IP, lowActor);
      expect(response.status).not.toBe(429);
    }
  });

  it('does not put the Stripe webhook on the checkout IP ceiling', async () => {
    const lowIp = { 'X-Test-Checkout-Ip-Rate-Limit': 'low' };
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Forwarded-For', WEBHOOK_IP)
        .set(lowIp)
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));
      expect(response.status).not.toBe(429);
    }
  });
});
