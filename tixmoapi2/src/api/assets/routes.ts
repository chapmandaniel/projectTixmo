import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  AssetLibraryController,
  assetLibraryUploadMiddleware,
} from './controller';

const router = Router();

router.get('/', authenticate, AssetLibraryController.list);
router.post('/', authenticate, assetLibraryUploadMiddleware, AssetLibraryController.upload);

export default router;
