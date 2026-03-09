import { z } from 'zod';

const reviewerSchema = z.object({
    email: z.string().email('Invalid reviewer email address'),
    name: z.string().trim().min(1).max(120).optional(),
});

const parseReviewers = (value: unknown) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as unknown;
        } catch {
            return value;
        }
    }

    return value;
};

const booleanish = z.preprocess((value) => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return value === 'true';
    }

    return false;
}, z.boolean());

export const createApprovalBodySchema = z.object({
    eventId: z.string().uuid('Invalid event ID'),
    title: z.string().trim().min(1, 'Asset title is required').max(200),
    description: z.string().trim().max(4000).optional(),
    deadline: z.string().datetime('Deadline must be a valid ISO datetime'),
    reviewers: z.preprocess(
        parseReviewers,
        z.array(reviewerSchema).min(1, 'At least one reviewer is required')
    ),
});

export const createRevisionBodySchema = z.object({
    summary: z.string().trim().max(4000).optional(),
});

export const approvalMetadataUpdateSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).optional(),
    deadline: z.string().datetime('Deadline must be a valid ISO datetime').optional(),
});

export const approvalCommentBodySchema = z.object({
    content: z.string().trim().min(1, 'Comment content is required').max(4000),
    revisionId: z.string().uuid('Invalid revision ID').optional(),
    parentCommentId: z.string().uuid('Invalid parent comment ID').optional(),
});

export const approvalDecisionBodySchema = z.object({
    decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'DECLINED']),
    note: z.string().trim().max(4000).optional(),
    revisionId: z.string().uuid('Invalid revision ID').optional(),
});

export const approvalIdParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
    }),
});

export const tokenParamsSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
});

export const listApprovalsQuerySchema = z.object({
    query: z.object({
        eventId: z.string().uuid().optional(),
        status: z
            .enum(['PENDING_REVIEW', 'CHANGES_REQUESTED', 'UPDATED', 'APPROVED', 'DECLINED'])
            .optional(),
        assignedToMe: booleanish.optional(),
        approachingDeadline: booleanish.optional(),
        sortBy: z.enum(['deadline', 'submittedAt']).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
    }),
});
