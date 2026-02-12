// 1. Mock dependencies first
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../src/utils/jwt', () => ({
  verifyAccessToken: jest.fn((token) => {
    if (token === 'admin-token') {
      return { userId: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };
    }
    if (token === 'customer-token') {
      return { userId: 'customer-id', role: 'CUSTOMER', email: 'customer@test.com' };
    }
    throw new Error('Invalid token');
  }),
}));

// 2. Import app and prisma after mocks are set up
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';

describe('Organizations Routes Security', () => {
  beforeAll(() => {
    // Setup default mock implementation for prisma
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.organization.count as jest.Mock).mockResolvedValue(0);
  });

  describe('GET /api/v1/organizations', () => {
    it('should allow admin to list organizations', async () => {
      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should forbid customer from listing organizations', async () => {
      const res = await request(app)
        .get('/api/v1/organizations')
        .set('Authorization', 'Bearer customer-token');

      // This expectation will fail currently (it returns 200), demonstrating the vulnerability
      expect(res.status).toBe(403);
    });
  });
});
