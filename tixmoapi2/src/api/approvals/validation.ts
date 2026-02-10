import { z } from 'zod';

// Create approval request
export const createApprovalSchema = z.object({
    body: z.object({
        eventId: z.string().uuid('Invalid event ID'),
        title: z.string().min(1, 'Title is required').max(200),
        description: z.string().optional(),
        instructions: z.string().optional(),
        priority: z.enum(['STANDARD', 'URGENT', 'CRITICAL']).default('STANDARD'),
        dueDate: z.string().datetime().optional(),
    }),
});

// Update approval request
export const updateApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        priority: z.enum(['STANDARD', 'URGENT', 'CRITICAL']).optional(),
        dueDate: z.string().datetime().optional().nullable(),
    }),
});

// Add reviewers
export const addReviewersSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
    }),
    body: z.object({
        reviewers: z.array(z.object({
            email: z.string().email('Invalid email address'),
            name: z.string().optional(),
        })).min(1, 'At least one reviewer is required'),
    }),
});

// Submit decision (for external reviewers)
export const submitDecisionSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
    body: z.object({
        decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
        note: z.string().optional(),
    }),
});

// Add comment
export const addCommentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
    }),
    body: z.object({
        content: z.string().min(1, 'Comment content is required'),
        assetId: z.string().uuid().optional(),
        annotation: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
        }).optional(),
    }),
});

// External reviewer comment
export const externalCommentSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
    body: z.object({
        content: z.string().min(1, 'Comment content is required'),
        assetId: z.string().uuid().optional(),
        annotation: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
        }).optional(),
    }),
});

// Get by ID params
export const approvalIdParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
    }),
});

// Token params
export const tokenParamsSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
});

// Asset ID params
export const assetIdParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
        assetId: z.string().uuid('Invalid asset ID'),
    }),
});

// Reviewer ID params
export const reviewerIdParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid approval ID'),
        reviewerId: z.string().uuid('Invalid reviewer ID'),
    }),
});

// List query params
export const listApprovalsQuerySchema = z.object({
    query: z.object({
        eventId: z.string().uuid().optional(),
        status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED']).optional(),
        page: z.string().transform(Number).optional(),
        limit: z.string().transform(Number).optional(),
    }),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>['body'];
export type UpdateApprovalInput = z.infer<typeof updateApprovalSchema>['body'];
export type AddReviewersInput = z.infer<typeof addReviewersSchema>['body'];
export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>['body'];
export type AddCommentInput = z.infer<typeof addCommentSchema>['body'];
