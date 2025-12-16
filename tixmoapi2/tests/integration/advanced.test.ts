import request from 'supertest';
import app from '../../src/app';
import {
  prisma,
  cleanupTestData,
  registerUser,
  createEvent,
  createOrganization,
  createVenue,
} from '../utils/testUtils';
import { UserRole } from '@prisma/client';

describe('Advanced Features API', () => {
  let adminToken: string;
  let userToken: string;
  let orgId: string;
  let eventId: string;
  let userId: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create admin
    const adminData = await registerUser(app, { email: 'admin@test.com' });
    await prisma.user.update({ where: { id: adminData.user.id }, data: { role: UserRole.ADMIN } });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'SecurePass123!' });
    adminToken = loginRes.body.data.accessToken;

    // Create regular user
    const userData = await registerUser(app, { email: 'user@test.com' });
    userToken = userData.accessToken;
    userId = userData.user.id;

    // Create organization
    const org = await createOrganization(app, adminToken, { name: 'Advanced Org' });
    orgId = org.id;

    // Create venue
    const venue = await createVenue(app, adminToken, {
      organizationId: org.id,
      name: 'Advanced Venue',
      capacity: 1000,
    });

    // Create event
    const event = await createEvent(app, adminToken, {
      organizationId: org.id,
      venueId: venue.id,
      status: 'PUBLISHED',
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Waitlists', () => {
    it('should allow user to join waitlist', async () => {
      const res = await request(app)
        .post('/api/v1/waitlists/join')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
      expect(res.body.data.eventId).toBe(eventId);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should prevent duplicate join', async () => {
      const res = await request(app)
        .post('/api/v1/waitlists/join')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId });

      expect(res.status).toBe(409);
    });

    it('should get waitlist status', async () => {
      const res = await request(app)
        .get('/api/v1/waitlists/status')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ eventId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should allow user to leave waitlist', async () => {
      const res = await request(app)
        .post('/api/v1/waitlists/leave')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return null status after leaving', async () => {
      const res = await request(app)
        .get('/api/v1/waitlists/status')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ eventId });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('Promo Codes', () => {
    const code = 'TESTPROMO2025';

    it('should create a promo code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId: orgId,
          eventId,
          maxUses: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(code);
    });

    it('should validate a valid promo code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code,
          eventId,
          orderAmount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe(10); // 10% of 100
    });

    it('should fail validation for invalid code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'INVALIDCODE',
          eventId,
          orderAmount: 100,
        });

      expect(res.status).toBe(200); // Returns 200 with valid: false
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toContain('not found');
    });
  });
});
