import {
  PrismaClient,
  Notification,
  NotificationPreference,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const prisma = new PrismaClient();

export class NotificationApiService {
  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options?: { page?: number; limit?: number; unreadOnly?: boolean }
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options || {};
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden('You can only mark your own notifications as read');
    }

    return await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return result.count;
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreference> {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return preferences;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    data: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<NotificationPreference> {
    const existing = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (existing) {
      return await prisma.notificationPreference.update({
        where: { userId },
        data,
      });
    } else {
      return await prisma.notificationPreference.create({
        data: {
          userId,
          ...data,
        },
      });
    }
  }

  /**
   * Create notification (internal use)
   */
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    subject: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        subject: data.subject,
        message: data.message,
        metadata: data.metadata as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }
}

export const notificationApiService = new NotificationApiService();
