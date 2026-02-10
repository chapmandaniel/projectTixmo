import { Router } from 'express';
import { aiController } from './controller';
import { authenticate } from '../../middleware/auth'; // Assuming you want this protected

const router = Router();

// Protect AI routes with authentication
router.post('/generate', authenticate, aiController.generate);

export default router;
