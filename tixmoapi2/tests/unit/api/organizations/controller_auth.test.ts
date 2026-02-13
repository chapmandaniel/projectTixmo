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
    it('should allow ADMIN to add member', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.body = { userId: 'new-member-1' };

      await (addMember as any)(req as AuthRequest, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).toHaveBeenCalledWith('org-123', 'new-member-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.json).toHaveBeenCalled();
    });

    it('should allow organization member (PROMOTER) to add member', async () => {
      req.user = { userId: 'promoter-1', role: 'PROMOTER' };
      req.body = { userId: 'new-member-1' };

      // Mock prisma response saying user is member of org-123
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'promoter-1',
        organizationId: 'org-123',
        role: 'PROMOTER',
      });

      await (addMember as any)(req as AuthRequest, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'promoter-1' },
        select: { organizationId: true, role: true },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(organizationService.addMember).toHaveBeenCalledWith('org-123', 'new-member-1');
    });

    it('should forbid user who is not a member of the organization', async () => {
      req.user = { userId: 'other-user-1', role: 'PROMOTER' };
      req.body = { userId: 'new-member-1' };

      // Mock prisma response saying user is member of DIFFERENT org
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'other-user-1',
        organizationId: 'org-999',
      });

      await (addMember as any)(req as AuthRequest, res, next);

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

      await (addMember as any)(req as AuthRequest, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('removeMember', () => {
    it('should allow ADMIN to remove member', async () => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      req.params = { id: 'org-123', userId: 'member-to-remove' };

      await (removeMember as any)(req as AuthRequest, res, next);

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

      await (removeMember as any)(req as AuthRequest, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
