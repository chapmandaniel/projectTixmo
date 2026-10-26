import request from 'supertest';
import app from '../../src/app';

// Mock RedisStore to use memory store for testing rate limiting if needed
// Or just rely on the fact that if getRedisClient() throws, we know it reached the limiter
// But for a proper test, we want to see the 429.

describe('Authentication Rate Limiting', () => {
  const loginTestIp = '203.0.113.10';
  const registerTestIp = '203.0.113.20';
  const testUser = {
    email: 'rate-limit-test@example.com',
    password: 'SecurePass123!',
  };

  it('should block login attempts after 5 requests in a minute', async () => {
    const loginData = {
      email: testUser.email,
      password: 'wrong-password',
    };

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', loginTestIp)
        .set('X-Test-Rate-Limit', 'strict')
        .send(loginData);

      // Should not be rate limited yet
      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', loginTestIp)
      .set('X-Test-Rate-Limit', 'strict')
      .send(loginData);

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/too many authentication attempts/i);
  });

  it('should block register attempts after 5 requests in a minute', async () => {
    const registerData = {
      email: 'new-user@example.com',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
    };

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', registerTestIp)
        .set('X-Test-Rate-Limit', 'strict')
        .send({ ...registerData, email: `user${i}@example.com` });

      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', registerTestIp)
      .set('X-Test-Rate-Limit', 'strict')
      .send(registerData);

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/too many authentication attempts/i);
  });

  it('limits one account across IP addresses and still allows a different account', async () => {
    const email = 'account-rate-limit@example.com';
    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `203.0.113.${120 + index}`)
        .set('X-Test-Auth-Account-Rate-Limit', 'low')
        .send({ email, password: 'wrong-password' });

      expect(response.status).not.toBe(429);
    }

    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.130')
      .set('X-Test-Auth-Account-Rate-Limit', 'low')
      .send({ email: 'Account-Rate-Limit@example.com', password: 'wrong-password' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.message).toMatch(/too many attempts for this account/i);

    const otherAccount = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.131')
      .set('X-Test-Auth-Account-Rate-Limit', 'low')
      .send({ email: 'other-account-rate-limit@example.com', password: 'wrong-password' });

    expect(otherAccount.status).not.toBe(429);
  });
});
