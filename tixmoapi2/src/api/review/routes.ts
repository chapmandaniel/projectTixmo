import { Router } from 'express';
import { ApprovalController } from '../approvals/controller';
import { validate } from '../../middleware/validate';
import {
  submitDecisionSchema,
  externalCommentSchema,
  tokenParamsSchema,
} from '../approvals/validation';

const router = Router();

// ==========================================
// Public Review Routes (External Reviewers)
// No authentication required - access via secure token
// ==========================================

// Get approval by token
router.get('/:token', validate(tokenParamsSchema), (req, res, next) =>
  ApprovalController.getByToken(req, res, next)
);

// Submit decision
router.post('/:token/decision', validate(submitDecisionSchema), (req, res, next) =>
  ApprovalController.submitDecision(req, res, next)
);

// Add comment
router.post('/:token/comments', validate(externalCommentSchema), (req, res, next) =>
  ApprovalController.addExternalComment(req, res, next)
);

export default router;
