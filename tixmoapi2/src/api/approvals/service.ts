import prisma from '../../config/prisma';
import {
    Prisma,
    ApprovalRequest,
    ApprovalStatus,
    ApprovalDecision,
    ApprovalAsset,
    ApprovalReviewer,
    ApprovalComment
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { uploadService } from '../../services/upload.service';
import { approvalEmailService } from '../../services/approval-email.service';
import { ApiError } from '@utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../../config/logger';

// Token valid for 30 days
const TOKEN_EXPIRY_DAYS = 30;

export interface CreateApprovalData {
    organizationId: string;
    eventId: string;
    createdById: string;
    title: string;
    type?: 'MEDIA' | 'SOCIAL';
    content?: any;
    description?: string;
    instructions?: string;
    priority?: 'STANDARD' | 'URGENT' | 'CRITICAL';
    dueDate?: Date;
}

export interface ReviewerData {
    email: string;
    name?: string;
}

export interface ApprovalWithRelations extends ApprovalRequest {
    assets: ApprovalAsset[];
    reviewers: ApprovalReviewer[];
    comments: (ApprovalComment & { user?: { firstName: string; lastName: string } | null })[];
    event: { id: string; name: string };
    createdBy: { id: string; firstName: string; lastName: string };
}

class ApprovalService {
    /**
     * Generate a secure random token for external reviewer access
     */
    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    /**
     * Get user's organization ID
     */
    async getUserOrganizationId(userId: string): Promise<string | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true },
        });
        return user?.organizationId || null;
    }

    /**
     * Create a new approval request
     */
    async create(data: CreateApprovalData): Promise<ApprovalRequest> {
        // Verify the event belongs to the organization
        const event = await prisma.event.findFirst({
            where: {
                id: data.eventId,
                organizationId: data.organizationId,
            },
        });

        if (!event) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found in your organization');
        }

        return prisma.approvalRequest.create({
            data: {
                organizationId: data.organizationId,
                eventId: data.eventId,
                createdById: data.createdById,
                title: data.title,
                type: data.type || 'MEDIA',
                content: data.content,
                description: data.description,
                instructions: data.instructions,
                priority: data.priority || 'STANDARD',
                dueDate: data.dueDate,
                status: 'DRAFT',
            },
        });
    }

    /**
     * Get approval request by ID with all relations
     */
    async getById(id: string, organizationId: string): Promise<ApprovalWithRelations | null> {
        return prisma.approvalRequest.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                assets: { orderBy: { createdAt: 'desc' } },
                reviewers: { orderBy: { invitedAt: 'desc' } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
                event: { select: { id: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
        }) as Promise<ApprovalWithRelations | null>;
    }

    /**
     * List approval requests with filters
     */
    async list(
        organizationId: string,
        filters: {
            eventId?: string;
            status?: ApprovalStatus;
            page?: number;
            limit?: number;
        }
    ) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;

        const where: Prisma.ApprovalRequestWhereInput = {
            organizationId,
            ...(filters.eventId && { eventId: filters.eventId }),
            ...(filters.status && { status: filters.status }),
        };

        const [approvals, total] = await Promise.all([
            prisma.approvalRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    assets: { take: 1 }, // First asset for thumbnail
                    reviewers: true,
                    event: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { comments: true } },
                },
            }),
            prisma.approvalRequest.count({ where }),
        ]);

        return {
            approvals,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update approval request
     */
    async update(
        id: string,
        organizationId: string,
        data: Partial<Pick<ApprovalRequest, 'title' | 'type' | 'content' | 'description' | 'instructions' | 'priority' | 'dueDate'>>
    ): Promise<ApprovalRequest> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        return prisma.approvalRequest.update({
            where: { id },
            data: data as any,
        });
    }

    /**
     * Delete approval request
     */
    async delete(id: string, organizationId: string): Promise<void> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        // Delete assets from S3
        for (const asset of approval.assets) {
            try {
                await uploadService.deleteFile(asset.s3Key);
            } catch (error) {
                console.error(`Failed to delete S3 asset: ${asset.s3Key}`, error);
            }
        }

        await prisma.approvalRequest.delete({ where: { id } });
    }

    /**
     * Upload assets to an approval request
     */
    async uploadAssets(
        id: string,
        organizationId: string,
        files: Express.Multer.File[]
    ): Promise<ApprovalAsset[]> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const uploadResults = await uploadService.uploadMultiple(files, `approvals/${id}`);

        const assets = await prisma.$transaction(
            uploadResults.map((result) =>
                prisma.approvalAsset.create({
                    data: {
                        approvalRequestId: id,
                        filename: result.filename,
                        originalName: result.originalName,
                        mimeType: result.mimeType,
                        size: result.size,
                        s3Key: result.s3Key,
                        s3Url: result.s3Url,
                        version: approval.version,
                    },
                })
            )
        );

        return assets;
    }

    /**
     * Delete an asset
     */
    async deleteAsset(
        approvalId: string,
        assetId: string,
        organizationId: string
    ): Promise<void> {
        const approval = await this.getById(approvalId, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const asset = approval.assets.find((a) => a.id === assetId);
        if (!asset) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Asset not found');
        }

        await uploadService.deleteFile(asset.s3Key);
        await prisma.approvalAsset.delete({ where: { id: assetId } });
    }

    /**
     * Add reviewers to an approval request
     */
    async addReviewers(
        id: string,
        organizationId: string,
        reviewers: ReviewerData[]
    ): Promise<ApprovalReviewer[]> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

        const createdReviewers: ApprovalReviewer[] = [];

        for (const reviewer of reviewers) {
            // Check if reviewer already exists for this approval
            const existing = await prisma.approvalReviewer.findUnique({
                where: {
                    approvalRequestId_email: {
                        approvalRequestId: id,
                        email: reviewer.email,
                    },
                },
            });

            if (existing) {
                continue; // Skip if already added
            }

            // Check if reviewer is a Tixmo user
            const user = await prisma.user.findUnique({
                where: { email: reviewer.email },
                select: { id: true, firstName: true, lastName: true },
            });

            const created = await prisma.approvalReviewer.create({
                data: {
                    approvalRequestId: id,
                    email: reviewer.email,
                    name: reviewer.name || (user ? `${user.firstName} ${user.lastName}` : undefined),
                    userId: user?.id,
                    token: this.generateToken(),
                    tokenExpiresAt,
                },
            });

            createdReviewers.push(created);
        }

        // If approval is already active, send review requests to new reviewers
        if (approval.status !== 'DRAFT' && createdReviewers.length > 0) {
            const requester = await prisma.user.findUnique({
                where: { id: approval.createdBy.id },
                select: { firstName: true, lastName: true, email: true },
            });

            if (requester) {
                const approvalData = {
                    title: approval.title,
                    eventName: approval.event.name,
                    description: approval.description || undefined,
                    priority: approval.priority as 'STANDARD' | 'URGENT' | 'CRITICAL',
                    dueDate: approval.dueDate || undefined,
                };
                const reviewerInfos = createdReviewers.map((r) => ({
                    email: r.email,
                    name: r.name || undefined,
                    token: r.token,
                }));

                approvalEmailService
                    .sendReviewRequestsToAll(reviewerInfos, requester, approvalData)
                    .catch((err) => logger.error('Failed to send review request emails to new reviewers:', err));
            }
        }

        return createdReviewers;
    }

    /**
     * Remove a reviewer
     */
    async removeReviewer(
        approvalId: string,
        reviewerId: string,
        organizationId: string
    ): Promise<void> {
        const approval = await this.getById(approvalId, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const reviewer = approval.reviewers.find((r) => r.id === reviewerId);
        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Reviewer not found');
        }

        await prisma.approvalReviewer.delete({ where: { id: reviewerId } });
    }

    /**
     * Submit approval for review
     */
    async submitForReview(id: string, organizationId: string): Promise<ApprovalRequest> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        if (approval.reviewers.length === 0) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one reviewer is required');
        }

        if (approval.assets.length === 0) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one asset is required');
        }

        const updated = await prisma.approvalRequest.update({
            where: { id },
            data: { status: 'PENDING' },
        });

        // Send review request emails to all reviewers (non-blocking)
        const requester = await prisma.user.findUnique({
            where: { id: approval.createdBy.id },
            select: { firstName: true, lastName: true, email: true },
        });

        if (requester) {
            const approvalData = {
                title: approval.title,
                eventName: approval.event.name,
                description: approval.description || undefined,
                priority: approval.priority as 'STANDARD' | 'URGENT' | 'CRITICAL',
                dueDate: approval.dueDate || undefined,
            };
            const reviewerInfos = approval.reviewers.map((r) => ({
                email: r.email,
                name: r.name || undefined,
                token: r.token,
            }));

            approvalEmailService
                .sendReviewRequestsToAll(reviewerInfos, requester, approvalData)
                .catch((err) => logger.error('Failed to send review request emails:', err));
        }

        return updated;
    }

    /**
     * Add a comment to an approval request
     */
    async addComment(
        approvalId: string,
        userId: string,
        data: {
            content: string;
            assetId?: string;
            annotation?: object;
        }
    ): Promise<ApprovalComment> {
        return prisma.approvalComment.create({
            data: {
                approvalRequestId: approvalId,
                userId,
                content: data.content,
                assetId: data.assetId,
                annotation: data.annotation as Prisma.InputJsonValue,
            },
            include: {
                user: { select: { firstName: true, lastName: true } },
            },
        });
    }

    /**
     * Get approval by reviewer token (for external access)
     */
    async getByToken(token: string): Promise<{
        approval: ApprovalWithRelations;
        reviewer: ApprovalReviewer;
    } | null> {
        const reviewer = await prisma.approvalReviewer.findUnique({
            where: { token },
            include: {
                approvalRequest: {
                    include: {
                        assets: { orderBy: { createdAt: 'desc' } },
                        reviewers: { orderBy: { invitedAt: 'desc' } },
                        comments: {
                            orderBy: { createdAt: 'asc' },
                            include: { user: { select: { firstName: true, lastName: true } } },
                        },
                        event: { select: { id: true, name: true } },
                        createdBy: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });

        if (!reviewer) {
            return null;
        }

        // Check if token is expired
        if (new Date() > reviewer.tokenExpiresAt) {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Review link has expired');
        }

        // Mark as viewed if first time
        if (!reviewer.viewedAt) {
            await prisma.approvalReviewer.update({
                where: { id: reviewer.id },
                data: { viewedAt: new Date() },
            });
        }

        return {
            approval: reviewer.approvalRequest as ApprovalWithRelations,
            reviewer,
        };
    }

    /**
     * Submit decision from external reviewer
     */
    async submitDecision(
        token: string,
        decision: ApprovalDecision,
        note?: string
    ): Promise<ApprovalReviewer> {
        const result = await this.getByToken(token);
        if (!result) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid review link');
        }

        const { reviewer, approval } = result;
        return this._submitReviewerDecision(reviewer, approval, decision, note);
    }

    /**
     * Submit decision from authenticated user
     */
    async submitAuthenticatedDecision(
        approvalId: string,
        userId: string,
        decision: ApprovalDecision,
        note?: string
    ): Promise<ApprovalReviewer> {
        // Find reviewer by approvalId and userId
        let reviewer = await prisma.approvalReviewer.findFirst({
            where: {
                approvalRequestId: approvalId,
                userId: userId,
            },
        });

        // If not found by userId, try to find by email
        if (!reviewer) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });
            if (user) {
                reviewer = await prisma.approvalReviewer.findUnique({
                    where: {
                        approvalRequestId_email: {
                            approvalRequestId: approvalId,
                            email: user.email,
                        },
                    },
                });
            }
        }

        if (!reviewer) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a reviewer for this approval request');
        }

        const approval = await prisma.approvalRequest.findUnique({
            where: { id: approvalId },
            include: {
                assets: { orderBy: { createdAt: 'desc' } },
                reviewers: { orderBy: { invitedAt: 'desc' } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
                event: { select: { id: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
        }) as ApprovalWithRelations | null;

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        return this._submitReviewerDecision(reviewer, approval, decision, note);
    }

    /**
     * Internal helper to process reviewer decision
     */
    private async _submitReviewerDecision(
        reviewer: ApprovalReviewer,
        approval: ApprovalWithRelations,
        decision: ApprovalDecision,
        note?: string
    ): Promise<ApprovalReviewer> {
        // Update reviewer decision
        const updatedReviewer = await prisma.approvalReviewer.update({
            where: { id: reviewer.id },
            data: {
                decision,
                decisionAt: new Date(),
                decisionNote: note,
            },
        });

        // Check if all reviewers have decided to update overall status
        const allReviewers = await prisma.approvalReviewer.findMany({
            where: { approvalRequestId: approval.id },
        });

        const allDecided = allReviewers.every((r) => r.decision !== null);

        if (allDecided) {
            // Determine overall status
            const hasRejection = allReviewers.some((r) => r.decision === 'REJECTED');
            const hasChangesRequested = allReviewers.some((r) => r.decision === 'CHANGES_REQUESTED');

            let newStatus: ApprovalStatus;
            if (hasRejection) {
                newStatus = 'REJECTED';
            } else if (hasChangesRequested) {
                newStatus = 'CHANGES_REQUESTED';
            } else {
                newStatus = 'APPROVED';
            }

            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: { status: newStatus },
            });
        }

        // Send decision notification to requester (non-blocking)
        const requesterInfo = await prisma.user.findUnique({
            where: { id: approval.createdBy.id },
            select: { firstName: true, lastName: true, email: true },
        });
        if (requesterInfo) {
            approvalEmailService.sendDecisionNotification(
                requesterInfo,
                { name: reviewer.name || undefined, email: reviewer.email },
                {
                    title: approval.title,
                    eventName: approval.event.name,
                    priority: approval.priority as 'STANDARD' | 'URGENT' | 'CRITICAL',
                },
                approval.id,
                decision,
                note
            ).catch((err) => logger.error('Failed to send decision notification:', err));
        }

        return updatedReviewer;
    }

    /**
     * Add comment from external reviewer
     */
    async addExternalComment(
        token: string,
        data: {
            content: string;
            assetId?: string;
            annotation?: object;
        }
    ): Promise<ApprovalComment> {
        const result = await this.getByToken(token);
        if (!result) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid review link');
        }

        return prisma.approvalComment.create({
            data: {
                approvalRequestId: result.approval.id,
                reviewerId: result.reviewer.id,
                content: data.content,
                assetId: data.assetId,
                annotation: data.annotation as Prisma.InputJsonValue,
            },
        });
    }

    /**
     * Create a new revision (increment version and reset reviewer decisions)
     */
    async createRevision(id: string, organizationId: string): Promise<ApprovalRequest> {
        const approval = await this.getById(id, organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        // Reset all reviewer decisions and update token expiry
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

        await prisma.approvalReviewer.updateMany({
            where: { approvalRequestId: id },
            data: {
                decision: null,
                decisionAt: null,
                decisionNote: null,
                tokenExpiresAt,
            },
        });

        // Increment version and set back to pending
        const updated = await prisma.approvalRequest.update({
            where: { id },
            data: {
                version: approval.version + 1,
                status: 'DRAFT',
            },
        });

        // Send revision notifications to all reviewers (non-blocking)
        const requesterInfo = await prisma.user.findUnique({
            where: { id: approval.createdBy.id },
            select: { firstName: true, lastName: true, email: true },
        });
        const updatedReviewers = await prisma.approvalReviewer.findMany({
            where: { approvalRequestId: id },
        });
        if (requesterInfo) {
            const reviewerInfos = updatedReviewers.map((r) => ({
                email: r.email,
                name: r.name || undefined,
                token: r.token,
            }));
            approvalEmailService.sendRevisionNotification(
                reviewerInfos,
                requesterInfo,
                {
                    title: approval.title,
                    eventName: approval.event.name,
                    priority: approval.priority as 'STANDARD' | 'URGENT' | 'CRITICAL',
                    version: updated.version,
                }
            ).catch((err) => logger.error('Failed to send revision notifications:', err));
        }

        return updated;
    }
}

export const approvalService = new ApprovalService();
