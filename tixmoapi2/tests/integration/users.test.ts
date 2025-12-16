import request from 'supertest';
import app from '../../src/app';
import { prisma, cleanupTestData, registerUser } from '../utils/testUtils';
import { UserRole } from '@prisma/client';

describe('Users Routes', () => {
  let adminUser: any;
  let adminToken: string;
  let regularUser: any;
  let regularToken: string;
  let otherUser: any;

  beforeAll(async () => {
    await cleanupTestData();

    // Create admin user
    const adminData = await registerUser(app, {
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
    });
    adminUser = adminData.user;
    adminToken = adminData.accessToken;

    // Manually promote to ADMIN
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: UserRole.ADMIN },
    });

    // Login to get new token with ADMIN role
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'SecurePass123!',
    });
    adminToken = loginRes.body.data.accessToken;

    // Create regular user
    const regularData = await registerUser(app, {
      email: 'user@test.com',
      firstName: 'Regular',
      lastName: 'User',
    });
    regularUser = regularData.user;
    regularToken = regularData.accessToken;

    // Create other user (for permission testing)
    const otherData = await registerUser(app, {
      email: 'other@test.com',
      firstName: 'Other',
      lastName: 'User',
    });
    otherUser = otherData.user;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /v1/users/:id', () => {
    it('should allow user to view their own profile', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(regularUser.id);
      expect(res.body.data.email).toBe(regularUser.email);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should allow admin to view any user profile', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(regularUser.id);
    });

    it('should forbid user from viewing another users profile', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /v1/users/:id', () => {
    it('should allow user to update their own profile', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Updated');
      expect(res.body.data.lastName).toBe('Name');
    });

    it('should allow admin to update any user profile', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: '+1234567890',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+1234567890');
    });

    it('should forbid user from updating another users profile', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          firstName: 'Hacker',
        });

      expect(res.status).toBe(403);
    });

    it('should validate input data', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          firstName: '', // Empty string not allowed
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/users', () => {
    it('should allow admin to list users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(3);
    });

    it('should forbid non-admin from listing users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/users?limit=1&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBe(1);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('DELETE /v1/users/:id', () => {
    it('should forbid non-admin from deleting user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to delete user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify soft deletion
      const check = await prisma.user.findUnique({ where: { id: otherUser.id } });
      expect(check).not.toBeNull();
      expect(check?.email).toContain('deleted_');
      expect(check?.firstName).toBe('Deleted');
    });
  });
});
