import { Request, Response, NextFunction } from 'express';
import { TaskService } from './service';
import { StatusCodes } from 'http-status-codes';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';

export const TaskController = {
    create: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { title, description, priority, tag, assigneeId, attachments, dueDate, status } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });
            }

            const organizationId = await TaskService.getUserOrganizationId(userId);

            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const task = await TaskService.createTask({
                title,
                description,
                priority,
                tag,
                status,
                attachments,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                organization: { connect: { id: organizationId } },
                assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
            });

            res.status(StatusCodes.CREATED).json(task);
        } catch (error) {
            next(error);
        }
    },

    list: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });

            const organizationId = await TaskService.getUserOrganizationId(userId);
            if (!organizationId) {
                return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });
            }

            const filters: Prisma.TaskWhereInput = {};

            if (req.query.status) filters.status = req.query.status as any;
            if (req.query.priority) filters.priority = req.query.priority as any;
            if (req.query.tag) filters.tag = req.query.tag as any;
            if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;

            const tasks = await TaskService.getTasks(organizationId, filters);
            res.json(tasks);
        } catch (error) {
            next(error);
        }
    },

    getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });

            const organizationId = await TaskService.getUserOrganizationId(userId);
            if (!organizationId) return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });

            const task = await TaskService.getTaskById(id, organizationId);
            if (!task) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: 'Task not found' });
            }

            res.json(task);
        } catch (error) {
            next(error);
        }
    },

    update: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });

            const organizationId = await TaskService.getUserOrganizationId(userId);
            if (!organizationId) return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });

            const { title, description, status, priority, tag, assigneeId, attachments, dueDate } = req.body;

            const updateData: Prisma.TaskUpdateInput = {
                title,
                description,
                status,
                priority,
                tag,
                attachments,
                dueDate: dueDate ? new Date(dueDate) : undefined,
            };

            if (assigneeId) {
                updateData.assignee = { connect: { id: assigneeId } };
            } else if (assigneeId === null) {
                updateData.assignee = { disconnect: true };
            }

            const updatedTask = await TaskService.updateTask(id, organizationId, updateData);
            res.json(updatedTask);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
            }
            next(error);
        }
    },

    delete: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            if (!userId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });

            const organizationId = await TaskService.getUserOrganizationId(userId);
            if (!organizationId) return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });

            await TaskService.deleteTask(id, organizationId);
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
            }
            next(error);
        }
    },

    addComment: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { content } = req.body;
            const userId = req.user?.userId;
            if (!userId) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not authenticated' });

            const organizationId = await TaskService.getUserOrganizationId(userId);
            if (!organizationId) return res.status(StatusCodes.FORBIDDEN).json({ message: 'User does not belong to an organization' });

            // Verify task belongs to organization first
            const task = await TaskService.getTaskById(id, organizationId);
            if (!task) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: 'Task not found' });
            }

            const comment = await TaskService.addComment(id, userId, content);
            res.status(StatusCodes.CREATED).json(comment);
        } catch (error) {
            next(error);
        }
    }
};
