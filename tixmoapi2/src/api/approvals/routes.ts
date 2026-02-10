import { Router } from 'express';
import { ApprovalController, uploadMiddleware } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// ==========================================
// Authenticated Routes (Tixmo Users)
// ==========================================

// Create approval request
router.post('/', authenticate, ApprovalController.create);

// List approval requests with filters
router.get('/', authenticate, ApprovalController.list);

// Get approval request by ID
router.get('/:id', authenticate, ApprovalController.getById);

// Update approval request
router.put('/:id', authenticate, ApprovalController.update);

// Delete approval request
router.delete('/:id', authenticate, ApprovalController.delete);

// Upload assets
router.post('/:id/assets', authenticate, uploadMiddleware, ApprovalController.uploadAssets);

// Delete asset
router.delete('/:id/assets/:assetId', authenticate, ApprovalController.deleteAsset);

// Add reviewers
router.post('/:id/reviewers', authenticate, ApprovalController.addReviewers);

// Remove reviewer
router.delete('/:id/reviewers/:reviewerId', authenticate, ApprovalController.removeReviewer);

// Submit for review
router.post('/:id/submit', authenticate, ApprovalController.submitForReview);

// Add comment
router.post('/:id/comments', authenticate, ApprovalController.addComment);

// Create new revision and re-submit
router.post('/:id/revise', authenticate, ApprovalController.createRevision);

export default router;
