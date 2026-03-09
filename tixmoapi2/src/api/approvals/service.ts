import {
    ApprovalDecision,
    ApprovalReminderType,
    ApprovalRequest,
    ApprovalReviewer,
    ApprovalStatus,
    Prisma,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { StatusCodes } from 'http-status-codes';
import prisma from '../../config/prisma';
import { logger } from '../../config/logger';
import { uploadService } from '../../services/upload.service';
import { approvalEmailService } from '../../services/approval-email.service';
import { ApiError } from '../../utils/ApiError';

const TOKEN_EXPIRY_DAYS = 30;
const APPROACHING_DEADLINE_WINDOW_HOURS = 72;
const REMINDER_AFTER_24_HOURS_MS = 24 * 60 * 60 * 1000;
const REMINDER_BEFORE_48_HOURS_MS = 48 * 60 * 60 * 1000;
const REMINDER_BEFORE_24_HOURS_MS = 24 * 60 * 60 * 1000;

const approvalDetailInclude = {
    event: { select: { id: true, name: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    reviewers: {
        orderBy: { createdAt: 'asc' as const },
    },
    revisions: {
        orderBy: { revisionNumber: 'desc' as const },
        include: {
            assets: { orderBy: { createdAt: 'asc' as const } },
            uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            decisions: {
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            reviewerType: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' as const },
            },
            comments: {
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                    reviewer: { select: { id: true, email: true, name: true, reviewerType: true } },
                },
                orderBy: { createdAt: 'asc' as const },
            },
            reminders: true,
        },
    },
    comments: {
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            reviewer: { select: { id: true, email: true, name: true, reviewerType: true } },
        },
        orderBy: { createdAt: 'asc' as const },
    },
    decisions: {
        include: {
            reviewer: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    reviewerType: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' as const },
    },
} satisfies Prisma.ApprovalRequestInclude;

type ApprovalDetailRecord = Prisma.ApprovalRequestGetPayload<{
    include: typeof approvalDetailInclude;
}>;

export interface ReviewerInput {
    email: string;
    name?: string;
}

export interface CreateApprovalInput {
    organizationId: string;
    createdById: string;
    eventId: string;
    title: string;
    description?: string;
    deadline: Date;
    reviewers: ReviewerInput[];
    files: Express.Multer.File[];
}

export interface CreateRevisionInput {
    summary?: string;
    files: Express.Multer.File[];
}

export interface ApprovalListFilters {
    eventId?: string;
    status?: ApprovalStatus;
    assignedToMe?: boolean;
    approachingDeadline?: boolean;
    sortBy?: 'deadline' | 'submittedAt';
    page?: number;
    limit?: number;
}

export interface ApprovalCommentInput {
    content: string;
    revisionId?: string;
    parentCommentId?: string;
}

export interface DecisionInput {
    decision: ApprovalDecision;
    note?: string;
    revisionId?: string;
}

interface UserContext {
    id: string;
    email: string;
    organizationId: string;
    firstName: string;
    lastName: string;
}

interface ReminderCandidate {
    approvalId: string;
    revisionId: string;
    reviewerId: string;
    reminderType: ApprovalReminderType;
}

class ApprovalService {
    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    private buildTokenExpiry(deadline: Date): Date {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + TOKEN_EXPIRY_DAYS);
        return deadline < fallback ? deadline : fallback;
    }

    private assertFutureDeadline(deadline: Date): void {
        if (Number.isNaN(deadline.getTime())) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'Deadline must be a valid date');
        }
        if (deadline <= new Date()) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'Deadline must be in the future');
        }
    }

    private async getUserContext(userId: string): Promise<UserContext> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                organizationId: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user || !user.organizationId) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'User does not belong to an organization');
        }

        return {
            id: user.id,
            email: user.email,
            organizationId: user.organizationId,
            firstName: user.firstName,
            lastName: user.lastName,
        };
    }

    async getUserOrganizationId(userId: string): Promise<string | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true },
        });

        return user?.organizationId || null;
    }

    private async getApprovalDetailRecord(
        approvalId: string,
        organizationId: string
    ): Promise<ApprovalDetailRecord | null> {
        return prisma.approvalRequest.findFirst({
            where: {
                id: approvalId,
                organizationId,
            },
            include: approvalDetailInclude,
        });
    }

    private getLatestRevision(approval: ApprovalDetailRecord) {
        const latestRevision = approval.revisions[0];
        if (!latestRevision) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Approval request is missing a revision');
        }
        return latestRevision;
    }

    private serializeComment(comment: ApprovalDetailRecord['comments'][number]) {
        return {
            id: comment.id,
            revisionId: comment.approvalRevisionId,
            parentCommentId: comment.parentCommentId,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            author: comment.user
                ? {
                    type: 'INTERNAL',
                    id: comment.user.id,
                    name: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
                    email: comment.user.email,
                }
                : comment.reviewer
                    ? {
                        type: comment.reviewer.reviewerType,
                        id: comment.reviewer.id,
                        name: comment.reviewer.name || comment.reviewer.email,
                        email: comment.reviewer.email,
                    }
                    : null,
        };
    }

    private serializeApproval(approval: ApprovalDetailRecord, viewer?: { email?: string; reviewerId?: string }) {
        const latestRevision = this.getLatestRevision(approval);
        const comments = approval.comments.map((comment) => this.serializeComment(comment));

        return {
            id: approval.id,
            title: approval.title,
            description: approval.description,
            status: approval.status,
            deadline: approval.deadline,
            submittedAt: approval.submittedAt,
            completedAt: approval.completedAt,
            lastCommentAt: approval.lastCommentAt,
            latestRevisionNumber: approval.latestRevisionNumber,
            event: approval.event,
            createdBy: approval.createdBy,
            reviewers: approval.reviewers.map((reviewer) => {
                const latestDecision = latestRevision.decisions.find((decision) => decision.reviewerId === reviewer.id);
                return {
                    id: reviewer.id,
                    email: reviewer.email,
                    name: reviewer.name,
                    reviewerType: reviewer.reviewerType,
                    firstViewedAt: reviewer.firstViewedAt,
                    lastViewedAt: reviewer.lastViewedAt,
                    lastCommentAt: reviewer.lastCommentAt,
                    lastDecisionAt: reviewer.lastDecisionAt,
                    lastInteractionAt: reviewer.lastInteractionAt,
                    hasInteractedWithLatestRevision:
                        reviewer.lastInteractionRevisionNumber === latestRevision.revisionNumber,
                    latestDecision: latestDecision
                        ? {
                            decision: latestDecision.decision,
                            note: latestDecision.note,
                            createdAt: latestDecision.createdAt,
                        }
                        : null,
                };
            }),
            revisions: approval.revisions.map((revision) => ({
                id: revision.id,
                revisionNumber: revision.revisionNumber,
                summary: revision.summary,
                createdAt: revision.createdAt,
                uploadedBy: revision.uploadedBy,
                assets: revision.assets.map((asset) => ({
                    id: asset.id,
                    filename: asset.filename,
                    originalName: asset.originalName,
                    mimeType: asset.mimeType,
                    size: asset.size,
                    s3Url: asset.s3Url,
                    createdAt: asset.createdAt,
                })),
                commentCount: revision.comments.length,
                decisions: revision.decisions.map((decision) => ({
                    id: decision.id,
                    reviewerId: decision.reviewerId,
                    decision: decision.decision,
                    note: decision.note,
                    createdAt: decision.createdAt,
                    reviewer: decision.reviewer,
                })),
            })),
            latestRevision: {
                id: latestRevision.id,
                revisionNumber: latestRevision.revisionNumber,
                summary: latestRevision.summary,
                createdAt: latestRevision.createdAt,
                uploadedBy: latestRevision.uploadedBy,
                assets: latestRevision.assets.map((asset) => ({
                    id: asset.id,
                    filename: asset.filename,
                    originalName: asset.originalName,
                    mimeType: asset.mimeType,
                    size: asset.size,
                    s3Url: asset.s3Url,
                    createdAt: asset.createdAt,
                })),
                comments: comments.filter((comment) => comment.revisionId === latestRevision.id),
                decisions: latestRevision.decisions.map((decision) => ({
                    id: decision.id,
                    reviewerId: decision.reviewerId,
                    decision: decision.decision,
                    note: decision.note,
                    createdAt: decision.createdAt,
                    reviewer: decision.reviewer,
                })),
            },
            comments,
            myReview: viewer
                ? latestRevision.decisions
                    .filter((decision) =>
                        viewer.reviewerId
                            ? decision.reviewerId === viewer.reviewerId
                            : decision.reviewer.email === viewer.email
                    )
                    .map((decision) => ({
                        id: decision.id,
                        decision: decision.decision,
                        note: decision.note,
                        createdAt: decision.createdAt,
                    }))[0] || null
                : null,
        };
    }

    private async resolveReviewers(
        organizationId: string,
        reviewers: ReviewerInput[],
        deadline: Date
    ) {
        const deduped = [...new Map(
            reviewers.map((reviewer) => [
                reviewer.email.trim().toLowerCase(),
                {
                    email: reviewer.email.trim().toLowerCase(),
                    name: reviewer.name?.trim() || undefined,
                },
            ])
        ).values()];

        if (deduped.length === 0) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one reviewer is required');
        }

        const users = await prisma.user.findMany({
            where: {
                email: { in: deduped.map((reviewer) => reviewer.email) },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                organizationId: true,
            },
        });

        const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
        const tokenExpiresAt = this.buildTokenExpiry(deadline);

        return deduped.map((reviewer) => {
            const matchedUser = userByEmail.get(reviewer.email.toLowerCase());
            const isInternal = matchedUser?.organizationId === organizationId;

            return {
                email: reviewer.email,
                name: reviewer.name || (matchedUser ? `${matchedUser.firstName} ${matchedUser.lastName}`.trim() : undefined),
                reviewerType: isInternal ? 'INTERNAL' : 'EXTERNAL',
                ...(isInternal && matchedUser ? { user: { connect: { id: matchedUser.id } } } : {}),
                token: this.generateToken(),
                tokenExpiresAt,
            } satisfies Prisma.ApprovalReviewerCreateWithoutApprovalRequestInput;
        });
    }

    private async uploadRevisionAssets(
        approvalId: string,
        revisionNumber: number,
        files: Express.Multer.File[]
    ) {
        if (!files.length) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'At least one asset file is required');
        }

        return uploadService.uploadMultiple(files, `approvals/${approvalId}/revision-${revisionNumber}`);
    }

    private async safelyDeleteUploadedAssets(uploadedAssets: Awaited<ReturnType<typeof this.uploadRevisionAssets>>) {
        await Promise.all(uploadedAssets.map(async (asset) => {
            try {
                await uploadService.deleteFile(asset.s3Key);
            } catch (error) {
                logger.error(`Failed to roll back uploaded asset ${asset.s3Key}: ${(error as Error).message}`);
            }
        }));
    }

    private async updateReviewerInteraction(
        reviewerId: string,
        revisionNumber: number,
        updates: Partial<Pick<ApprovalReviewer, 'firstViewedAt' | 'lastViewedAt' | 'lastCommentAt' | 'lastDecisionAt' | 'lastInteractionAt'>>
    ) {
        const reviewer = await prisma.approvalReviewer.findUnique({
            where: { id: reviewerId },
            select: { id: true, firstViewedAt: true },
        });

        if (!reviewer) {
            return;
        }

        await prisma.approvalReviewer.update({
            where: { id: reviewerId },
            data: {
                ...updates,
                firstViewedAt: updates.firstViewedAt ?? reviewer.firstViewedAt ?? undefined,
                lastInteractionRevisionNumber: revisionNumber,
            },
        });
    }

    private async findReviewerForUser(approvalId: string, userId: string, email?: string) {
        let reviewer = await prisma.approvalReviewer.findFirst({
            where: {
                approvalRequestId: approvalId,
                userId,
            },
        });

        if (!reviewer && email) {
            reviewer = await prisma.approvalReviewer.findUnique({
                where: {
                    approvalRequestId_email: {
                        approvalRequestId: approvalId,
                        email: email.toLowerCase(),
                    },
                },
            });
        }

        return reviewer;
    }

    private async recalculateApprovalStatus(approvalId: string) {
        const approval = await prisma.approvalRequest.findUnique({
            where: { id: approvalId },
            select: {
                id: true,
                latestRevisionNumber: true,
                reviewers: { select: { id: true } },
            },
        });

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const latestRevision = await prisma.approvalRevision.findFirst({
            where: {
                approvalRequestId: approvalId,
                revisionNumber: approval.latestRevisionNumber,
            },
            include: { decisions: true },
        });

        if (!latestRevision) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Revision not found');
        }

        const decisions = latestRevision.decisions;

        let status: ApprovalStatus =
            latestRevision.revisionNumber === 1 ? 'PENDING_REVIEW' : 'UPDATED';
        let completedAt: Date | null = null;

        if (decisions.some((decision) => decision.decision === 'DECLINED')) {
            status = 'DECLINED';
            completedAt = new Date();
        } else if (decisions.some((decision) => decision.decision === 'CHANGES_REQUESTED')) {
            status = 'CHANGES_REQUESTED';
        } else if (
            approval.reviewers.length > 0 &&
            decisions.length === approval.reviewers.length &&
            decisions.every((decision) => decision.decision === 'APPROVED')
        ) {
            status = 'APPROVED';
            completedAt = new Date();
        }

        await prisma.approvalRequest.update({
            where: { id: approvalId },
            data: {
                status,
                completedAt,
            },
        });

        return status;
    }

    private async notifyReviewersOfSubmission(approval: ApprovalDetailRecord) {
        await approvalEmailService.sendReviewRequestsToAll(
            approval.reviewers.map((reviewer) => ({
                email: reviewer.email,
                name: reviewer.name || undefined,
                token: reviewer.token,
            })),
            approval.createdBy,
            {
                title: approval.title,
                eventName: approval.event.name,
                description: approval.description || undefined,
                deadline: approval.deadline,
                revisionNumber: approval.latestRevisionNumber,
            }
        );
    }

    private async notifyReviewersOfRevision(approval: ApprovalDetailRecord, revisionNumber: number, summary?: string) {
        await approvalEmailService.sendRevisionNotification(
            approval.reviewers.map((reviewer) => ({
                email: reviewer.email,
                name: reviewer.name || undefined,
                token: reviewer.token,
            })),
            approval.createdBy,
            {
                title: approval.title,
                eventName: approval.event.name,
                deadline: approval.deadline,
                revisionNumber,
                summary,
            }
        );
    }

    private async notifyRequesterOfDecision(
        approval: ApprovalDetailRecord,
        reviewer: ApprovalReviewer,
        decision: ApprovalDecision,
        note?: string
    ) {
        await approvalEmailService.sendDecisionNotification(
            approval.createdBy,
            {
                email: reviewer.email,
                name: reviewer.name || undefined,
            },
            {
                title: approval.title,
                eventName: approval.event.name,
                deadline: approval.deadline,
                revisionNumber: approval.latestRevisionNumber,
            },
            approval.id,
            decision,
            note
        );
    }

    private async notifyParticipantsOfComment(
        approval: ApprovalDetailRecord,
        authorEmail: string | null,
        authorName: string,
        revisionNumber: number,
        comment: string
    ) {
        const recipients = new Set<string>();

        if (approval.createdBy.email !== authorEmail) {
            recipients.add(approval.createdBy.email);
        }

        for (const reviewer of approval.reviewers) {
            if (reviewer.email !== authorEmail) {
                recipients.add(reviewer.email);
            }
        }

        if (recipients.size === 0) {
            return;
        }

        await approvalEmailService.sendCommentNotification(
            [...recipients],
            {
                title: approval.title,
                eventName: approval.event.name,
                revisionNumber,
                deadline: approval.deadline,
                approvalId: approval.id,
            },
            authorName,
            comment
        );
    }

    async create(input: CreateApprovalInput) {
        this.assertFutureDeadline(input.deadline);

        const event = await prisma.event.findFirst({
            where: {
                id: input.eventId,
                organizationId: input.organizationId,
            },
            select: { id: true },
        });

        if (!event) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Event not found in your organization');
        }

        const approvalId = randomUUID();
        const revisionId = randomUUID();
        const uploadedAssets = await this.uploadRevisionAssets(approvalId, 1, input.files);
        const reviewers = await this.resolveReviewers(input.organizationId, input.reviewers, input.deadline);

        try {
            await prisma.approvalRequest.create({
                data: {
                    id: approvalId,
                    organizationId: input.organizationId,
                    eventId: input.eventId,
                    createdById: input.createdById,
                    title: input.title,
                    description: input.description,
                    deadline: input.deadline,
                    status: 'PENDING_REVIEW',
                    latestRevisionNumber: 1,
                    revisions: {
                        create: {
                            id: revisionId,
                            revisionNumber: 1,
                            summary: 'Initial submission',
                            uploadedById: input.createdById,
                            assets: {
                                create: uploadedAssets.map((asset) => ({
                                    filename: asset.filename,
                                    originalName: asset.originalName,
                                    mimeType: asset.mimeType,
                                    size: asset.size,
                                    s3Key: asset.s3Key,
                                    s3Url: asset.s3Url,
                                })),
                            },
                        },
                    },
                    reviewers: {
                        create: reviewers,
                    },
                },
            });
        } catch (error) {
            await this.safelyDeleteUploadedAssets(uploadedAssets);
            throw error;
        }

        const approval = await this.getApprovalDetailRecord(approvalId, input.organizationId);
        if (!approval) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load created approval');
        }

        this.notifyReviewersOfSubmission(approval).catch((error) => {
            logger.error(`Failed to send approval submission emails: ${(error as Error).message}`);
        });

        return this.serializeApproval(approval);
    }

    async list(userId: string, filters: ApprovalListFilters) {
        const user = await this.getUserContext(userId);
        const page = filters.page || 1;
        const limit = filters.limit || 24;
        const skip = (page - 1) * limit;

        const where: Prisma.ApprovalRequestWhereInput = {
            organizationId: user.organizationId,
            ...(filters.eventId ? { eventId: filters.eventId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.assignedToMe
                ? {
                    reviewers: {
                        some: {
                            OR: [
                                { userId: user.id },
                                { email: user.email.toLowerCase() },
                            ],
                        },
                    },
                }
                : {}),
            ...(filters.approachingDeadline
                ? {
                    deadline: {
                        lte: new Date(Date.now() + APPROACHING_DEADLINE_WINDOW_HOURS * 60 * 60 * 1000),
                    },
                    status: {
                        in: ['PENDING_REVIEW', 'UPDATED', 'CHANGES_REQUESTED'],
                    },
                }
                : {}),
        };

        const orderBy =
            filters.sortBy === 'deadline'
                ? [{ deadline: 'asc' as const }, { createdAt: 'desc' as const }]
                : [{ submittedAt: 'desc' as const }, { createdAt: 'desc' as const }];

        const [approvals, total] = await Promise.all([
            prisma.approvalRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: approvalDetailInclude,
            }),
            prisma.approvalRequest.count({ where }),
        ]);

        return {
            approvals: approvals.map((approval) =>
                this.serializeApproval(approval, { email: user.email })
            ),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getById(approvalId: string, userId: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const reviewer = await this.findReviewerForUser(approvalId, user.id, user.email);
        if (reviewer) {
            await this.updateReviewerInteraction(reviewer.id, approval.latestRevisionNumber, {
                firstViewedAt: reviewer.firstViewedAt ? undefined : new Date(),
                lastViewedAt: new Date(),
                lastInteractionAt: new Date(),
            });
        }

        return this.serializeApproval(approval, {
            email: user.email,
            reviewerId: reviewer?.id,
        });
    }

    async updateMetadata(
        approvalId: string,
        userId: string,
        data: Partial<Pick<ApprovalRequest, 'title' | 'description' | 'deadline'>>
    ) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        if (data.deadline) {
            this.assertFutureDeadline(new Date(data.deadline));
        }

        await prisma.approvalRequest.update({
            where: { id: approvalId },
            data,
        });

        const updated = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        return this.serializeApproval(updated, { email: user.email });
    }

    async createRevision(approvalId: string, userId: string, input: CreateRevisionInput) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const revisionNumber = approval.latestRevisionNumber + 1;
        const uploadedAssets = await this.uploadRevisionAssets(approvalId, revisionNumber, input.files);
        const tokenExpiresAt = this.buildTokenExpiry(approval.deadline);

        try {
            await prisma.$transaction(async (tx) => {
                await tx.approvalRevision.create({
                    data: {
                        approvalRequestId: approvalId,
                        revisionNumber,
                        summary: input.summary,
                        uploadedById: user.id,
                        assets: {
                            create: uploadedAssets.map((asset) => ({
                                filename: asset.filename,
                                originalName: asset.originalName,
                                mimeType: asset.mimeType,
                                size: asset.size,
                                s3Key: asset.s3Key,
                                s3Url: asset.s3Url,
                            })),
                        },
                    },
                });

                await tx.approvalRequest.update({
                    where: { id: approvalId },
                    data: {
                        latestRevisionNumber: revisionNumber,
                        status: 'UPDATED',
                        completedAt: null,
                    },
                });

                await tx.approvalReviewer.updateMany({
                    where: { approvalRequestId: approvalId },
                    data: {
                        tokenExpiresAt,
                    },
                });
            });
        } catch (error) {
            await this.safelyDeleteUploadedAssets(uploadedAssets);
            throw error;
        }

        const updated = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        this.notifyReviewersOfRevision(updated, revisionNumber, input.summary).catch((error) => {
            logger.error(`Failed to send revision emails: ${(error as Error).message}`);
        });

        return this.serializeApproval(updated, { email: user.email });
    }

    private async resolveRevisionOrLatest(approval: ApprovalDetailRecord, revisionId?: string) {
        if (!revisionId) {
            return this.getLatestRevision(approval);
        }

        const revision = approval.revisions.find((item) => item.id === revisionId);
        if (!revision) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Revision not found');
        }

        return revision;
    }

    async addCommentByUser(approvalId: string, userId: string, input: ApprovalCommentInput) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const revision = await this.resolveRevisionOrLatest(approval, input.revisionId);
        const reviewer = await this.findReviewerForUser(approvalId, user.id, user.email);

        const comment = await prisma.approvalComment.create({
            data: {
                approvalRequestId: approvalId,
                approvalRevisionId: revision.id,
                userId: user.id,
                parentCommentId: input.parentCommentId,
                content: input.content,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                reviewer: { select: { id: true, email: true, name: true, reviewerType: true } },
            },
        });

        await prisma.approvalRequest.update({
            where: { id: approvalId },
            data: { lastCommentAt: new Date() },
        });

        if (reviewer) {
            await this.updateReviewerInteraction(reviewer.id, revision.revisionNumber, {
                lastCommentAt: new Date(),
                lastInteractionAt: new Date(),
            });
        }

        this.notifyParticipantsOfComment(
            approval,
            user.email,
            `${user.firstName} ${user.lastName}`.trim(),
            revision.revisionNumber,
            input.content
        ).catch((error) => {
            logger.error(`Failed to send comment notifications: ${(error as Error).message}`);
        });

        return this.serializeComment(comment);
    }

    async getByToken(token: string) {
        const reviewer = await prisma.approvalReviewer.findUnique({
            where: { token },
            include: {
                approvalRequest: {
                    include: approvalDetailInclude,
                },
            },
        });

        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid review link');
        }

        if (new Date() > reviewer.tokenExpiresAt) {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Review link has expired');
        }

        const latestRevisionNumber = reviewer.approvalRequest.latestRevisionNumber;
        await this.updateReviewerInteraction(reviewer.id, latestRevisionNumber, {
            firstViewedAt: reviewer.firstViewedAt ? undefined : new Date(),
            lastViewedAt: new Date(),
            lastInteractionAt: new Date(),
        });

        return {
            reviewer: {
                id: reviewer.id,
                email: reviewer.email,
                name: reviewer.name,
                reviewerType: reviewer.reviewerType,
                tokenExpiresAt: reviewer.tokenExpiresAt,
            },
            approval: this.serializeApproval(reviewer.approvalRequest, {
                reviewerId: reviewer.id,
                email: reviewer.email,
            }),
        };
    }

    async addCommentByToken(token: string, input: ApprovalCommentInput) {
        const reviewer = await prisma.approvalReviewer.findUnique({
            where: { token },
            include: {
                approvalRequest: {
                    include: approvalDetailInclude,
                },
            },
        });

        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid review link');
        }

        if (new Date() > reviewer.tokenExpiresAt) {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Review link has expired');
        }

        const revision = await this.resolveRevisionOrLatest(reviewer.approvalRequest, input.revisionId);

        const comment = await prisma.approvalComment.create({
            data: {
                approvalRequestId: reviewer.approvalRequestId,
                approvalRevisionId: revision.id,
                reviewerId: reviewer.id,
                parentCommentId: input.parentCommentId,
                content: input.content,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                reviewer: { select: { id: true, email: true, name: true, reviewerType: true } },
            },
        });

        await prisma.approvalRequest.update({
            where: { id: reviewer.approvalRequestId },
            data: { lastCommentAt: new Date() },
        });

        await this.updateReviewerInteraction(reviewer.id, revision.revisionNumber, {
            lastCommentAt: new Date(),
            lastInteractionAt: new Date(),
        });

        this.notifyParticipantsOfComment(
            reviewer.approvalRequest,
            reviewer.email,
            reviewer.name || reviewer.email,
            revision.revisionNumber,
            input.content
        ).catch((error) => {
            logger.error(`Failed to send comment notifications: ${(error as Error).message}`);
        });

        return this.serializeComment(comment);
    }

    private async submitDecisionForReviewer(
        approval: ApprovalDetailRecord,
        reviewer: ApprovalReviewer,
        input: DecisionInput
    ) {
        const revision = await this.resolveRevisionOrLatest(approval, input.revisionId);

        const decision = await prisma.approvalReviewDecision.upsert({
            where: {
                approvalRevisionId_reviewerId: {
                    approvalRevisionId: revision.id,
                    reviewerId: reviewer.id,
                },
            },
            create: {
                approvalRequestId: approval.id,
                approvalRevisionId: revision.id,
                reviewerId: reviewer.id,
                decision: input.decision,
                note: input.note,
            },
            update: {
                decision: input.decision,
                note: input.note,
            },
            include: {
                reviewer: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        reviewerType: true,
                    },
                },
            },
        });

        await this.updateReviewerInteraction(reviewer.id, revision.revisionNumber, {
            lastDecisionAt: new Date(),
            lastInteractionAt: new Date(),
        });

        await this.recalculateApprovalStatus(approval.id);

        this.notifyRequesterOfDecision(approval, reviewer, input.decision, input.note).catch((error) => {
            logger.error(`Failed to send decision notification: ${(error as Error).message}`);
        });

        return {
            id: decision.id,
            decision: decision.decision,
            note: decision.note,
            createdAt: decision.createdAt,
            reviewer: decision.reviewer,
        };
    }

    async submitDecisionByUser(approvalId: string, userId: string, input: DecisionInput) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const reviewer = await this.findReviewerForUser(approvalId, user.id, user.email);
        if (!reviewer) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'You are not assigned as a reviewer on this request');
        }

        return this.submitDecisionForReviewer(approval, reviewer, input);
    }

    async submitDecisionByToken(token: string, input: DecisionInput) {
        const reviewer = await prisma.approvalReviewer.findUnique({
            where: { token },
            include: {
                approvalRequest: {
                    include: approvalDetailInclude,
                },
            },
        });

        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid review link');
        }

        if (new Date() > reviewer.tokenExpiresAt) {
            throw new ApiError(StatusCodes.UNAUTHORIZED, 'Review link has expired');
        }

        return this.submitDecisionForReviewer(reviewer.approvalRequest, reviewer, input);
    }

    async processPendingReminders() {
        const approvals = await prisma.approvalRequest.findMany({
            where: {
                status: {
                    in: ['PENDING_REVIEW', 'UPDATED'],
                },
            },
            include: approvalDetailInclude,
        });

        const now = Date.now();

        for (const approval of approvals) {
            const latestRevision = this.getLatestRevision(approval);

            for (const reviewer of approval.reviewers) {
                const hasInteracted = reviewer.lastInteractionRevisionNumber === latestRevision.revisionNumber;
                const hasDecision = latestRevision.decisions.some((decision) => decision.reviewerId === reviewer.id);
                if (hasInteracted || hasDecision) {
                    continue;
                }

                const existingReminderTypes = new Set(
                    latestRevision.reminders
                        .filter((reminder) => reminder.reviewerId === reviewer.id)
                        .map((reminder) => reminder.reminderType)
                );

                const candidates: ReminderCandidate[] = [];
                if (
                    now - latestRevision.createdAt.getTime() >= REMINDER_AFTER_24_HOURS_MS &&
                    !existingReminderTypes.has('AFTER_24_HOURS')
                ) {
                    candidates.push({
                        approvalId: approval.id,
                        revisionId: latestRevision.id,
                        reviewerId: reviewer.id,
                        reminderType: 'AFTER_24_HOURS',
                    });
                }

                const msUntilDeadline = approval.deadline.getTime() - now;
                if (
                    msUntilDeadline <= REMINDER_BEFORE_48_HOURS_MS &&
                    msUntilDeadline > REMINDER_BEFORE_24_HOURS_MS &&
                    !existingReminderTypes.has('DEADLINE_48_HOURS')
                ) {
                    candidates.push({
                        approvalId: approval.id,
                        revisionId: latestRevision.id,
                        reviewerId: reviewer.id,
                        reminderType: 'DEADLINE_48_HOURS',
                    });
                }

                if (
                    msUntilDeadline <= REMINDER_BEFORE_24_HOURS_MS &&
                    msUntilDeadline > 0 &&
                    !existingReminderTypes.has('DEADLINE_24_HOURS')
                ) {
                    candidates.push({
                        approvalId: approval.id,
                        revisionId: latestRevision.id,
                        reviewerId: reviewer.id,
                        reminderType: 'DEADLINE_24_HOURS',
                    });
                }

                for (const candidate of candidates) {
                    const sent = await approvalEmailService.sendReminder(
                        {
                            email: reviewer.email,
                            name: reviewer.name || undefined,
                            token: reviewer.token,
                        },
                        approval.createdBy,
                        {
                            title: approval.title,
                            eventName: approval.event.name,
                            deadline: approval.deadline,
                            revisionNumber: latestRevision.revisionNumber,
                        }
                    );

                    if (sent) {
                        await prisma.approvalReminder.create({
                            data: {
                                approvalRevisionId: candidate.revisionId,
                                reviewerId: candidate.reviewerId,
                                reminderType: candidate.reminderType,
                            },
                        });
                    }
                }
            }
        }
    }
}

export const approvalService = new ApprovalService();
