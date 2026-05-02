import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
    ApprovalController,
    approvalCreateUploadMiddleware,
    approvalRevisionUploadMiddleware,
} from './controller';
import {
    approvalIdParamsSchema,
    approvalCommentParamsSchema,
    approvalReviewerParamsSchema,
    listApprovalsQuerySchema,
} from './validation';

const router = Router();

router.post('/', authenticate, approvalCreateUploadMiddleware, ApprovalController.create);
router.get('/', authenticate, validate(listApprovalsQuerySchema), ApprovalController.list);
router.get('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.getById);
router.patch('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.updateMetadata);
router.post('/:id/archive', authenticate, validate(approvalIdParamsSchema), ApprovalController.archive);
router.post('/:id/approved-assets', authenticate, validate(approvalIdParamsSchema), ApprovalController.addApprovedAssets);
router.delete('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.delete);
router.post('/:id/reviewers', authenticate, validate(approvalIdParamsSchema), ApprovalController.addReviewers);
router.post(
    '/:id/reviewers/:reviewerId/resend',
    authenticate,
    validate(approvalReviewerParamsSchema),
    ApprovalController.resendReviewerInvite
);
router.delete(
    '/:id/reviewers/:reviewerId',
    authenticate,
    validate(approvalReviewerParamsSchema),
    ApprovalController.removeReviewer
);
router.post(
    '/:id/revisions',
    authenticate,
    validate(approvalIdParamsSchema),
    approvalRevisionUploadMiddleware,
    ApprovalController.createRevision
);
router.post('/:id/comments', authenticate, validate(approvalIdParamsSchema), ApprovalController.addComment);
router.delete('/:id/comments/:commentId', authenticate, validate(approvalCommentParamsSchema), ApprovalController.deleteComment);
router.post('/:id/decisions', authenticate, validate(approvalIdParamsSchema), ApprovalController.submitDecision);

export default router;
