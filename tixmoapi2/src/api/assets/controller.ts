import multer from 'multer';
import os from 'os';
import { readFile, unlink } from 'fs/promises';
import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';
import { resolveTrustedClientOrigin } from '../../utils/clientOrigin';
import { assetLibraryService } from './service';

const STANDARD_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const EPS_MIME_TYPES = new Set([
  'application/postscript',
  'application/eps',
  'image/x-eps',
  'image/eps',
]);

const FALLBACK_MIME_TYPES = new Set(['application/octet-stream', '']);

const hasEpsExtension = (filename = '') => filename.toLowerCase().endsWith('.eps');

export const isAllowedAssetUploadType = (file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>) => {
  if (STANDARD_ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return true;
  }

  return hasEpsExtension(file.originalname) && (EPS_MIME_TYPES.has(file.mimetype) || FALLBACK_MIME_TYPES.has(file.mimetype));
};

const getExpectedMimeType = (file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>) => {
  if (file.mimetype === 'video/quicktime') {
    return 'video/mp4';
  }

  if (hasEpsExtension(file.originalname) && (EPS_MIME_TYPES.has(file.mimetype) || FALLBACK_MIME_TYPES.has(file.mimetype))) {
    return 'application/postscript';
  }

  return file.mimetype;
};

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAssetUploadType(file)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }

    cb(null, true);
  },
});

export const assetLibraryUploadMiddleware = upload.array('files', 10);

const hasSignature = (buffer: Buffer, signature: number[], offset = 0) =>
  signature.every((byte, index) => buffer[offset + index] === byte);

export const sniffAssetMimeType = (buffer: Buffer) => {
  if (hasSignature(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  const postscriptHeader = buffer.subarray(0, 512).toString('latin1');
  if (postscriptHeader.startsWith('%!PS-Adobe') && /\bEPSF\b/.test(postscriptHeader)) {
    return 'application/postscript';
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (hasSignature(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';

  return undefined;
};

const cleanupUploadedFiles = async (files: Express.Multer.File[]) => {
  await Promise.all(
    files.map(async (file) => {
      if (!file.path) return;

      try {
        await unlink(file.path);
      } catch (_error) {
        // Best-effort cleanup only.
      }
    })
  );
};

const validateUploadedFiles = async (files: Express.Multer.File[]) => {
  try {
    for (const file of files) {
      const sample = file.buffer || (file.path ? await readFile(file.path) : undefined);
      if (!sample) {
        throw ApiError.badRequest('Uploaded file content is empty');
      }

      const detectedMimeType = sniffAssetMimeType(sample);
      if (!detectedMimeType) {
        throw ApiError.badRequest(`Unable to verify file type for ${file.originalname}`);
      }

      const expectedMimeType = getExpectedMimeType(file);
      if (detectedMimeType !== expectedMimeType) {
        throw ApiError.badRequest(`File type mismatch for ${file.originalname}`);
      }
    }
  } catch (error) {
    await cleanupUploadedFiles(files);
    throw error;
  }
};

export const AssetLibraryController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.list(userId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const result = await assetLibraryService.upload(userId, files, {
        usageType: req.body?.usageType || req.body?.collectionType,
        eventId: req.body?.eventId,
        category: req.body?.category,
        folderId: req.body?.folderId,
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
    }
  },

  async createFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.createFolder(userId, {
        name: req.body?.name,
        parentId: req.body?.parentId,
        eventId: req.body?.eventId,
        category: req.body?.category,
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
    }
  },

  async listFolderShares(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.listFolderShares(
        userId,
        req.params.folderId,
        resolveTrustedClientOrigin(req.get('origin'), req.get('referer'))
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async createFolderShare(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.createFolderShare(userId, req.params.folderId, {
        recipientLabel: req.body?.recipientLabel,
        expiresInDays: req.body?.expiresInDays,
        folderIds: Array.isArray(req.body?.folderIds) ? req.body.folderIds : [],
        dashboardOrigin: resolveTrustedClientOrigin(req.get('origin'), req.get('referer')),
      });
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
    }
  },

  async revokeFolderShare(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.revokeFolderShare(
        userId,
        req.params.folderId,
        req.params.shareId
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async getSharedFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await assetLibraryService.getSharedFolder(req.params.token);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async moveAssetToFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.moveAssetToFolder(
        userId,
        req.params.assetId,
        req.body?.folderId
      );
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async deleteAsset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.deleteAsset(userId, req.params.assetId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async deleteFolder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await assetLibraryService.deleteFolder(userId, req.params.folderId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
};
