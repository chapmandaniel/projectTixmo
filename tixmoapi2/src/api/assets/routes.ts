import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  AssetLibraryController,
  assetLibraryUploadMiddleware,
} from './controller';

const router = Router();

router.get('/shares/:token', AssetLibraryController.getSharedFolder);
router.get('/', authenticate, AssetLibraryController.list);
router.post('/folders', authenticate, AssetLibraryController.createFolder);
router.get('/folders/:folderId/shares', authenticate, AssetLibraryController.listFolderShares);
router.post('/folders/:folderId/shares', authenticate, AssetLibraryController.createFolderShare);
router.delete('/folders/:folderId/shares/:shareId', authenticate, AssetLibraryController.revokeFolderShare);
router.delete('/folders/:folderId', authenticate, AssetLibraryController.deleteFolder);
router.patch('/:assetId/folder', authenticate, AssetLibraryController.moveAssetToFolder);
router.delete('/:assetId', authenticate, AssetLibraryController.deleteAsset);
router.post('/', authenticate, assetLibraryUploadMiddleware, AssetLibraryController.upload);

export default router;
