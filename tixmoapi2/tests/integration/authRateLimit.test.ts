import request from 'supertest';
import app from '../../src/app';

// Mock RedisStore to use memory store for testing rate limiting if needed
// Or just rely on the fact that if getRedisClient() throws, we know it reached the limiter
// But for a proper test, we want to see the 429.

describe('Authentication Rate Limiting', () => {
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
        .send(loginData);

      // Should not be rate limited yet
      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/v1/auth/login')
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
        .send({ ...registerData, email: `user${i}@example.com` });

      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(registerData);

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/too many authentication attempts/i);
  });
});
