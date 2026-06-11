import { createUser, listUsers } from '../../src/api/users/controller';
import { userService } from '../../src/api/users/service';
import prisma from '../../src/config/prisma';
import { AuthRequest } from '../../src/middleware/auth';
import { ApiError } from '../../src/utils/ApiError';
import { Response } from 'express';

const flushAsync = () => new Promise(resolve => setImmediate(resolve));

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
        createUser: jest.fn(),
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

    it('should list users for global ADMIN without organization filter restriction', async () => {
        mockReq = {
            user: { userId: 'admin-id', role: 'ADMIN' },
            query: { page: '1', limit: '10' } as any,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: null, role: 'ADMIN' });
        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(userService.listUsers).toHaveBeenCalledWith({
            page: '1',
            limit: '10',
        });
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'admin-id' },
            select: { organizationId: true, role: true },
        });
    });

    it('should force organization filter for PROMOTER', async () => {
        const mockOrgId = 'org-123';
        mockReq = {
            user: { userId: 'promoter-id', role: 'PROMOTER' },
            query: { page: '1', limit: '10' } as any,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: mockOrgId, role: 'PROMOTER' });
        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'promoter-id' },
            select: { organizationId: true, role: true },
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

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: null, role: 'PROMOTER' });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);

        // Wait for the async operation to complete
        await flushAsync();

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

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: null, role: 'ADMIN' });
        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(userService.listUsers).toHaveBeenCalledWith({
            page: '1',
            limit: '10',
            organizationId: explicitOrgId,
        });
    });

    it('should force organization filter for scoped ADMIN', async () => {
        mockReq = {
            user: { userId: 'admin-id', role: 'ADMIN' },
            query: { page: '1', limit: '10', organizationId: 'other-org' } as any,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: 'org-123', role: 'ADMIN' });
        (userService.listUsers as jest.Mock).mockResolvedValue({ users: [], pagination: {} });

        await listUsers(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(userService.listUsers).toHaveBeenCalledWith({
            page: '1',
            limit: '10',
            organizationId: 'org-123',
        });
    });
});

describe('Users Controller - createUser', () => {
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
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ organizationId: 'org-123', role: 'OWNER' });
        (userService.createUser as jest.Mock).mockResolvedValue({
            id: 'new-user',
            email: 'member@example.com',
            firstName: 'Team',
            lastName: 'Member',
            role: 'TEAM_MEMBER',
            organizationId: 'org-123',
        });
    });

    it('passes the trusted dashboard origin to team invitation emails', async () => {
        mockReq = {
            user: { userId: 'owner-id', role: 'OWNER' },
            body: {
                email: 'member@example.com',
                firstName: 'Team',
                lastName: 'Member',
                role: 'TEAM_MEMBER',
            },
            get: jest.fn((header: string) => (
                header.toLowerCase() === 'origin' ? 'https://mightyquinton.tixmo.co' : undefined
            )),
        } as any;

        await createUser(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(userService.createUser).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'member@example.com',
                organizationId: 'org-123',
            }),
            { clientOrigin: 'https://mightyquinton.tixmo.co' }
        );
    });

    it('does not trust Railway request origins for team invitation emails', async () => {
        mockReq = {
            user: { userId: 'owner-id', role: 'OWNER' },
            body: {
                email: 'member@example.com',
                firstName: 'Team',
                lastName: 'Member',
                role: 'TEAM_MEMBER',
            },
            get: jest.fn((header: string) => (
                header.toLowerCase() === 'origin' ? 'https://dash-production-589d.up.railway.app' : undefined
            )),
        } as any;

        await createUser(mockReq as AuthRequest, mockRes as Response, nextMock);
        await flushAsync();

        expect(userService.createUser).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'member@example.com' }),
            { clientOrigin: undefined }
        );
    });
});
