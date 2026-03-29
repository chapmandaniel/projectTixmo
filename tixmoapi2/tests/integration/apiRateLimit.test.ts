import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/utils/jwt';

const createToken = (userId: string) =>
  generateAccessToken({
    userId,
    email: `${userId}@example.com`,
    role: 'ADMIN',
    organizationId: null,
    emailVerified: true,
  });

describe('API rate limiting', () => {
  it('uses separate read buckets for authenticated users on the same IP', async () => {
    const sharedIp = '203.0.113.30';
    const firstUserToken = createToken('00000000-0000-0000-0000-000000000101');
    const secondUserToken = createToken('00000000-0000-0000-0000-000000000102');

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${firstUserToken}`)
        .set('X-Forwarded-For', sharedIp)
        .set('X-Test-Rate-Limit', 'strict');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    const rateLimitedResponse = await request(app)
      .get('/api/v1/notifications?limit=10')
      .set('Authorization', `Bearer ${firstUserToken}`)
      .set('X-Forwarded-For', sharedIp)
      .set('X-Test-Rate-Limit', 'strict');

    expect(rateLimitedResponse.status).toBe(429);

    const secondUserResponse = await request(app)
      .get('/api/v1/notifications?limit=10')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .set('X-Forwarded-For', sharedIp)
      .set('X-Test-Rate-Limit', 'strict');

    expect(secondUserResponse.status).toBe(200);
    expect(secondUserResponse.body.success).toBe(true);
  });

  it('keeps write capacity separate from read traffic', async () => {
    const token = createToken('00000000-0000-0000-0000-000000000201');
    const ipAddress = '203.0.113.40';

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', ipAddress)
        .set('X-Test-Rate-Limit', 'strict');

      expect(response.status).toBe(200);
    }

    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', ipAddress)
        .set('X-Test-Rate-Limit', 'strict');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    const rateLimitedWriteResponse = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ipAddress)
      .set('X-Test-Rate-Limit', 'strict');

    expect(rateLimitedWriteResponse.status).toBe(429);
    expect(rateLimitedWriteResponse.body.message).toMatch(/too many changes submitted/i);
  });

  it('does not count OPTIONS preflight requests against the read bucket', async () => {
    const token = createToken('00000000-0000-0000-0000-000000000301');
    const ipAddress = '203.0.113.50';

    const preflightResponse = await request(app)
      .options('/api/v1/notifications?limit=10')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .set('X-Forwarded-For', ipAddress)
      .set('X-Test-Rate-Limit', 'strict');

    expect(preflightResponse.status).toBe(204);

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', ipAddress)
        .set('X-Test-Rate-Limit', 'strict');

      expect(response.status).toBe(200);
    }

    const rateLimitedResponse = await request(app)
      .get('/api/v1/notifications?limit=10')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ipAddress)
      .set('X-Test-Rate-Limit', 'strict');

    expect(rateLimitedResponse.status).toBe(429);
  });
});
