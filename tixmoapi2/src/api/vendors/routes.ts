import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorize('OWNER', 'ADMIN'));

router.post('/connection', validate(validation.connectShowpassSchema), controller.connect);
router.get('/', validate(validation.syncShowpassSchema), controller.show);
router.put('/config', validate(validation.saveShowpassConfigSchema), controller.saveConfig);
router.get('/preview', validate(validation.showpassVenueSchema), controller.preview);
router.post('/import', validate(validation.importShowpassSchema), controller.importEvents);
router.post('/sync', validate(validation.syncShowpassSchema), controller.sync);
router.delete('/', validate(validation.syncShowpassSchema), controller.disconnect);
router.get('/fixtures', validate(validation.syncShowpassSchema), controller.showFixtures);
router.put('/fixtures', validate(validation.fixtureControlSchema), controller.updateFixtures);
router.get('/sold-counts', validate(validation.soldCountsSchema), controller.soldCounts);

export default router;

export const showpassWebhookRouter = Router();
showpassWebhookRouter.post('/webhook', controller.webhook);
showpassWebhookRouter.post('/hooks/:token', controller.webhook);
