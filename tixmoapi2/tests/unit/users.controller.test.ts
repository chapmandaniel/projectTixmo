import { listUsers } from '../../src/api/users/controller';
import { userService } from '../../src/api/users/service';
import prisma from '../../src/config/prisma';
import { AuthRequest } from '../../src/middleware/auth';
import { ApiError } from '../../src/utils/ApiError';
import { Response } from 'express';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

jest.mock('../../src/api/users/service', () => ({
    userService: {
        listUsers: jest.fn(),
    },
}));

describe('Users Controller - listUsers', () => {
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

    it('should list users for ADMIN without organization filter restriction', async () => {
        mockReq = {
            user: { userId: 'admin-id', role: 'ADMIN' },
            query: { page: '1', limit: '10' } as any,
        };

        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);

        expect(userService.listUsers).toHaveBeenCalledWith({
            page: '1',
            limit: '10',
        });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should force organization filter for PROMOTER', async () => {
        const mockOrgId = 'org-123';
        mockReq = {
            user: { userId: 'promoter-id', role: 'PROMOTER' },
            query: { page: '1', limit: '10' } as any,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: mockOrgId });
        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'promoter-id' },
            select: { organizationId: true },
        });
        expect(userService.listUsers).toHaveBeenCalledWith(expect.objectContaining({
            page: '1',
            limit: '10',
            organizationId: mockOrgId,
        }));
    });

    it('should throw Forbidden if PROMOTER has no organization', async () => {
        mockReq = {
            user: { userId: 'promoter-no-org-id', role: 'PROMOTER' },
            query: { page: '1', limit: '10' } as any,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: null });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);

        // Wait for the async operation to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(nextMock).toHaveBeenCalledWith(expect.any(ApiError));
        expect(nextMock.mock.calls[0][0].message).toContain('Your account must be associated with an organization');
        expect(userService.listUsers).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to explicitly filter by organization', async () => {
        const explicitOrgId = 'some-org-id';
        mockReq = {
            user: { userId: 'admin-id', role: 'ADMIN' },
            query: { page: '1', limit: '10', organizationId: explicitOrgId } as any,
        };

        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);

        expect(userService.listUsers).toHaveBeenCalledWith({
            page: '1',
            limit: '10',
            organizationId: explicitOrgId,
        });
    });
});
