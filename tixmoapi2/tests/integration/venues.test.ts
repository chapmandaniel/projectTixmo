
// 1. Mock dependencies first
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
  venue: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../src/utils/jwt', () => ({
  verifyAccessToken: jest.fn((token) => {
    if (token === 'admin-token') {
      return { userId: 'admin-id', role: 'ADMIN', email: 'admin@venues.com' };
    }
    if (token === 'user-token') {
      return { userId: 'user-id', role: 'CUSTOMER', email: 'user@venues.com' };
    }
    throw new Error('Invalid token');
  }),
  generateAccessToken: jest.fn(() => 'access-token'),
  generateRefreshToken: jest.fn(() => 'refresh-token'),
}));

// 2. Import app after mocks
import request from 'supertest';
import app from '../../src/app';

describe('Venues API', () => {
  const adminToken = 'admin-token';
  const orgId = '123e4567-e89b-12d3-a456-426614174000';
  const venueId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for user lookup (middleware)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-id',
      role: 'ADMIN',
      email: 'admin@venues.com',
      organizationId: orgId
    });

    // Default mock for org existence check
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: orgId,
    });
  });

  describe('POST /api/v1/venues', () => {
    it('should create a venue with valid data', async () => {
      mockPrisma.venue.create.mockResolvedValue({
        id: venueId,
        name: 'Grand Hall',
        organizationId: orgId,
        capacity: 500,
      });

      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: orgId,
          name: 'Grand Hall',
          capacity: 500,
          address: {
            street: '123 Main St',
            city: 'Metropolis',
            state: 'NY',
            postalCode: '10001',
            country: 'USA'
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(venueId);
    });

    it('should fail if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId: orgId,
          // Missing name
          capacity: 500,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/venues', () => {
    it('should list venues for an organization', async () => {
      mockPrisma.venue.findMany.mockResolvedValue([
        { id: venueId, name: 'Grand Hall', organizationId: orgId }
      ]);
      mockPrisma.venue.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ organizationId: orgId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.venues).toHaveLength(1);
    });
  });

  describe('GET /api/v1/venues/:id', () => {
    it('should get venue details', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        name: 'Grand Hall',
        organizationId: orgId,
        _count: { events: 0 }
      });

      const res = await request(app)
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(venueId);
    });

    it('should return 404 for non-existent venue', async () => {
      mockPrisma.venue.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/venues/123e4567-e89b-12d3-a456-426614174999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/venues/:id', () => {
    it('should update venue details', async () => {
      // Mock findUnique for existence check/authorization
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        organizationId: orgId,
      });

      mockPrisma.venue.update.mockResolvedValue({
        id: venueId,
        name: 'Grand Hall Updated',
        capacity: 600
      });

      const res = await request(app)
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Grand Hall Updated',
          capacity: 600
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Grand Hall Updated');
    });
  });

  describe('DELETE /api/v1/venues/:id', () => {
    it('should delete venue', async () => {
      // Mock findUnique for existence check
      mockPrisma.venue.findUnique.mockResolvedValue({
        id: venueId,
        organizationId: orgId,
        _count: { events: 0 }
      });

      mockPrisma.venue.delete.mockResolvedValue({ id: venueId });

      const res = await request(app)
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });
  });
});
