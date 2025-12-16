import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { notificationApiService } from './service';
import { NotificationPreference } from '@prisma/client';

export const getNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { page, limit, unreadOnly } = req.query;

  const result = await notificationApiService.getUserNotifications(userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    unreadOnly: unreadOnly === 'true',
  });

  res.json(successResponse(result));
});

export const markAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const notification = await notificationApiService.markAsRead(id, userId);
  res.json(successResponse(notification, 'Notification marked as read'));
});

export const markAllAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const count = await notificationApiService.markAllAsRead(userId);
  res.json(successResponse({ count }, `${count} notifications marked as read`));
});

export const getPreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const preferences = await notificationApiService.getPreferences(userId);
  res.json(successResponse(preferences));
});

export const updatePreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const data: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> =
    req.body;

  const preferences = await notificationApiService.updatePreferences(userId, data);
  res.json(successResponse(preferences, 'Notification preferences updated'));
});
