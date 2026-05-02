import multer from 'multer';
import os from 'os';
import { readFile, unlink } from 'fs/promises';
import { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';
import { resolveTrustedClientOrigin } from '../../utils/clientOrigin';
import {
  addApprovalReviewersBodySchema,
  approvalCommentBodySchema,
  approvalDecisionBodySchema,
  approvalMetadataUpdateSchema,
  createApprovalBodySchema,
  createRevisionBodySchema,
} from './validation';
import { approvalService } from './service';

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

export const approvalCreateUploadMiddleware = upload.array('files', 10);
export const approvalRevisionUploadMiddleware = upload.array('files', 10);

const parseSchema = <T>(schema: { parse: (value: unknown) => T }, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw ApiError.badRequest(
        'Validation failed',
        error.errors.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    throw error;
  }
};

const getDashboardOrigin = (req: AuthRequest) =>
  resolveTrustedClientOrigin(req.get('origin'), req.get('referer'));

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

export const ApprovalController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(createApprovalBodySchema, req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const organizationId = await approvalService.getUserOrganizationId(userId);

      if (!organizationId) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ message: 'User does not belong to an organization' });
      }

      const approval = await approvalService.create({
        organizationId,
        createdById: userId,
        eventId: body.eventId,
        title: body.title,
        description: body.description,
        deadline: new Date(body.deadline),
        reviewers: body.reviewers,
        files,
        dashboardOrigin: getDashboardOrigin(req),
      });

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const result = await approvalService.list(userId, req.query as any);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const approval = await approvalService.getById(req.params.id, userId);
      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async updateMetadata(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(approvalMetadataUpdateSchema, req.body);
      const approval = await approvalService.updateMetadata(req.params.id, userId, {
        title: body.title,
        description: body.description,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
      });

      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async addReviewers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(addApprovalReviewersBodySchema, req.body);
      const approval = await approvalService.addReviewers(
        req.params.id,
        userId,
        body.reviewers,
        getDashboardOrigin(req)
      );

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async resendReviewerInvite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const approval = await approvalService.resendReviewerInvite(
        req.params.id,
        req.params.reviewerId,
        userId,
        getDashboardOrigin(req)
      );
      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async removeReviewer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const approval = await approvalService.removeReviewer(
        req.params.id,
        req.params.reviewerId,
        userId
      );
      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async createRevision(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(createRevisionBodySchema, req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      await validateUploadedFiles(files);
      const approval = await approvalService.createRevision(
        req.params.id,
        userId,
        {
          summary: body.summary,
          files,
        },
        getDashboardOrigin(req)
      );

      return res.status(StatusCodes.CREATED).json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async addComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(approvalCommentBodySchema, req.body);
      const comment = await approvalService.addCommentByUser(
        req.params.id,
        userId,
        body,
        getDashboardOrigin(req)
      );

      return res.status(StatusCodes.CREATED).json(comment);
    } catch (error) {
      return next(error);
    }
  },

  async deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const approval = await approvalService.deleteCommentByUser(
        req.params.id,
        req.params.commentId,
        userId
      );
      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },

  async submitDecision(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      const body = parseSchema(approvalDecisionBodySchema, req.body);
      const decision = await approvalService.submitDecisionByUser(
        req.params.id,
        userId,
        body,
        getDashboardOrigin(req)
      );

      return res.json(decision);
    } catch (error) {
      return next(error);
    }
  },

  async getByToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const review = await approvalService.getByToken(req.params.token);
      return res.json(review);
    } catch (error) {
      return next(error);
    }
  },

  async addExternalComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = parseSchema(approvalCommentBodySchema, req.body);
      const comment = await approvalService.addCommentByToken(req.params.token, body);

      return res.status(StatusCodes.CREATED).json(comment);
    } catch (error) {
      return next(error);
    }
  },

  async addExternalReviewers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = parseSchema(addApprovalReviewersBodySchema, req.body);
      const review = await approvalService.addReviewersByToken(
        req.params.token,
        body.reviewers,
        getDashboardOrigin(req)
      );

      return res.status(StatusCodes.CREATED).json(review);
    } catch (error) {
      return next(error);
    }
  },

  async submitExternalDecision(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = parseSchema(approvalDecisionBodySchema, req.body);
      const decision = await approvalService.submitDecisionByToken(req.params.token, body);

      return res.json(decision);
    } catch (error) {
      return next(error);
    }
  },

  async deleteExternalComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const approval = await approvalService.deleteCommentByToken(
        req.params.token,
        req.params.commentId
      );
      return res.json(approval);
    } catch (error) {
      return next(error);
    }
  },
};
