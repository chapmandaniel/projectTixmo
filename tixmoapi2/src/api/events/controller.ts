import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { eventService } from './service';
import { eventStatsService } from './stats.service';

export const createEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof eventService.createEvent>[0];
  const event = await eventService.createEvent(payload);
  res.status(201).json(successResponse(event, 'Event created successfully'));
});

export const getEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const event = await eventService.getEventById(id);

  if (!event) {
    throw ApiError.notFound('Event not found');
  }

  res.json(successResponse(event));
});

export const updateEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const payload = req.body as Parameters<typeof eventService.updateEvent>[1];

  const event = await eventService.updateEvent(id, payload);
  res.json(successResponse(event, 'Event updated successfully'));
});

export const deleteEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await eventService.deleteEvent(id);
  res.status(204).send();
});

export const restoreEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const event = await eventService.restoreEvent(id);
  res.json(successResponse(event, 'Event restored successfully'));
});

export const listDeletedEvents = catchAsync(async (req: AuthRequest, res: Response) => {
  const raw = req.query as Record<string, unknown>;
  const page = raw.page !== undefined ? Number(raw.page) : undefined;
  const limit = raw.limit !== undefined ? Number(raw.limit) : undefined;
  const userId = req.user?.userId;
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const userOrgId = await eventService.getUserOrganizationId(userId);
  if (!userOrgId) {
    throw ApiError.forbidden('User does not belong to an organization');
  }

  // Force organizationId from user context
  const targetOrgId = userOrgId;

  const result = await eventService.listDeletedEvents(targetOrgId, page, limit);
  res.json(successResponse(result));
});

export const listEvents = catchAsync(async (req: AuthRequest, res: Response) => {
  const raw = req.query as Record<string, unknown>;
  const page = raw.page !== undefined ? Number(raw.page) : undefined;
  const limit = raw.limit !== undefined ? Number(raw.limit) : undefined;
  const userId = req.user?.userId;
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const userOrgId = await eventService.getUserOrganizationId(userId);
  if (!userOrgId) {
    throw ApiError.forbidden('User does not belong to an organization');
  }

  const query = {
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
    organizationId: userOrgId, // Force organizationId from user context
    venueId: raw.venueId as string | undefined,
    status: raw.status as Parameters<typeof eventService.listEvents>[0]['status'],
    search: raw.search as string | undefined,
  } as Parameters<typeof eventService.listEvents>[0];

  const result = await eventService.listEvents(query);
  res.json(successResponse(result));
});

export const publishEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const event = await eventService.publishEvent(id);
  res.json(successResponse(event, 'Event published successfully'));
});

export const cancelEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const event = await eventService.cancelEvent(id);
  res.json(successResponse(event, 'Event cancelled successfully'));
});

export const getEventStats = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const stats = await eventStatsService.getEventStats(id);
  res.json(successResponse(stats));
});

export const getEventOccupancy = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const occupancy = await eventStatsService.getCurrentOccupancy(id);
  res.json(successResponse(occupancy));
});

export const getEntryTimeline = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const hours = req.query.hours ? Number(req.query.hours) : 24;

  const timeline = await eventStatsService.getEntryTimeline(id, hours);
  res.json(successResponse(timeline));
});

export const getScannerStats = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const stats = await eventStatsService.getScannerStats(id);
  res.json(successResponse(stats));
});

export const updateEventStatus = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const event = await eventService.transitionEventStatus(id, status);
  res.json(successResponse(event, `Event status updated to ${status}`));
});

export const cloneEvent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const event = await eventService.cloneEvent(id);
  res.status(201).json(successResponse(event, 'Event cloned successfully'));
});

