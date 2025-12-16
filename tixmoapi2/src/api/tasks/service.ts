import { PrismaClient, Task, TaskComment, Prisma } from '@prisma/client';
import { logger } from '../../config/logger';

const prisma = new PrismaClient();

export const TaskService = {
    /**
     * Create a new task
     */
    async createTask(data: Prisma.TaskCreateInput): Promise<Task> {
        logger.info('Creating new task', { title: data.title, organizationId: data.organization.connect?.id });
        return prisma.task.create({
            data,
            include: {
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                },
                comments: true,
            }
        });
    },

    /**
     * Get all tasks for an organization
     */
    async getTasks(organizationId: string, filters: Prisma.TaskWhereInput = {}): Promise<Task[]> {
        return prisma.task.findMany({
            where: {
                organizationId,
                ...filters,
            },
            include: {
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    },

    /**
     * Get a task by ID
     */
    async getTaskById(id: string, organizationId: string): Promise<Task | null> {
        return prisma.task.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
        });
    },

    /**
     * Update a task
     */
    async updateTask(id: string, organizationId: string, data: Prisma.TaskUpdateInput): Promise<Task> {
        logger.info(`Updating task ${id}`);

        // Check existence and ownership
        const existing = await prisma.task.findFirst({ where: { id, organizationId } });
        if (!existing) {
            throw new Error('Task not found or access denied');
        }

        return prisma.task.update({
            where: { id },
            data,
            include: {
                assignee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                },
                comments: true
            }
        });
    },

    /**
     * Delete a task
     */
    async deleteTask(id: string, organizationId: string): Promise<void> {
        // Check existence and ownership
        const existing = await prisma.task.findFirst({ where: { id, organizationId } });
        if (!existing) {
            throw new Error('Task not found or access denied');
        }
        await prisma.task.delete({
            where: { id },
        });
    },

    /**
     * Add a comment to a task
     */
    async addComment(taskId: string, userId: string, content: string): Promise<TaskComment> {
        return prisma.taskComment.create({
            data: {
                taskId,
                userId,
                content
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    },

    async getUserOrganizationId(userId: string): Promise<string | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true }
        });
        return user?.organizationId || null;
    }
};
