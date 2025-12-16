import request from 'supertest';
import app from '../../src/app';
import {
  registerUser,
  createOrganization,
  createVenue,
  createEvent,
  cleanupTestData,
  prisma,
} from '../utils/testUtils';

describe('Promo Codes API', () => {
  let authToken: string;
  let organizationId: string;
  let eventId: string;
  let promoCodeId: string;

  beforeAll(async () => {
    // Clean up database in correct order (respecting foreign keys)
    await cleanupTestData();

    // Create test user with PROMOTER role and get auth token
    const reg = await registerUser(app, { email: 'promo-test@example.com', role: 'PROMOTER' });
    authToken = reg.accessToken;

    // Create org, venue, event using helpers
    const org = await createOrganization(app, authToken, {
      name: 'Test Promo Org',
      slug: 'test-promo-org',
    });
    organizationId = org.id;

    const venue = await createVenue(app, authToken, { organizationId });

    const event = await createEvent(app, authToken, {
      organizationId,
      venueId: venue.id,
      title: 'Test Event for Promos',
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/promo-codes', () => {
    it('should create a percentage discount promo code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'SUMMER20',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          organizationId,
          maxUses: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.code).toBe('SUMMER20');
      expect(res.body.data.discountType).toBe('PERCENTAGE');
      expect(parseFloat(res.body.data.discountValue)).toBe(20);
      expect(res.body.data.status).toBe('ACTIVE');

      promoCodeId = res.body.data.id;
    });

    it('should create a fixed amount discount promo code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'SAVE10',
          discountType: 'FIXED_AMOUNT',
          discountValue: 10,
          organizationId,
          eventId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.discountType).toBe('FIXED_AMOUNT');
    });

    it('should create promo code with validity dates', async () => {
      const validFrom = new Date(Date.now()).toISOString();
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'EARLYBIRD',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          organizationId,
          validFrom,
          validUntil,
          minOrderAmount: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('validFrom');
      expect(res.body.data).toHaveProperty('validUntil');
    });

    it('should fail with duplicate code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'SUMMER20',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          organizationId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('should fail with percentage over 100', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TOOLARGE',
          discountType: 'PERCENTAGE',
          discountValue: 150,
          organizationId,
        });

      expect(res.status).toBe(400);
      // Validation error should mention percentage or discount
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post('/api/v1/promo-codes').send({
        code: 'TEST',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        organizationId,
      });

      expect(res.status).toBe(401);
    });

    it('should fail with invalid discount type', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'INVALID2',
          discountType: 'INVALID_TYPE',
          discountValue: 10,
          organizationId,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/promo-codes/:id', () => {
    it('should get promo code by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/promo-codes/${promoCodeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(promoCodeId);
      expect(res.body.data).toHaveProperty('organization');
    });

    it('should fail if promo code not found', async () => {
      const res = await request(app)
        .get('/api/v1/promo-codes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get(`/api/v1/promo-codes/${promoCodeId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/promo-codes/:id', () => {
    let updateCodeId: string;

    beforeEach(async () => {
      // Ensure we have a fresh promo code for each test
      if (!promoCodeId) {
        const res = await request(app)
          .post('/api/v1/promo-codes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: `UPDATE${Date.now()}`,
            discountType: 'PERCENTAGE',
            discountValue: 20,
            organizationId,
          });
        updateCodeId = res.body.data.id;
      } else {
        updateCodeId = promoCodeId;
      }
    });

    it('should update promo code', async () => {
      const res = await request(app)
        .put(`/api/v1/promo-codes/${updateCodeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          discountValue: 25,
          maxUses: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(parseFloat(res.body.data.discountValue)).toBe(25);
      expect(res.body.data.maxUses).toBe(150);
    });

    it('should update promo code status', async () => {
      const res = await request(app)
        .put(`/api/v1/promo-codes/${updateCodeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'DISABLED',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DISABLED');
    });

    it('should fail with percentage over 100', async () => {
      const res = await request(app)
        .put(`/api/v1/promo-codes/${updateCodeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          discountValue: 150,
        });

      expect(res.status).toBe(400);
    });

    it('should fail if promo code not found', async () => {
      const res = await request(app)
        .put('/api/v1/promo-codes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          discountValue: 10,
        });

      expect(res.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).put(`/api/v1/promo-codes/${updateCodeId}`).send({
        discountValue: 10,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/promo-codes', () => {
    beforeAll(async () => {
      // Create additional promo codes
      await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'LIST1',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
        });

      await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'LIST2',
          discountType: 'FIXED_AMOUNT',
          discountValue: 5,
          organizationId,
        });
    });

    it('should list promo codes', async () => {
      const res = await request(app)
        .get('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.promoCodes).toBeInstanceOf(Array);
      expect(res.body.data.promoCodes.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter by organization', async () => {
      const res = await request(app)
        .get(`/api/v1/promo-codes?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.promoCodes.every((p: any) => p.organizationId === organizationId)).toBe(
        true
      );
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/promo-codes?status=ACTIVE')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.promoCodes.every((p: any) => p.status === 'ACTIVE')).toBe(true);
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/v1/promo-codes?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.promoCodes.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.limit).toBe(2);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/promo-codes');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/promo-codes/validate', () => {
    let validCode: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'VALIDATE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          minOrderAmount: 50,
        });

      validCode = res.body.data.code;
    });

    it('should validate a valid promo code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: validCode,
          orderAmount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data).toHaveProperty('discountAmount');
      expect(res.body.data.discountAmount).toBe(10); // 10% of 100
    });

    it('should fail for order below minimum', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: validCode,
          orderAmount: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toContain('Minimum');
    });

    it('should fail for non-existent code', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'NONEXISTENT',
          orderAmount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toContain('not found');
    });

    it('should calculate fixed amount discount correctly', async () => {
      await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'FIXED20',
          discountType: 'FIXED_AMOUNT',
          discountValue: 20,
          organizationId,
        });

      const res = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'FIXED20',
          orderAmount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe(20);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post('/api/v1/promo-codes/validate').send({
        code: validCode,
        orderAmount: 100,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/promo-codes/:id', () => {
    let deleteCodeId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `DELETE${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
        });

      deleteCodeId = res.body.data.id;
    });

    it('should delete unused promo code', async () => {
      const res = await request(app)
        .delete(`/api/v1/promo-codes/${deleteCodeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('should fail if promo code not found', async () => {
      const res = await request(app)
        .delete('/api/v1/promo-codes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).delete(`/api/v1/promo-codes/${deleteCodeId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Additional validation tests', () => {
    it('should fail when validFrom is after validUntil', async () => {
      const validFrom = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const validUntil = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `BADDATES${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          validFrom,
          validUntil,
        });

      expect(res.status).toBe(400);
      // Should fail due to invalid date range
    });

    it('should fail when discountValue is zero', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `ZEROD${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 0,
          organizationId,
        });

      expect(res.status).toBe(400);
    });

    it('should fail when discountValue is negative', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `NEGATIVE${Date.now()}`,
          discountType: 'FIXED_AMOUNT',
          discountValue: -5,
          organizationId,
        });

      expect(res.status).toBe(400);
    });

    it('should fail when code is empty', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
        });

      expect(res.status).toBe(400);
    });

    it('should fail when code is only whitespace', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '   ',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
        });

      expect(res.status).toBe(400);
    });

    it('should fail when maxUses is negative', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `NEGMAX${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          maxUses: -10,
        });

      expect(res.status).toBe(400);
    });

    it('should fail when minOrderAmount is negative', async () => {
      const res = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `NEGMIN${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          minOrderAmount: -50,
        });

      expect(res.status).toBe(400);
    });

    it('should validate expired promo code', async () => {
      const expiredRes = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `EXPIRED${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          validFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(expiredRes.status).toBe(201);
      const expiredCode = expiredRes.body.data.code;

      const validateRes = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: expiredCode,
          orderAmount: 100,
        });

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.data.valid).toBe(false);
      expect(validateRes.body.data.reason).toContain('expired');
    });

    it('should validate promo code not yet valid', async () => {
      const futureRes = await request(app)
        .post('/api/v1/promo-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `FUTURE${Date.now()}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          organizationId,
          validFrom: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(futureRes.status).toBe(201);
      const futureCode = futureRes.body.data.code;

      const validateRes = await request(app)
        .post('/api/v1/promo-codes/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: futureCode,
          orderAmount: 100,
        });

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.data.valid).toBe(false);
      expect(validateRes.body.data.reason).toContain('not yet valid');
    });
  });
});
