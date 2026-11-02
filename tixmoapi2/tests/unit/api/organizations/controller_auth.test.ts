import { Response } from 'express';
import { addMember, removeMember } from '../../../../src/api/organizations/controller';
import { organizationService } from '../../../../src/api/organizations/service';
import prisma from '../../../../src/config/prisma';
import { ApiError } from '../../../../src/utils/ApiError';
import { AuthRequest } from '../../../../src/middleware/auth';

// Mock dependencies
jest.mock('../../../../src/api/organizations/service');
jest.mock('../../../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/utils/catchAsync', () => ({
  catchAsync: (fn: any) => (req: any, res: any, next: any) => {
    return fn(req, res, next).catch(next);
  },
}));

// Mock response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('Organization Controller Authorization', () => {
  let req: Partial<AuthRequest>;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      params: { id: 'org-123' },
      body: {},
    };
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('addMember', () => {
    it('should allow a global platform admin to add a member', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.body = { userId: 'new-member-1' };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'admin-1',
          email: 'admin@test.com',
          role: 'ADMIN',
          organizationId: null,
          isPlatformAdmin: true,
        })
        .mockResolvedValueOnce({
          id: 'new-member-1',
          role: 'TEAM_MEMBER',
        });

      await (addMember as any)(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).toHaveBeenCalledWith('org-123', 'new-member-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.json).toHaveBeenCalled();
    });

    it('should allow an organization ADMIN member to add a member', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.body = { userId: 'new-member-1' };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'admin-1',
          email: 'admin@test.com',
          organizationId: 'org-123',
          role: 'ADMIN',
          isPlatformAdmin: false,
        })
        .mockResolvedValueOnce({
          id: 'new-member-1',
          role: 'TEAM_MEMBER',
        });

      await (addMember as any)(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 'admin-1' },
        select: {
          id: true,
          email: true,
          role: true,
          organizationId: true,
          isPlatformAdmin: true,
        },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).toHaveBeenCalledWith('org-123', 'new-member-1');
    });

    it('should forbid an ADMIN who is not a member of the target organization', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.body = { userId: 'new-member-1' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-1',
        email: 'admin@test.com',
        role: 'ADMIN',
        organizationId: 'org-999',
        isPlatformAdmin: false,
      });

      await (addMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).not.toHaveBeenCalled();
    });

    it('should forbid an organization MANAGER from adding a member', async () => {
      req.user = { userId: 'manager-1', role: 'MANAGER' };
      req.body = { userId: 'new-member-1' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'manager-1',
        email: 'manager@test.com',
        organizationId: 'org-123',
        role: 'MANAGER',
        isPlatformAdmin: false,
      });

      await (addMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toContain('sufficient privileges');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).not.toHaveBeenCalled();
    });

    it('should forbid organization promoter from adding member', async () => {
      req.user = { userId: 'promoter-1', role: 'PROMOTER' };
      req.body = { userId: 'new-member-1' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'promoter-1',
        organizationId: 'org-123',
        role: 'PROMOTER',
      });

      await (addMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('should forbid user who is not a member of the organization', async () => {
      req.user = { userId: 'other-user-1', role: 'PROMOTER' };
      req.body = { userId: 'new-member-1' };

      // Mock prisma response saying user is member of DIFFERENT org
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'other-user-1',
        organizationId: 'org-999',
      });

      await (addMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('should call next with Forbidden error if user has no organization', async () => {
      req.user = { userId: 'customer-1', role: 'CUSTOMER' };
      req.body = { userId: 'new-member-1' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'customer-1',
        organizationId: null,
      });

      await (addMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('removeMember', () => {
    it('should allow a global platform admin to remove a member', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.params = { id: 'org-123', userId: 'member-to-remove' };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'admin-1',
          email: 'admin@test.com',
          role: 'ADMIN',
          organizationId: null,
          isPlatformAdmin: true,
        })
        .mockResolvedValueOnce({
          id: 'member-to-remove',
          role: 'TEAM_MEMBER',
        });

      await (removeMember as any)(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.removeMember).toHaveBeenCalledWith('org-123', 'member-to-remove');
    });

    it('should allow an organization OWNER member to remove a member', async () => {
      req.user = { userId: 'owner-1', role: 'OWNER' };
      req.params = { id: 'org-123', userId: 'member-to-remove' };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'owner-1',
          email: 'owner@test.com',
          role: 'OWNER',
          organizationId: 'org-123',
          isPlatformAdmin: false,
        })
        .mockResolvedValueOnce({
          id: 'member-to-remove',
          role: 'TEAM_MEMBER',
        });

      await (removeMember as any)(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.removeMember).toHaveBeenCalledWith('org-123', 'member-to-remove');
    });

    it('should forbid non-member', async () => {
      req.user = { userId: 'hacker', role: 'PROMOTER' };
      req.params = { id: 'org-123', userId: 'member-to-remove' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'hacker',
        organizationId: 'org-666',
      });

      await (removeMember as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
