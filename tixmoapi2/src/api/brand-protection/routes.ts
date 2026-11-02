import { Router } from 'express';
import { isGiveawayProtectionEnabled } from '../../config/environment';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { giveawayIngestRateLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { requireCheckerToken } from './checkerGuard';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();
const orgRoles = ['OWNER', 'ADMIN', 'MANAGER'] as const;

// Flag off: the route exists in code but responds as if it were not mounted.
router.use((_req, _res, next) => {
  if (!isGiveawayProtectionEnabled()) return next(ApiError.notFound('Route not found'));
  return next();
});

router.post(
  '/ingest/matches',
  requireCheckerToken,
  giveawayIngestRateLimiter,
  validate(validation.ingestMatchesSchema),
  controller.ingest
);
router.post(
  '/ingest/status',
  requireCheckerToken,
  giveawayIngestRateLimiter,
  validate(validation.ingestStatusSchema),
  controller.ingestStatus
);
router.post(
  '/ingest/verifications',
  requireCheckerToken,
  giveawayIngestRateLimiter,
  validate(validation.ingestVerificationSchema),
  controller.ingestVerification
);

router.get('/checker-status', authenticate, authorize(...orgRoles), controller.checkerStatus);

router.post(
  '/admin/checker-tokens',
  authenticate,
  authorize('ADMIN'),
  validate(validation.issueTokenSchema),
  controller.issueToken
);
router.post(
  '/admin/checker-tokens/:id/revoke',
  authenticate,
  authorize('ADMIN'),
  validate(validation.revokeTokenSchema),
  controller.revokeToken
);
router.post(
  '/admin/accounts/:id/lift',
  authenticate,
  authorize('ADMIN'),
  validate(validation.accountIdSchema),
  controller.liftClaimBlock
);
router.post(
  '/admin/disputes/resolve',
  authenticate,
  authorize('ADMIN'),
  validate(validation.resolveDisputeSchema),
  controller.resolveDispute
);

router.get(
  '/accounts',
  authenticate,
  authorize(...orgRoles),
  validate(validation.listAccountsSchema),
  controller.listAccounts
);
router.post(
  '/accounts',
  authenticate,
  authorize(...orgRoles),
  validate(validation.createAccountSchema),
  controller.createAccount
);
router.post(
  '/accounts/:id/verification-code',
  authenticate,
  authorize(...orgRoles),
  validate(validation.accountIdSchema),
  controller.regenerateCode
);
router.put(
  '/accounts/:id',
  authenticate,
  authorize(...orgRoles),
  validate(validation.updateAccountSchema),
  controller.updateAccount
);
router.delete(
  '/accounts/:id',
  authenticate,
  authorize(...orgRoles),
  validate(validation.accountIdSchema),
  controller.removeAccount
);

router.get(
  '/giveaways',
  authenticate,
  authorize(...orgRoles),
  validate(validation.listGiveawaysSchema),
  controller.listGiveaways
);
router.post(
  '/giveaways',
  authenticate,
  authorize(...orgRoles),
  validate(validation.createGiveawaySchema),
  controller.createGiveaway
);
router.put(
  '/giveaways/:id',
  authenticate,
  authorize(...orgRoles),
  validate(validation.updateGiveawaySchema),
  controller.updateGiveaway
);
router.delete(
  '/giveaways/:id',
  authenticate,
  authorize(...orgRoles),
  validate(validation.accountIdSchema),
  controller.removeGiveaway
);

router.get(
  '/matches',
  authenticate,
  authorize(...orgRoles),
  validate(validation.listMatchesSchema),
  controller.listMatches
);
router.get(
  '/matches/:id',
  authenticate,
  authorize(...orgRoles),
  validate(validation.accountIdSchema),
  controller.getMatch
);
router.post(
  '/matches/:id/review',
  authenticate,
  authorize(...orgRoles),
  validate(validation.reviewMatchSchema),
  controller.reviewMatch
);

export default router;
