import { removeMember, addMember } from '../../src/api/organizations/controller';
import { organizationService } from '../../src/api/organizations/service';
import prisma from '../../src/config/prisma';
import { AuthRequest } from '../../src/middleware/auth';
import { Response } from 'express';
import { ApiError } from '../../src/utils/ApiError';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/api/organizations/service', () => ({
  organizationService: {
    removeMember: jest.fn(),
    addMember: jest.fn(),
  },
}));

// Mock catchAsync to just execute the function directly for testing
jest.mock('../../src/utils/catchAsync', () => ({
  catchAsync: (fn: any) => fn,
}));

describe('Organizations Controller - removeMember', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  const nextMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: jest.fn().mockReturnThis(),
    };
  });

  it('should FORBID regular member (CUSTOMER) from removing another member', async () => {
    const orgId = 'org-123';
    const victimId = 'victim-456';
    const attackerId = 'attacker-789';

    mockReq = {
      params: { id: orgId, userId: victimId },
      user: { userId: attackerId, role: 'CUSTOMER' },
    };

    // Mock that the attacker belongs to the organization but has CUSTOMER role
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      organizationId: orgId,
      role: 'CUSTOMER',
    });

    // Use a wrapper to catch the error since catchAsync mock doesn't catch it
    let error;
    try {
      await removeMember(mockReq as AuthRequest, mockRes as Response, nextMock);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect((error as ApiError).message).toContain('sufficient privileges');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.removeMember).not.toHaveBeenCalled();
  });

  it('should ALLOW PROMOTER to remove a member', async () => {
    const orgId = 'org-123';
    const victimId = 'victim-456';
    const promoterId = 'promoter-789';

    mockReq = {
      params: { id: orgId, userId: victimId },
      user: { userId: promoterId, role: 'PROMOTER' },
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      organizationId: orgId,
      role: 'PROMOTER',
    });

    await removeMember(mockReq as AuthRequest, mockRes as Response, nextMock);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.removeMember).toHaveBeenCalledWith(orgId, victimId);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Member removed successfully',
      })
    );
  });

  it('should ALLOW OWNER to remove a member', async () => {
    const orgId = 'org-123';
    const victimId = 'victim-456';
    const ownerId = 'owner-789';

    mockReq = {
      params: { id: orgId, userId: victimId },
      user: { userId: ownerId, role: 'OWNER' },
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      organizationId: orgId,
      role: 'OWNER',
    });

    await removeMember(mockReq as AuthRequest, mockRes as Response, nextMock);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.removeMember).toHaveBeenCalledWith(orgId, victimId);
  });
});

describe('Organizations Controller - addMember', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  const nextMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: jest.fn().mockReturnThis(),
    };
  });

  it('should FORBID regular member (CUSTOMER) from adding another member', async () => {
    const orgId = 'org-123';
    const newMemberId = 'new-456';
    const attackerId = 'attacker-789';

    mockReq = {
      params: { id: orgId },
      body: { userId: newMemberId },
      user: { userId: attackerId, role: 'CUSTOMER' },
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      organizationId: orgId,
      role: 'CUSTOMER',
    });

    let error;
    try {
      await addMember(mockReq as AuthRequest, mockRes as Response, nextMock);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect((error as ApiError).message).toContain('sufficient privileges');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(organizationService.addMember).not.toHaveBeenCalled();
  });
});
