import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { listStaffActions } from './controller';

const router = Router();

router.use(authenticate);
router.get('/', authorize('OWNER', 'ADMIN'), listStaffActions);

export default router;
