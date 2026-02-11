import { Router } from 'express';
import { ApprovalController } from '../approvals/controller';
import { validate } from '../../middleware/validate';
import * as validation from '../approvals/validation';

const router = Router();

// ==========================================
// Public Review Routes (External Reviewers)
// No authentication required - access via secure token
// ==========================================

// Get approval by token
router.get('/:token', validate(validation.tokenParamsSchema), ApprovalController.getByToken);

// Submit decision
router.post(
    '/:token/decision',
    validate(validation.submitDecisionSchema),
    ApprovalController.submitDecision
);

// Add comment
router.post(
    '/:token/comments',
    validate(validation.externalCommentSchema),
    ApprovalController.addExternalComment
);

export default router;
