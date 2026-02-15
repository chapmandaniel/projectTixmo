import { Router } from 'express';
import { ApprovalController, uploadMiddleware } from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
    createApprovalSchema,
    updateApprovalSchema,
    addReviewersSchema,
    submitDecisionSchema,
    addCommentSchema,
    externalCommentSchema,
    approvalIdParamsSchema,
    listApprovalsQuerySchema,
    tokenParamsSchema,
    assetIdParamsSchema,
    reviewerIdParamsSchema,
    submitAuthenticatedDecisionSchema,
} from './validation';

const router = Router();

// ==========================================
// External Reviewer Routes (No Auth Required)
// ==========================================

// Get approval by review token
router.get('/review/:token', validate(tokenParamsSchema), ApprovalController.getByToken);

// Submit reviewer decision
router.post('/review/:token/decision', validate(submitDecisionSchema), ApprovalController.submitDecision);

// Add external comment
router.post('/review/:token/comments', validate(externalCommentSchema), ApprovalController.addExternalComment);

// ==========================================
// Authenticated Routes (Tixmo Users)
// ==========================================

// Create approval request
router.post('/', authenticate, validate(createApprovalSchema), ApprovalController.create);

// List approval requests with filters
router.get('/', authenticate, validate(listApprovalsQuerySchema), ApprovalController.list);

// Get approval request by ID
router.get('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.getById);

// Update approval request
router.put('/:id', authenticate, validate(updateApprovalSchema), ApprovalController.update);

// Delete approval request
router.delete('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.delete);

// Upload assets
router.post('/:id/assets', authenticate, validate(approvalIdParamsSchema), uploadMiddleware, ApprovalController.uploadAssets);

// Delete asset
router.delete('/:id/assets/:assetId', authenticate, validate(assetIdParamsSchema), ApprovalController.deleteAsset);

// Add reviewers
router.post('/:id/reviewers', authenticate, validate(addReviewersSchema), ApprovalController.addReviewers);

// Remove reviewer
router.delete('/:id/reviewers/:reviewerId', authenticate, validate(reviewerIdParamsSchema), ApprovalController.removeReviewer);


// Submit decision (authenticated)
router.post('/:id/review', authenticate, validate(submitAuthenticatedDecisionSchema), ApprovalController.submitAuthenticatedDecision);

// Submit for review
router.post('/:id/submit', authenticate, validate(approvalIdParamsSchema), ApprovalController.submitForReview);

// Add comment
router.post('/:id/comments', authenticate, validate(addCommentSchema), ApprovalController.addComment);

// Create new revision and re-submit
router.post('/:id/revise', authenticate, validate(approvalIdParamsSchema), ApprovalController.createRevision);

export default router;
