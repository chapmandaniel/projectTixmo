import { Response, NextFunction } from 'express';
import { approvalService } from './service';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../../middleware/auth';
import multer from 'multer';
import os from 'os';

// Configure multer for disk storage
const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        },
    }),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit per file
        files: 10, // Max 10 files per upload
    },
    fileFilter: (_req, file, cb) => {
        // Allow images, PDFs, and common design files
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'application/pdf',
            'video/mp4',
            'video/webm',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
    },
});

export const uploadMiddleware = upload.array('files', 10);

export const ApprovalController = {
    /**
     * Create a new approval request
     */
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const { eventId, title, description, instructions, priority, dueDate } = req.body;

            const approval = await approvalService.create({
                organizationId,
                eventId,
                createdById: userId,
                title,
                description,
                instructions,
                priority,
                dueDate: dueDate ? new Date(dueDate) : undefined,
            });

            return res.status(StatusCodes.CREATED).json(approval);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * List approval requests with filters
     */
    async list(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const { eventId, status, page, limit } = req.query;

            const result = await approvalService.list(organizationId, {
                eventId: eventId as string,
                status: status as any,
                page: page ? parseInt(page as string, 10) : undefined,
                limit: limit ? parseInt(limit as string, 10) : undefined,
            });

            return res.json(result);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Get approval request by ID
     */
    async getById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const approval = await approvalService.getById(id, organizationId);
            if (!approval) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: 'Approval request not found' });
            }

            return res.json(approval);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Update approval request
     */
    async update(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const { title, description, instructions, priority, dueDate } = req.body;

            const approval = await approvalService.update(id, organizationId, {
                title,
                description,
                instructions,
                priority,
                dueDate: dueDate ? new Date(dueDate) : dueDate === null ? null : undefined,
            });

            return res.json(approval);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Delete approval request
     */
    async delete(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            await approvalService.delete(id, organizationId);
            return res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Upload assets
     */
    async uploadAssets(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({ message: 'No files provided' });
            }

            const assets = await approvalService.uploadAssets(id, organizationId, files);
            return res.status(StatusCodes.CREATED).json(assets);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Delete asset
     */
    async deleteAsset(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id, assetId } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            await approvalService.deleteAsset(id, assetId, organizationId);
            return res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Add reviewers
     */
    async addReviewers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const { reviewers } = req.body;
            const createdReviewers = await approvalService.addReviewers(id, organizationId, reviewers);

            // TODO: Send email notifications to reviewers

            return res.status(StatusCodes.CREATED).json(createdReviewers);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Remove reviewer
     */
    async removeReviewer(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id, reviewerId } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            await approvalService.removeReviewer(id, reviewerId, organizationId);
            return res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Submit for review
     */
    async submitForReview(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const approval = await approvalService.submitForReview(id, organizationId);

            // TODO: Send email notifications to all reviewers

            return res.json(approval);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Add comment (authenticated user)
     */
    async addComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            // Verify approval exists
            const approval = await approvalService.getById(id, organizationId);
            if (!approval) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: 'Approval request not found' });
            }

            const { content, assetId, annotation } = req.body;
            const comment = await approvalService.addComment(id, userId, { content, assetId, annotation });

            return res.status(StatusCodes.CREATED).json(comment);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Create revision and re-submit for review
     */
    async createRevision(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await approvalService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const approval = await approvalService.createRevision(id, organizationId);

            // TODO: Send email notifications to reviewers about new revision

            return res.json(approval);
        } catch (error) {
            return next(error);
        }
    },

    // ==========================================
    // External Reviewer Endpoints (No Auth)
    // ==========================================

    /**
     * Get approval by token (external reviewer)
     */
    async getByToken(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { token } = req.params;
            const result = await approvalService.getByToken(token);

            if (!result) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: 'Invalid or expired review link' });
            }

            // Hide tokens from other reviewers in response
            const sanitizedApproval = {
                ...result.approval,
                reviewers: result.approval.reviewers.map((r) => ({
                    id: r.id,
                    email: r.email,
                    name: r.name,
                    decision: r.decision,
                    decisionAt: r.decisionAt,
                })),
            };

            return res.json({
                approval: sanitizedApproval,
                reviewer: {
                    id: result.reviewer.id,
                    email: result.reviewer.email,
                    name: result.reviewer.name,
                    decision: result.reviewer.decision,
                    decisionAt: result.reviewer.decisionAt,
                },
            });
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Submit decision (external reviewer)
     */
    async submitDecision(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { token } = req.params;
            const { decision, note } = req.body;

            const reviewer = await approvalService.submitDecision(token, decision, note);

            // TODO: Send email notification to approval creator

            return res.json(reviewer);
        } catch (error) {
            return next(error);
        }
    },

    /**
     * Add comment (external reviewer)
     */
    async addExternalComment(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { token } = req.params;
            const { content, assetId, annotation } = req.body;

            const comment = await approvalService.addExternalComment(token, { content, assetId, annotation });

            return res.status(StatusCodes.CREATED).json(comment);
        } catch (error) {
            return next(error);
        }
    },
};
