import {
    ApprovalCommentVisibility,
    ApprovalDecision,
    ApprovalReminderType,
    ApprovalRequest,
    ApprovalReviewerAssociation,
    ApprovalReviewer,
    ApprovalStatus,
    Prisma,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { StatusCodes } from 'http-status-codes';
import prisma from '../../config/prisma';
import { logger } from '../../config/logger';
import { uploadService } from '../../services/upload.service';
import { approvalEmailService, ReviewerInfo } from '../../services/approval-email.service';
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
                            association: true,
                            reviewerType: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' as const },
            },
            comments: {
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                    reviewer: { select: { id: true, email: true, name: true, association: true, reviewerType: true } },
                },
                orderBy: { createdAt: 'asc' as const },
            },
            reminders: true,
        },
    },
    comments: {
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            reviewer: { select: { id: true, email: true, name: true, association: true, reviewerType: true } },
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
                    association: true,
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
    association?: ApprovalReviewerAssociation;
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
    dashboardOrigin?: string;
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
    visibility?: ApprovalCommentVisibility;
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
            visibility: comment.visibility,
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
                        association: comment.reviewer.association,
                }
                    : null,
        };
    }

    private filterVisibleComments(
        comments: ApprovalDetailRecord['comments'],
        canViewInternalComments: boolean
    ) {
        if (canViewInternalComments) {
            return comments;
        }

        return comments.filter((comment) => comment.visibility === 'GLOBAL');
    }

    private async serializeAsset(asset: ApprovalDetailRecord['revisions'][number]['assets'][number]) {
        return {
            id: asset.id,
            filename: asset.filename,
            originalName: asset.originalName,
            mimeType: asset.mimeType,
            size: asset.size,
            s3Url: await uploadService.resolveFileUrl(asset.s3Key, asset.s3Url),
            createdAt: asset.createdAt,
        };
    }

    private async serializeApproval(
        approval: ApprovalDetailRecord,
        viewer?: { email?: string; reviewerId?: string; canViewInternalComments?: boolean }
    ) {
        const latestRevision = this.getLatestRevision(approval);
        const canViewInternalComments = viewer?.canViewInternalComments ?? true;
        const comments = this.filterVisibleComments(approval.comments, canViewInternalComments).map((comment) =>
            this.serializeComment(comment)
        );
        const revisions = await Promise.all(
            approval.revisions.map(async (revision) => ({
                id: revision.id,
                revisionNumber: revision.revisionNumber,
                summary: revision.summary,
                createdAt: revision.createdAt,
                uploadedBy: revision.uploadedBy,
                assets: await Promise.all(revision.assets.map((asset) => this.serializeAsset(asset))),
                commentCount: this.filterVisibleComments(revision.comments, canViewInternalComments).length,
                decisions: revision.decisions.map((decision) => ({
                    id: decision.id,
                    reviewerId: decision.reviewerId,
                    decision: decision.decision,
                    note: decision.note,
                    createdAt: decision.createdAt,
                    reviewer: decision.reviewer,
                })),
            }))
        );
        const serializedLatestRevision =
            revisions.find((revision) => revision.id === latestRevision.id) || revisions[0];

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
                    association: reviewer.association,
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
            revisions,
            latestRevision: {
                ...serializedLatestRevision,
                comments: comments.filter((comment) => comment.revisionId === latestRevision.id),
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
                    association: reviewer.association,
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
                association: isInternal ? undefined : reviewer.association,
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

    private async notifyReviewersOfSubmission(approval: ApprovalDetailRecord, dashboardOrigin?: string) {
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
            },
            dashboardOrigin
        );
    }

    private async notifyReviewerSubsetOfSubmission(
        approval: Pick<ApprovalDetailRecord, 'title' | 'description' | 'event' | 'deadline' | 'latestRevisionNumber' | 'createdBy'>,
        reviewers: ReviewerInfo[],
        dashboardOrigin?: string
    ) {
        if (!reviewers.length) {
            return;
        }

        await approvalEmailService.sendReviewRequestsToAll(reviewers, approval.createdBy, {
            title: approval.title,
            eventName: approval.event.name,
            description: approval.description || undefined,
            deadline: approval.deadline,
            revisionNumber: approval.latestRevisionNumber,
        }, dashboardOrigin);
    }

    private async notifyReviewersOfRevision(
        approval: ApprovalDetailRecord,
        revisionNumber: number,
        summary?: string,
        dashboardOrigin?: string
    ) {
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
            },
            dashboardOrigin
        );
    }

    private async notifyRequesterOfDecision(
        approval: ApprovalDetailRecord,
        reviewer: ApprovalReviewer,
        decision: ApprovalDecision,
        note?: string,
        dashboardOrigin?: string
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
            note,
            dashboardOrigin
        );
    }

    private async notifyParticipantsOfComment(
        approval: ApprovalDetailRecord,
        authorEmail: string | null,
        authorName: string,
        revisionNumber: number,
        comment: string,
        visibility: ApprovalCommentVisibility,
        dashboardOrigin?: string
    ) {
        const normalizedAuthorEmail = authorEmail?.toLowerCase() || null;
        const recipients = new Map<
            string,
            {
                email: string;
                name?: string;
                reviewerToken?: string;
            }
        >();

        if (approval.createdBy.email.toLowerCase() !== normalizedAuthorEmail) {
            recipients.set(approval.createdBy.email.toLowerCase(), {
                email: approval.createdBy.email,
                name: `${approval.createdBy.firstName} ${approval.createdBy.lastName}`.trim(),
            });
        }

        for (const reviewer of approval.reviewers) {
            if (visibility === 'INTERNAL' && reviewer.reviewerType !== 'INTERNAL') {
                continue;
            }

            if (reviewer.email.toLowerCase() === normalizedAuthorEmail) {
                continue;
            }

            const recipientKey = reviewer.email.toLowerCase();
            if (recipients.has(recipientKey)) {
                continue;
            }

            recipients.set(recipientKey, {
                email: reviewer.email,
                name: reviewer.name || undefined,
                reviewerToken: reviewer.token,
            });
        }

        if (recipients.size === 0) {
            return;
        }

        await approvalEmailService.sendCommentNotification(
            [...recipients.values()],
            {
                title: approval.title,
                eventName: approval.event.name,
                revisionNumber,
                deadline: approval.deadline,
                approvalId: approval.id,
            },
            authorName,
            comment,
            dashboardOrigin
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

        this.notifyReviewersOfSubmission(approval, input.dashboardOrigin).catch((error) => {
            logger.error(`Failed to send approval submission emails: ${(error as Error).message}`);
        });

        return await this.serializeApproval(approval);
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
            approvals: await Promise.all(
                approvals.map((approval) => this.serializeApproval(approval, { email: user.email }))
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

        return await this.serializeApproval(approval, {
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

        return await this.serializeApproval(updated, { email: user.email });
    }

    async addReviewers(approvalId: string, userId: string, reviewers: ReviewerInput[], dashboardOrigin?: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const existingEmails = new Set(approval.reviewers.map((reviewer) => reviewer.email.toLowerCase()));
        const newReviewerInputs = reviewers.filter((reviewer) => {
            const normalizedEmail = reviewer.email.trim().toLowerCase();
            return normalizedEmail && !existingEmails.has(normalizedEmail);
        });

        if (!newReviewerInputs.length) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'All provided reviewers are already assigned');
        }

        const resolvedReviewers = await this.resolveReviewers(user.organizationId, newReviewerInputs, approval.deadline);

        await prisma.approvalRequest.update({
            where: { id: approvalId },
            data: {
                reviewers: {
                    create: resolvedReviewers,
                },
            },
        });

        await this.recalculateApprovalStatus(approvalId);

        const updated = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        this.notifyReviewerSubsetOfSubmission(
            approval,
            resolvedReviewers.map((reviewer) => ({
                email: reviewer.email,
                name: reviewer.name,
                token: reviewer.token,
            })),
            dashboardOrigin
        ).catch((error) => {
            logger.error(`Failed to send new reviewer emails: ${(error as Error).message}`);
        });

        return await this.serializeApproval(updated, { email: user.email });
    }

    async addReviewersByToken(token: string, reviewers: ReviewerInput[], dashboardOrigin?: string) {
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

        const approval = reviewer.approvalRequest;

        if (approval.status === 'APPROVED' || approval.status === 'DECLINED') {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot add reviewers after this approval is complete');
        }

        const existingEmails = new Set(approval.reviewers.map((item) => item.email.toLowerCase()));
        const newReviewerInputs = reviewers.filter((item) => {
            const normalizedEmail = item.email.trim().toLowerCase();
            return normalizedEmail && !existingEmails.has(normalizedEmail);
        });

        if (!newReviewerInputs.length) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'All provided reviewers are already assigned');
        }

        const resolvedReviewers = await this.resolveReviewers(
            approval.organizationId,
            newReviewerInputs,
            approval.deadline
        );

        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                reviewers: {
                    create: resolvedReviewers,
                },
            },
        });

        await this.updateReviewerInteraction(reviewer.id, approval.latestRevisionNumber, {
            lastInteractionAt: new Date(),
        });
        await this.recalculateApprovalStatus(approval.id);

        const updated = await this.getApprovalDetailRecord(approval.id, approval.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        this.notifyReviewerSubsetOfSubmission(
            updated,
            resolvedReviewers.map((item) => ({
                email: item.email,
                name: item.name,
                token: item.token,
            })),
            dashboardOrigin
        ).catch((error) => {
            logger.error(`Failed to send reviewer-added invite emails: ${(error as Error).message}`);
        });

        const refreshedReviewer = updated.reviewers.find((item) => item.id === reviewer.id);
        if (!refreshedReviewer) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated reviewer');
        }

        return {
            reviewer: {
                id: refreshedReviewer.id,
                email: refreshedReviewer.email,
                name: refreshedReviewer.name,
                association: refreshedReviewer.association,
                reviewerType: refreshedReviewer.reviewerType,
                tokenExpiresAt: refreshedReviewer.tokenExpiresAt,
            },
            approval: await this.serializeApproval(updated, {
                reviewerId: refreshedReviewer.id,
                email: refreshedReviewer.email,
                canViewInternalComments: false,
            }),
        };
    }

    async resendReviewerInvite(approvalId: string, reviewerId: string, userId: string, dashboardOrigin?: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        if (approval.deadline <= new Date()) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot resend an invite after the deadline has passed');
        }

        const reviewer = approval.reviewers.find((item) => item.id === reviewerId);
        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Reviewer not found');
        }

        const token = this.generateToken();
        const tokenExpiresAt = this.buildTokenExpiry(approval.deadline);

        await prisma.approvalReviewer.update({
            where: { id: reviewerId },
            data: {
                token,
                tokenExpiresAt,
            },
        });

        const updated = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        const updatedReviewer = updated.reviewers.find((item) => item.id === reviewerId);
        if (!updatedReviewer) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated reviewer');
        }

        this.notifyReviewerSubsetOfSubmission(updated, [
            {
                email: updatedReviewer.email,
                name: updatedReviewer.name || undefined,
                token: updatedReviewer.token,
            },
        ], dashboardOrigin).catch((error) => {
            logger.error(`Failed to resend reviewer invite: ${(error as Error).message}`);
        });

        return await this.serializeApproval(updated, { email: user.email });
    }

    async removeReviewer(approvalId: string, reviewerId: string, userId: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const reviewer = await prisma.approvalReviewer.findFirst({
            where: {
                id: reviewerId,
                approvalRequestId: approvalId,
                approvalRequest: {
                    organizationId: user.organizationId,
                },
            },
            include: {
                comments: {
                    select: { id: true },
                    take: 1,
                },
                decisions: {
                    select: { id: true },
                    take: 1,
                },
            },
        });

        if (!reviewer) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Reviewer not found');
        }

        const hasInteracted =
            Boolean(reviewer.firstViewedAt) ||
            Boolean(reviewer.lastViewedAt) ||
            Boolean(reviewer.lastCommentAt) ||
            Boolean(reviewer.lastDecisionAt) ||
            Boolean(reviewer.lastInteractionAt) ||
            reviewer.comments.length > 0 ||
            reviewer.decisions.length > 0;

        if (hasInteracted) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                'Cannot remove a reviewer who has already interacted with this approval'
            );
        }

        await prisma.approvalReviewer.delete({
            where: { id: reviewerId },
        });

        await this.recalculateApprovalStatus(approvalId);

        const updated = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!updated) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        return await this.serializeApproval(updated, { email: user.email });
    }

    async createRevision(approvalId: string, userId: string, input: CreateRevisionInput, dashboardOrigin?: string) {
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

        this.notifyReviewersOfRevision(updated, revisionNumber, input.summary, dashboardOrigin).catch((error) => {
            logger.error(`Failed to send revision emails: ${(error as Error).message}`);
        });

        return await this.serializeApproval(updated, { email: user.email });
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

    private async syncApprovalLastCommentAt(
        tx: Prisma.TransactionClient,
        approvalId: string
    ) {
        const latestComment = await tx.approvalComment.findFirst({
            where: { approvalRequestId: approvalId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        await tx.approvalRequest.update({
            where: { id: approvalId },
            data: {
                lastCommentAt: latestComment?.createdAt ?? null,
            },
        });
    }

    async addCommentByUser(approvalId: string, userId: string, input: ApprovalCommentInput, dashboardOrigin?: string) {
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
                visibility: input.visibility ?? 'GLOBAL',
                content: input.content,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                reviewer: { select: { id: true, email: true, name: true, association: true, reviewerType: true } },
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
            input.content,
            input.visibility ?? 'GLOBAL',
            dashboardOrigin
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
                association: reviewer.association,
                reviewerType: reviewer.reviewerType,
                tokenExpiresAt: reviewer.tokenExpiresAt,
            },
            approval: await this.serializeApproval(reviewer.approvalRequest, {
                reviewerId: reviewer.id,
                email: reviewer.email,
                canViewInternalComments: false,
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

        if (input.visibility && input.visibility !== 'GLOBAL') {
            throw new ApiError(StatusCodes.FORBIDDEN, 'Invited reviewers can only post to the global chat');
        }

        const revision = await this.resolveRevisionOrLatest(reviewer.approvalRequest, input.revisionId);

        const comment = await prisma.approvalComment.create({
            data: {
                approvalRequestId: reviewer.approvalRequestId,
                approvalRevisionId: revision.id,
                reviewerId: reviewer.id,
                parentCommentId: input.parentCommentId,
                visibility: 'GLOBAL',
                content: input.content,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                reviewer: { select: { id: true, email: true, name: true, association: true, reviewerType: true } },
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
            input.content,
            'GLOBAL'
        ).catch((error) => {
            logger.error(`Failed to send comment notifications: ${(error as Error).message}`);
        });

        return this.serializeComment(comment);
    }

    async deleteCommentByUser(approvalId: string, commentId: string, userId: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const comment = await prisma.approvalComment.findFirst({
            where: {
                id: commentId,
                approvalRequestId: approvalId,
            },
            include: {
                reviewer: {
                    select: {
                        id: true,
                        userId: true,
                    },
                },
            },
        });

        if (!comment) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');
        }

        if (comment.userId !== user.id && comment.reviewer?.userId !== user.id) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own messages');
        }

        await prisma.$transaction(async (tx) => {
            await tx.approvalComment.updateMany({
                where: { parentCommentId: comment.id },
                data: { parentCommentId: null },
            });

            await tx.approvalComment.delete({
                where: { id: comment.id },
            });

            await this.syncApprovalLastCommentAt(tx, approvalId);
        });

        const refreshedApproval = await this.getApprovalDetailRecord(approvalId, user.organizationId);
        if (!refreshedApproval) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated approval');
        }

        const reviewer = await this.findReviewerForUser(approvalId, user.id, user.email);
        return this.serializeApproval(refreshedApproval, {
            email: user.email,
            reviewerId: reviewer?.id,
            canViewInternalComments: true,
        });
    }

    async deleteCommentByToken(token: string, commentId: string) {
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

        const comment = await prisma.approvalComment.findFirst({
            where: {
                id: commentId,
                approvalRequestId: reviewer.approvalRequestId,
            },
            select: {
                id: true,
                reviewerId: true,
            },
        });

        if (!comment) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found');
        }

        if (comment.reviewerId !== reviewer.id) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own messages');
        }

        await prisma.$transaction(async (tx) => {
            await tx.approvalComment.updateMany({
                where: { parentCommentId: comment.id },
                data: { parentCommentId: null },
            });

            await tx.approvalComment.delete({
                where: { id: comment.id },
            });

            await this.syncApprovalLastCommentAt(tx, reviewer.approvalRequestId);
        });

        const refreshedReviewer = await prisma.approvalReviewer.findUnique({
            where: { id: reviewer.id },
            include: {
                approvalRequest: {
                    include: approvalDetailInclude,
                },
            },
        });

        if (!refreshedReviewer) {
            throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load updated review');
        }

        return {
            reviewer: {
                id: refreshedReviewer.id,
                email: refreshedReviewer.email,
                name: refreshedReviewer.name,
                association: refreshedReviewer.association,
                reviewerType: refreshedReviewer.reviewerType,
                tokenExpiresAt: refreshedReviewer.tokenExpiresAt,
            },
            approval: await this.serializeApproval(refreshedReviewer.approvalRequest, {
                reviewerId: refreshedReviewer.id,
                email: refreshedReviewer.email,
                canViewInternalComments: false,
            }),
        };
    }

    private async submitDecisionForReviewer(
        approval: ApprovalDetailRecord,
        reviewer: ApprovalReviewer,
        input: DecisionInput,
        dashboardOrigin?: string
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
                        association: true,
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

        this.notifyRequesterOfDecision(approval, reviewer, input.decision, input.note, dashboardOrigin).catch((error) => {
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

    async submitDecisionByUser(approvalId: string, userId: string, input: DecisionInput, dashboardOrigin?: string) {
        const user = await this.getUserContext(userId);
        const approval = await this.getApprovalDetailRecord(approvalId, user.organizationId);

        if (!approval) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Approval request not found');
        }

        const reviewer = await this.findReviewerForUser(approvalId, user.id, user.email);
        if (!reviewer) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'You are not assigned as a reviewer on this request');
        }

        return this.submitDecisionForReviewer(approval, reviewer, input, dashboardOrigin);
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
