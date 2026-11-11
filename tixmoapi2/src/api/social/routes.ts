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
router.post(
  '/email-captures/trigger',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.triggerEmailCapture
);

router.get('/workspace', authenticate, controller.getWorkspace);
router.get('/overview', authenticate, controller.getOverview);
router.get('/posts', authenticate, controller.getPosts);
router.get('/posts/:id', authenticate, controller.getPost);
router.get('/issues', authenticate, controller.getIssuesHandler);
router.get('/issues/:id', authenticate, controller.getIssueHandler);
router.patch('/issues/:id', authenticate, controller.patchIssueHandler);
router.post('/issues/bulk', authenticate, controller.bulkIssuesHandler);
router.get('/waves', authenticate, controller.getWaves);
router.get('/unanswered', authenticate, controller.getUnanswered);

router.get('/settings', authenticate, controller.getSettingsHandler);
router.patch(
  '/settings/thresholds',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.patchThresholds
);
router.post('/settings/hold', authenticate, authorize('OWNER', 'ADMIN'), controller.postHold);
router.post(
  '/settings/keywords',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.postKeywords
);
router.post('/settings/mapping', authenticate, authorize('OWNER', 'ADMIN'), controller.postMapping);

router.get('/accounts', authenticate, controller.getAccounts);
router.post(
  '/accounts/discover',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.discoverAccounts
);
router.post(
  '/accounts/connect',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.connectAccount
);
router.post(
  '/accounts/:id/disconnect',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.disconnectAccount
);

router.post('/sync', authenticate, authorize('OWNER', 'ADMIN'), controller.syncNow);
router.post(
  '/retention/purge',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  controller.purgeComments
);

export default router;
