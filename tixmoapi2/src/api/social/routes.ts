import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import * as controller from './controller';

const router = Router();

router.get('/config', controller.getConfig);
router.post('/classify', authenticate, controller.classifyComments);
router.get(
  '/email-captures',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.listEmailCaptures
);

export default router;
