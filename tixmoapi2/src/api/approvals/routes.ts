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
    listApprovalsQuerySchema,
} from './validation';

const router = Router();

router.post('/', authenticate, approvalCreateUploadMiddleware, ApprovalController.create);
router.get('/', authenticate, validate(listApprovalsQuerySchema), ApprovalController.list);
router.get('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.getById);
router.patch('/:id', authenticate, validate(approvalIdParamsSchema), ApprovalController.updateMetadata);
router.post('/:id/reviewers', authenticate, validate(approvalIdParamsSchema), ApprovalController.addReviewers);
router.post(
    '/:id/revisions',
    authenticate,
    validate(approvalIdParamsSchema),
    approvalRevisionUploadMiddleware,
    ApprovalController.createRevision
);
router.post('/:id/comments', authenticate, validate(approvalIdParamsSchema), ApprovalController.addComment);
router.post('/:id/decisions', authenticate, validate(approvalIdParamsSchema), ApprovalController.submitDecision);

export default router;
