import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  AssetLibraryController,
  assetLibraryUploadMiddleware,
} from './controller';

const router = Router();

router.get('/', authenticate, AssetLibraryController.list);
router.post('/folders', authenticate, AssetLibraryController.createFolder);
router.delete('/folders/:folderId', authenticate, AssetLibraryController.deleteFolder);
router.patch('/:assetId/folder', authenticate, AssetLibraryController.moveAssetToFolder);
router.delete('/:assetId', authenticate, AssetLibraryController.deleteAsset);
router.post('/', authenticate, assetLibraryUploadMiddleware, AssetLibraryController.upload);

export default router;
