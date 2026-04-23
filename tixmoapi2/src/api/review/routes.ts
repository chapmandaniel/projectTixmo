import { Router } from 'express';
import { ApprovalController } from '../approvals/controller';
import { validate } from '../../middleware/validate';
import {
  tokenCommentParamsSchema,
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
router.post('/:token/decisions', validate(tokenParamsSchema), (req, res, next) =>
  ApprovalController.submitExternalDecision(req, res, next)
);

// Add comment
router.post('/:token/comments', validate(tokenParamsSchema), (req, res, next) =>
  ApprovalController.addExternalComment(req, res, next)
);

// Add reviewer
router.post('/:token/reviewers', validate(tokenParamsSchema), (req, res, next) =>
  ApprovalController.addExternalReviewers(req, res, next)
);

router.delete('/:token/comments/:commentId', validate(tokenCommentParamsSchema), (req, res, next) =>
  ApprovalController.deleteExternalComment(req, res, next)
);

export default router;
