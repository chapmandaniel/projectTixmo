import { Router } from 'express';
import { ApprovalController } from '../approvals/controller';

const router = Router();

// ==========================================
// Public Review Routes (External Reviewers)
// No authentication required - access via secure token
// ==========================================

// Get approval by token
router.get('/:token', ApprovalController.getByToken);

// Submit decision
router.post('/:token/decision', ApprovalController.submitDecision);

// Add comment
router.post('/:token/comments', ApprovalController.addExternalComment);

export default router;
