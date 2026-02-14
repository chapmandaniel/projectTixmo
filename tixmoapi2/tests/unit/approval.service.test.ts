import { approvalService } from '../../src/api/approvals/service';
import prisma from '../../src/config/prisma';
import { approvalEmailService } from '../../src/services/approval-email.service';
import { ApiError } from '../../src/utils/ApiError';
import { StatusCodes } from 'http-status-codes';

// Mock dependencies
jest.mock('../../src/config/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
        event: {
            findFirst: jest.fn(),
        },
        approvalRequest: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        approvalAsset: {
            create: jest.fn(),
            delete: jest.fn(),
        },
        approvalReviewer: {
            findUnique: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        approvalComment: {
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback),
    },
}));

jest.mock('../../src/services/upload.service', () => ({
    uploadService: {
        uploadMultiple: jest.fn(),
        deleteFile: jest.fn(),
    },
}));

jest.mock('../../src/services/approval-email.service', () => ({
    approvalEmailService: {
        sendReviewRequestsToAll: jest.fn().mockResolvedValue(undefined),
        sendDecisionNotification: jest.fn().mockResolvedValue(true),
        sendRevisionNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../src/config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('ApprovalService', () => {
    const mockOrgId = 'org-123';
    const mockUserId = 'user-123';
    const mockEventId = 'event-123';
    const mockApprovalId = 'approval-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create an approval request if event belongs to organization', async () => {
            (prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: mockEventId });
            (prisma.approvalRequest.create as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                eventId: mockEventId,
                createdById: mockUserId,
                title: 'Test Approval',
                status: 'DRAFT',
            });

            const data = {
                organizationId: mockOrgId,
                eventId: mockEventId,
                createdById: mockUserId,
                title: 'Test Approval',
            };

            const result = await approvalService.create(data);

            expect(prisma.event.findFirst).toHaveBeenCalledWith({
                where: { id: mockEventId, organizationId: mockOrgId },
            });
            expect(prisma.approvalRequest.create).toHaveBeenCalled();
            expect(result).toHaveProperty('id', mockApprovalId);
        });

        it('should throw NOT_FOUND if event does not belong to organization', async () => {
            (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

            const data = {
                organizationId: mockOrgId,
                eventId: mockEventId,
                createdById: mockUserId,
                title: 'Test Approval',
            };

            await expect(approvalService.create(data)).rejects.toThrow(ApiError);
            await expect(approvalService.create(data)).rejects.toHaveProperty('statusCode', StatusCodes.NOT_FOUND);
        });
    });

    describe('addReviewers', () => {
        const mockReviewers = [{ email: 'reviewer@example.com', name: 'Reviewer' }];

        it('should add reviewers successfully', async () => {
            // Mock getById to return approval
            (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                status: 'DRAFT',
            });

            // Mock user lookup
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            // Mock reviewer existence check
            (prisma.approvalReviewer.findUnique as jest.Mock).mockResolvedValue(null);

            // Mock creation
            (prisma.approvalReviewer.create as jest.Mock).mockImplementation((args) => ({
                id: 'reviewer-1',
                ...args.data,
            }));

            const result = await approvalService.addReviewers(mockApprovalId, mockOrgId, mockReviewers);

            expect(result).toHaveLength(1);
            expect(prisma.approvalReviewer.create).toHaveBeenCalled();
            // Should NOT send email because status is DRAFT
            expect(approvalEmailService.sendReviewRequestsToAll).not.toHaveBeenCalled();
        });

        it('should send email if adding reviewers to PENDING approval', async () => {
             // Mock getById to return PENDING approval
             (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                status: 'PENDING',
                title: 'Test Approval',
                priority: 'STANDARD',
                event: { name: 'Test Event' },
                createdBy: { id: 'creator-id', firstName: 'John', lastName: 'Doe' },
                assets: [],
                reviewers: [],
                comments: [],
            });

            // Mock user lookup implementation
            (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
                if (args.where.id === 'creator-id') {
                    return Promise.resolve({ firstName: 'Requester', lastName: 'User', email: 'requester@example.com' });
                }
                return Promise.resolve(null);
            });

            // Mock reviewer existence check
            (prisma.approvalReviewer.findUnique as jest.Mock).mockResolvedValue(null);

             // Mock creation
             (prisma.approvalReviewer.create as jest.Mock).mockImplementation((args) => ({
                id: 'reviewer-1',
                ...args.data,
            }));

            await approvalService.addReviewers(mockApprovalId, mockOrgId, mockReviewers);

            // Expect email service to be called with correct requester info
            expect(approvalEmailService.sendReviewRequestsToAll).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ email: 'requester@example.com' }),
                expect.any(Object)
            );
        });
    });

    describe('submitForReview', () => {
        it('should submit for review and send emails', async () => {
             (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                status: 'DRAFT',
                title: 'Test Approval',
                priority: 'STANDARD',
                event: { name: 'Test Event' },
                createdBy: { id: 'creator-id', firstName: 'John', lastName: 'Doe' },
                assets: [{ id: 'asset-1' }],
                reviewers: [{ id: 'reviewer-1', email: 'test@example.com', token: 'token' }],
                comments: [],
            });

            (prisma.approvalRequest.update as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                status: 'PENDING',
            });

            // Mock requester lookup
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ firstName: 'Requester', lastName: 'User', email: 'requester@example.com' });


            await approvalService.submitForReview(mockApprovalId, mockOrgId);

            expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: { status: 'PENDING' },
            });
            expect(approvalEmailService.sendReviewRequestsToAll).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ email: 'requester@example.com' }),
                expect.any(Object)
            );
        });

        it('should throw BAD_REQUEST if no reviewers', async () => {
             (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                status: 'DRAFT',
                assets: [{ id: 'asset-1' }],
                reviewers: [],
            });

            await expect(approvalService.submitForReview(mockApprovalId, mockOrgId)).rejects.toThrow(ApiError);
            await expect(approvalService.submitForReview(mockApprovalId, mockOrgId)).rejects.toHaveProperty('statusCode', StatusCodes.BAD_REQUEST);
        });
    });

    describe('submitDecision', () => {
        const mockToken = 'valid-token';
        const mockReviewerId = 'reviewer-1';

        beforeEach(() => {
             // Mock getByToken
             (prisma.approvalReviewer.findUnique as jest.Mock).mockResolvedValue({
                id: mockReviewerId,
                token: mockToken,
                tokenExpiresAt: new Date(Date.now() + 100000),
                approvalRequest: {
                    id: mockApprovalId,
                    title: 'Test',
                    priority: 'STANDARD',
                    event: { name: 'Event' },
                    createdBy: { id: mockUserId },
                    assets: [],
                    reviewers: [],
                    comments: [],
                }
            });

            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                firstName: 'John', lastName: 'Doe', email: 'owner@example.com'
            });
        });

        it('should update decision and NOT update status if other reviewers are pending', async () => {
            (prisma.approvalReviewer.update as jest.Mock).mockResolvedValue({});

            // Mock finding all reviewers - one is pending
            (prisma.approvalReviewer.findMany as jest.Mock).mockResolvedValue([
                { id: 'reviewer-1', decision: 'APPROVED' },
                { id: 'reviewer-2', decision: null },
            ]);

            await approvalService.submitDecision(mockToken, 'APPROVED');

            expect(prisma.approvalReviewer.update).toHaveBeenCalled();
            expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
            expect(approvalEmailService.sendDecisionNotification).toHaveBeenCalled();
        });

        it('should update decision and update status to APPROVED if all approved', async () => {
            (prisma.approvalReviewer.update as jest.Mock).mockResolvedValue({});

            // Mock finding all reviewers - all approved
            (prisma.approvalReviewer.findMany as jest.Mock).mockResolvedValue([
                { id: 'reviewer-1', decision: 'APPROVED' },
                { id: 'reviewer-2', decision: 'APPROVED' },
            ]);

            await approvalService.submitDecision(mockToken, 'APPROVED');

            expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: { status: 'APPROVED' },
            });
            expect(approvalEmailService.sendDecisionNotification).toHaveBeenCalled();
        });

        it('should update decision and update status to REJECTED if any rejected', async () => {
            (prisma.approvalReviewer.update as jest.Mock).mockResolvedValue({});

            // Mock finding all reviewers - all decided, one rejected
            (prisma.approvalReviewer.findMany as jest.Mock).mockResolvedValue([
                { id: 'reviewer-1', decision: 'APPROVED' },
                { id: 'reviewer-2', decision: 'REJECTED' },
            ]);

            await approvalService.submitDecision(mockToken, 'APPROVED');

             expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: { status: 'REJECTED' },
            });
            expect(approvalEmailService.sendDecisionNotification).toHaveBeenCalled();
        });
    });

    describe('createRevision', () => {
        it('should create revision and send emails', async () => {
            (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                version: 1,
                createdBy: { id: mockUserId },
                event: { name: 'Event' },
                title: 'Title',
                priority: 'STANDARD',
                assets: [],
                reviewers: [],
                comments: [],
            });

            (prisma.approvalReviewer.updateMany as jest.Mock).mockResolvedValue({});
            (prisma.approvalRequest.update as jest.Mock).mockResolvedValue({ version: 2 });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ firstName: 'Requester', lastName: 'User', email: 'req@example.com' });
            (prisma.approvalReviewer.findMany as jest.Mock).mockResolvedValue([{ email: 'rev@example.com', token: 'token' }]);

            await approvalService.createRevision(mockApprovalId, mockOrgId);

            expect(prisma.approvalReviewer.updateMany).toHaveBeenCalled();
            expect(prisma.approvalRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: mockApprovalId },
                data: expect.objectContaining({ version: 2, status: 'DRAFT' })
            }));
            expect(approvalEmailService.sendRevisionNotification).toHaveBeenCalled();
        });
    });

    describe('removeReviewer', () => {
        it('should remove reviewer', async () => {
             (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue({
                id: mockApprovalId,
                organizationId: mockOrgId,
                status: 'DRAFT',
                reviewers: [{ id: 'reviewer-1' }],
            });

            (prisma.approvalReviewer.delete as jest.Mock).mockResolvedValue({});

            await approvalService.removeReviewer(mockApprovalId, 'reviewer-1', mockOrgId);

            expect(prisma.approvalReviewer.delete).toHaveBeenCalledWith({ where: { id: 'reviewer-1' } });
        });
    });
});
