import request from 'supertest';

// Mocks must be defined before imports
const mockOrganizationService = {
  getOrganizationById: jest.fn(),
  updateOrganization: jest.fn(),
};

jest.mock('../../src/api/organizations/service', () => ({
  organizationService: mockOrganizationService,
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-123', role: 'CUSTOMER' };
    next();
  },
  authorize: jest.requireActual('../../src/middleware/authorize').authorize,
}));

import app from '../../src/app';

describe('Security: Organization Update Route', () => {
  it('should deny CUSTOMER from updating organization even if they are a member (REGRESSION TEST)', async () => {
    // Mock getOrganizationById to return an org where the user is a member
    mockOrganizationService.getOrganizationById.mockResolvedValue({
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
      users: [{ id: 'user-123' }], // The user is a member
    });

    // Mock updateOrganization to succeed (should not be reached)
    mockOrganizationService.updateOrganization.mockResolvedValue({
      id: 'org-123',
      name: 'Updated Org',
      slug: 'updated-org',
    });

    const response = await request(app).put('/api/v1/organizations/org-123').send({
      name: 'Updated Org',
      slug: 'updated-org',
    });

    // With the fix, this should be 403 because CUSTOMER role is not authorized
    expect(response.status).toBe(403);
    // Also verify mock updateOrganization was NOT called?
    // Wait, middleware blocks before controller, so service method shouldn't be called.
    expect(mockOrganizationService.updateOrganization).not.toHaveBeenCalled();
  });
});
