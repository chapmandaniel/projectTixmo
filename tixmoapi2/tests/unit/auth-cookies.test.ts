import express from 'express';
import request from 'supertest';

jest.mock('../../src/api/auth/service', () => ({
  authService: {
    login: jest.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'operator@example.com',
        firstName: 'Op',
        lastName: 'Erator',
        role: 'OWNER',
        organizationId: 'org-1',
        emailVerified: true,
        sessionVersion: 0,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    refreshToken: jest.fn().mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    }),
  },
}));

import { login, refreshToken } from '../../src/api/auth/controller';
import { hostOnlyCookieMiddleware } from '../../src/middleware/hostOnlyCookies';

const cookieDomainAttribute = /(?:^|;\s*)domain\s*=/i;

const setCookieHeaders = (headers: request.Response['headers']): string[] => {
  const header = headers['set-cookie'];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
};

const expectHostOnlyCookies = (response: request.Response) => {
  const cookies = setCookieHeaders(response.headers);
  for (const cookie of cookies) {
    expect(cookie).not.toMatch(cookieDomainAttribute);
    expect(cookie.toLowerCase()).not.toContain('domain=.tixmo.co');
  }
};

describe('auth cookies', () => {
  const app = express();
  app.use(express.json());
  app.post('/api/v1/auth/login', login);
  app.post('/api/v1/auth/refresh', refreshToken);

  it('treats a cookie without Domain as host-only and rejects a parent-domain cookie', () => {
    expect(cookieDomainAttribute.test('session=abc; HttpOnly; Secure; SameSite=Lax')).toBe(false);
    expect(cookieDomainAttribute.test('session=abc; Domain=.tixmo.co; HttpOnly')).toBe(true);
    expect(cookieDomainAttribute.test('session=abc; domain=demo.tixmo.co')).toBe(true);
  });

  it('rejects a Domain attribute on any response that passes through the app hook', async () => {
    const guarded = express();
    guarded.use(hostOnlyCookieMiddleware);
    guarded.get('/host-only', (_req, res) => {
      res.append('Set-Cookie', 'session=abc; HttpOnly; Secure; SameSite=Lax');
      res.status(204).end();
    });
    guarded.get('/parent-domain', (_req, res) => {
      res.append('Set-Cookie', 'session=abc; Domain=.tixmo.co; HttpOnly');
      res.status(204).end();
    });

    const allowed = await request(guarded).get('/host-only');
    expect(allowed.status).toBe(204);
    expectHostOnlyCookies(allowed);
    expect(allowed.headers['set-cookie']?.[0]).toContain('session=abc');

    const denied = await request(guarded).get('/parent-domain');
    expect(denied.status).toBe(500);
    expect(setCookieHeaders(denied.headers)).toEqual([]);
  });

  it('keeps login and refresh cookies host-only', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'operator@example.com', password: 'not-a-real-password' });
    expect(loginResponse.status).toBe(200);
    expectHostOnlyCookies(loginResponse);

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token' });
    expect(refreshResponse.status).toBe(200);
    expectHostOnlyCookies(refreshResponse);
  });
});
