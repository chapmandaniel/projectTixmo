import multer from 'multer';
import os from 'os';
import { readFile, unlink } from 'fs/promises';
import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';
import { assetLibraryService } from './service';

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
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }

    cb(null, true);
  },
});

export const assetLibraryUploadMiddleware = upload.array('files', 10);

const hasSignature = (buffer: Buffer, signature: number[], offset = 0) =>
  signature.every((byte, index) => buffer[offset + index] === byte);

const sniffMimeType = (buffer: Buffer) => {
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

      const detectedMimeType = sniffMimeType(sample);
      if (!detectedMimeType) {
        throw ApiError.badRequest(`Unable to verify file type for ${file.originalname}`);
      }

      const expectedMimeType = file.mimetype === 'video/quicktime' ? 'video/mp4' : file.mimetype;
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
      const result = await assetLibraryService.upload(userId, files);
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      return next(error);
    }
  },
};
