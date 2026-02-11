import { Router } from 'express';
import { ApprovalController, uploadMiddleware } from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as validation from './validation';

const router = Router();

// ==========================================
// Authenticated Routes (Tixmo Users)
// ==========================================

// Create approval request
router.post('/', authenticate, validate(validation.createApprovalSchema), ApprovalController.create);

// List approval requests with filters
router.get('/', authenticate, validate(validation.listApprovalsQuerySchema), ApprovalController.list);

// Get approval request by ID
router.get(
    '/:id',
    authenticate,
    validate(validation.approvalIdParamsSchema),
    ApprovalController.getById
);

// Update approval request
router.put(
    '/:id',
    authenticate,
    validate(validation.updateApprovalSchema),
    ApprovalController.update
);

// Delete approval request
router.delete(
    '/:id',
    authenticate,
    validate(validation.approvalIdParamsSchema),
    ApprovalController.delete
);

// Upload assets
router.post(
    '/:id/assets',
    authenticate,
    validate(validation.approvalIdParamsSchema),
    uploadMiddleware,
    ApprovalController.uploadAssets
);

// Delete asset
router.delete(
    '/:id/assets/:assetId',
    authenticate,
    validate(validation.assetIdParamsSchema),
    ApprovalController.deleteAsset
);

// Add reviewers
router.post(
    '/:id/reviewers',
    authenticate,
    validate(validation.addReviewersSchema),
    ApprovalController.addReviewers
);

// Remove reviewer
router.delete(
    '/:id/reviewers/:reviewerId',
    authenticate,
    validate(validation.reviewerIdParamsSchema),
    ApprovalController.removeReviewer
);

// Submit for review
router.post(
    '/:id/submit',
    authenticate,
    validate(validation.approvalIdParamsSchema),
    ApprovalController.submitForReview
);

// Add comment
router.post(
    '/:id/comments',
    authenticate,
    validate(validation.addCommentSchema),
    ApprovalController.addComment
);

// Create new revision and re-submit
router.post(
    '/:id/revise',
    authenticate,
    validate(validation.approvalIdParamsSchema),
    ApprovalController.createRevision
);

export default router;
