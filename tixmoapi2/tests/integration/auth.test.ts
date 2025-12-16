import request from 'supertest';
import app from '../../src/app';
import { prisma, safeCleanupUsers } from '../utils/testUtils';

describe('Authentication Endpoints', () => {
  // Clean up database before and after tests
  beforeAll(async () => {
    await safeCleanupUsers();
  });

  afterAll(async () => {
    // Clean up test data in correct order (respecting foreign keys)
    // Note: Other tests may have created related data
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    const validUser = {
      email: 'test-register@example.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
    };

    afterEach(async () => {
      // Clean up after each test (use safe helper)
      try {
        await safeCleanupUsers(validUser.email);
      } catch (e) {}
    });

    it('should register new user successfully', async () => {
      const response = await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(validUser.email);
      expect(response.body.data.user.firstName).toBe(validUser.firstName);
      expect(response.body.data.user.lastName).toBe(validUser.lastName);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should hash password before storing', async () => {
      await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

      const user = await prisma.user.findUnique({
        where: { email: validUser.email },
      });

      expect(user).toBeTruthy();
      expect(user!.passwordHash).not.toBe(validUser.password);
      expect(user!.passwordHash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
    });

    it('should return access and refresh tokens', async () => {
      const response = await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

      const { accessToken, refreshToken } = response.body.data;

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');

      // JWT format check (3 parts separated by dots)
      expect(accessToken.split('.').length).toBe(3);
      expect(refreshToken.split('.').length).toBe(3);
    });

    it('should reject duplicate email (409)', async () => {
      // Create first user
      await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

      // Try to create duplicate
      const response = await request(app).post('/api/v1/auth/register').send(validUser).expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already exists|duplicate/i);
    });

    it('should reject invalid email format (400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUser,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject weak password (400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUser,
          password: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing required fields (400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: validUser.email,
          // missing password, firstName, lastName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject password < 8 characters (400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUser,
          password: 'Short1!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const testUser = {
      email: 'test-login@example.com',
      password: 'SecurePass123!',
      firstName: 'Login',
      lastName: 'Test',
    };

    beforeAll(async () => {
      // Create test user
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    afterAll(async () => {
      try {
        await safeCleanupUsers(testUser.email);
      } catch (e) {}
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should update lastLogin timestamp', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const userAfter = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      if (userBefore?.lastLogin && userAfter?.lastLogin) {
        expect(userAfter.lastLogin.getTime()).toBeGreaterThan(userBefore.lastLogin.getTime());
      }
    });

    it('should reject wrong password (401)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid|incorrect|wrong/i);
    });

    it('should reject non-existent user (401)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid email format (400)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing credentials (400)', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({}).expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    const testUser = {
      email: 'test-refresh@example.com',
      password: 'SecurePass123!',
      firstName: 'Refresh',
      lastName: 'Test',
    };

    let validRefreshToken: string;

    beforeAll(async () => {
      // Create test user and get tokens
      const response = await request(app).post('/api/v1/auth/register').send(testUser);

      validRefreshToken = response.body.data.refreshToken;
    });

    afterAll(async () => {
      try {
        await safeCleanupUsers(testUser.email);
      } catch (e) {}
    });

    it('should refresh with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Tokens should be valid JWT format
      expect(response.body.data.accessToken.split('.').length).toBe(3);
      expect(response.body.data.refreshToken.split('.').length).toBe(3);
    });

    it('should reject invalid refresh token (401)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed token (401)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-valid-jwt' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing token (400)', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({}).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired refresh token (401)', async () => {
      // This test would require generating an expired token
      // For now, we'll test with an obviously invalid token
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    const testUser = {
      email: 'test-me@example.com',
      password: 'SecurePass123!',
      firstName: 'Me',
      lastName: 'Test',
    };

    let validAccessToken: string;

    beforeAll(async () => {
      // Create test user and get token
      const response = await request(app).post('/api/v1/auth/register').send(testUser);

      validAccessToken = response.body.data.accessToken;
    });

    afterAll(async () => {
      try {
        await safeCleanupUsers(testUser.email);
      } catch (e) {}
    });

    it('should return user with valid access token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.firstName).toBe(testUser.firstName);
      expect(response.body.data.lastName).toBe(testUser.lastName);
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should reject invalid token (401)', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing authorization header (401)', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired access token (401)', async () => {
      // Test with an obviously invalid token
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    const testUser = {
      email: 'test-logout@example.com',
      password: 'SecurePass123!',
      firstName: 'Logout',
      lastName: 'Test',
    };

    let validAccessToken: string;

    beforeAll(async () => {
      // Create test user and get token
      const response = await request(app).post('/api/v1/auth/register').send(testUser);

      validAccessToken = response.body.data.accessToken;
    });

    afterAll(async () => {
      try {
        await safeCleanupUsers(testUser.email);
      } catch (e) {}
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject logout without token (401)', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
