import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { socialCommandCenterController } from './controller';

const router = Router();

router.get('/command-center', authenticate, socialCommandCenterController.getCommandCenter);
router.put('/settings', authenticate, socialCommandCenterController.updateSettings);
router.post('/posts/:postId/resolve', authenticate, socialCommandCenterController.resolvePost);
router.post('/posts/:postId/refresh', authenticate, socialCommandCenterController.refreshPost);

export default router;
