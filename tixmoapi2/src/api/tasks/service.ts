import { Task, TaskComment, Prisma } from '@prisma/client';
import { logger } from '../../config/logger';
import { notificationApiService } from '../notifications/service';
import { mentionsNeedingFirstNameFallback, parseNameMentions } from './mentions';

import prisma from '../../config/prisma';

const taskEventSelect = { id: true, name: true, slug: true, ticketingMode: true };

export const TaskService = {
  async assertTaskEvent(organizationId: string, eventId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!event) throw new Error('Event not found or access denied');
  },

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
          },
        },
        comments: true,
        event: { select: taskEventSelect },
      },
    });

    // Await mention processing so a 201 means notification rows are written.
    // Mention failures must not fail task creation (the row is already stored).
    if (creatorId && data.description) {
      try {
        await this.processMentions({
          taskId: task.id,
          content: data.description,
          organizationId: task.organizationId,
          actorUserId: creatorId,
          taskTitle: task.title,
          source: 'DESCRIPTION',
        });
      } catch (err) {
        const detail = err instanceof Error ? err.stack || err.message : String(err);
        logger.error(
          `Failed to process creation mentions taskId=${task.id} organizationId=${task.organizationId} actorUserId=${creatorId} source=DESCRIPTION: ${detail}`
        );
      }
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
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        event: { select: taskEventSelect },
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
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        event: { select: taskEventSelect },
      },
    });
  },

  /**
   * Update a task
   */
  async updateTask(
    id: string,
    organizationId: string,
    data: Prisma.TaskUpdateInput
  ): Promise<Task> {
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
          },
        },
        comments: true,
        event: { select: taskEventSelect },
      },
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
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Fetch task details for notification context
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, organizationId: true },
    });

    if (task) {
      try {
        await this.processMentions({
          taskId: task.id,
          content,
          organizationId: task.organizationId,
          actorUserId: userId,
          taskTitle: task.title,
          source: 'COMMENT',
          commentId: comment.id,
          actorName: comment.user.firstName, // optimize: already fetched
        });
      } catch (err) {
        const detail = err instanceof Error ? err.stack || err.message : String(err);
        logger.error(
          `Failed to process comment mentions taskId=${task.id} commentId=${comment.id} organizationId=${task.organizationId} actorUserId=${userId} source=COMMENT: ${detail}`
        );
      }
    }

    return comment;
  },

  async getUserOrganizationId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  },

  /**
   * Internal helper to process @mentions
   */
  async processMentions(params: {
    taskId: string;
    content: string;
    organizationId: string;
    actorUserId: string;
    taskTitle: string;
    source: 'COMMENT' | 'DESCRIPTION';
    commentId?: string;
    actorName?: string;
  }) {
    const { taskId, content, organizationId, actorUserId, taskTitle, source, commentId } = params;
    try {
      let actorName = params.actorName;

      if (!actorName) {
        const actor = await prisma.user.findUnique({
          where: { id: actorUserId },
          select: { firstName: true },
        });
        actorName = actor?.firstName || 'Someone';
      }

      const mentions = parseNameMentions(content);
      if (mentions.length === 0) return;

      const scopedToOrg = {
        organizationId,
        id: { not: actorUserId }, // Don't notify self
      };

      const mentionedUsers: Array<{ id: string; firstName: string; lastName: string | null }> = [];
      const withLastName = mentions.filter((mention) => mention.lastName);
      if (withLastName.length > 0) {
        const fullNameMatches = await prisma.user.findMany({
          where: {
            ...scopedToOrg,
            OR: withLastName.map((mention) => ({
              firstName: { equals: mention.firstName, mode: 'insensitive' as const },
              lastName: { equals: mention.lastName, mode: 'insensitive' as const },
            })),
          },
          select: { id: true, firstName: true, lastName: true },
        });
        mentionedUsers.push(...fullNameMatches);
      }

      const firstNameLookups = mentionsNeedingFirstNameFallback(mentions, mentionedUsers);
      if (firstNameLookups.length > 0) {
        const firstNameMatches = await prisma.user.findMany({
          where: {
            ...scopedToOrg,
            OR: firstNameLookups.map((mention) => ({
              firstName: { equals: mention.firstName, mode: 'insensitive' as const },
            })),
          },
          select: { id: true, firstName: true, lastName: true },
        });
        mentionedUsers.push(...firstNameMatches);
      }

      const uniqueUsers = [...new Map(mentionedUsers.map((u) => [u.id, u])).values()];
      if (uniqueUsers.length === 0) return;

      const contextMsg = source === 'COMMENT' ? 'commented' : 'mentioned you in a task';

      await Promise.all(
        uniqueUsers.map((u) =>
          notificationApiService.createNotification({
            userId: u.id,
            type: 'TASK_MENTION',
            subject: `You were mentioned in "${taskTitle}"`,
            message: `${actorName} ${contextMsg}: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
            metadata: { taskId, commentId, source },
          })
        )
      );

      logger.info(
        `Sent ${uniqueUsers.length} mention notifications for task ${taskId} (${source})`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.stack || error.message : String(error);
      logger.error(
        `Error in processMentions taskId=${taskId} commentId=${commentId ?? ''} organizationId=${organizationId} actorUserId=${actorUserId} source=${source}: ${detail}`
      );
      throw error;
    }
  },
};
