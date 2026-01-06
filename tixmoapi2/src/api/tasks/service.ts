import { PrismaClient, Task, TaskComment, Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { notificationApiService } from '../notifications/service';

const prisma = new PrismaClient();

export const TaskService = {
    /**
     * Create a new task
     */
    /**
     * Create a new task
     */
    async createTask(data: Prisma.TaskCreateInput, creatorId?: string): Promise<Task> {
        // Log basic info, careful with circular ref in data
        logger.info('Creating new task', { title: data.title });

        const task = await prisma.task.create({
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

        // Handle description mentions if creator is known
        if (creatorId && data.description) {
            this.processMentions({
                taskId: task.id,
                content: data.description,
                organizationId: task.organizationId,
                actorUserId: creatorId,
                taskTitle: task.title,
                source: 'DESCRIPTION'
            }).catch(err => logger.error('Failed to process creation mentions', err));
        }

        return task;
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
        const comment = await prisma.taskComment.create({
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

        // Fetch task details for notification context
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, title: true, organizationId: true }
        });

        if (task) {
            this.processMentions({
                taskId: task.id,
                content,
                organizationId: task.organizationId,
                actorUserId: userId,
                taskTitle: task.title,
                source: 'COMMENT',
                commentId: comment.id,
                actorName: comment.user.firstName // optimize: already fetched
            }).catch(err => logger.error('Failed to process comment mentions', err));
        }

        return comment;
    },

    async getUserOrganizationId(userId: string): Promise<string | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true }
        });
        return user?.organizationId || null;
    },

    /**
     * Internal helper to process @mentions
     */
    async processMentions(params: {
        taskId: string,
        content: string,
        organizationId: string,
        actorUserId: string,
        taskTitle: string,
        source: 'COMMENT' | 'DESCRIPTION',
        commentId?: string,
        actorName?: string
    }) {
        try {
            const { taskId, content, organizationId, actorUserId, taskTitle, source, commentId } = params;
            let actorName = params.actorName;

            if (!actorName) {
                const actor = await prisma.user.findUnique({
                    where: { id: actorUserId },
                    select: { firstName: true }
                });
                actorName = actor?.firstName || 'Someone';
            }

            // Regex to capture @Firstname and optional Lastname
            // e.g. @Daniel or @Daniel Chapman
            const mentionRegex = /@([a-zA-Z0-9]+)(?:\s([a-zA-Z0-9]+))?/g;
            let match;
            const mentionedQueries: any[] = [];

            // Reset regex lastIndex
            mentionRegex.lastIndex = 0;

            while ((match = mentionRegex.exec(content)) !== null) {
                const firstName = match[1];
                const lastName = match[2];

                const query: any = {
                    firstName: { equals: firstName, mode: 'insensitive' }
                };
                if (lastName) {
                    query.lastName = { equals: lastName, mode: 'insensitive' };
                }
                mentionedQueries.push(query);
            }

            if (mentionedQueries.length > 0) {
                const mentionedUsers = await prisma.user.findMany({
                    where: {
                        organizationId,
                        id: { not: actorUserId }, // Don't notify self
                        OR: mentionedQueries
                    },
                    select: { id: true, firstName: true }
                });

                // Deduplicate
                const uniqueUsers = [...new Map(mentionedUsers.map(u => [u.id, u])).values()];

                const contextMsg = source === 'COMMENT' ? 'commented' : 'mentioned you in a task';

                await Promise.all(uniqueUsers.map(u =>
                    notificationApiService.createNotification({
                        userId: u.id,
                        type: 'TASK_MENTION',
                        subject: `You were mentioned in "${taskTitle}"`,
                        message: `${actorName} ${contextMsg}: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
                        metadata: { taskId, commentId, source }
                    })
                ));

                if (uniqueUsers.length > 0) {
                    logger.info(`Sent ${uniqueUsers.length} mention notifications for task ${taskId} (${source})`);
                }
            }
        } catch (error) {
            logger.error('Error in processMentions', error);
        }
    }
};
