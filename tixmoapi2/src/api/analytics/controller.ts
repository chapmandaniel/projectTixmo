import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { analyticsService } from './service';
import { assertEventAccess, getActorScope, resolveOrganizationFilter } from '../../utils/tenantScope';

export const getSalesAnalytics = catchAsync(async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, organizationId, eventId } = req.query;
  const actor = await getActorScope(req);
  const scopedOrganizationId = resolveOrganizationFilter(
    actor,
    organizationId as string | undefined
  );
  if (eventId) {
    await assertEventAccess(actor, eventId as string);
  }

  const analytics = await analyticsService.getSalesAnalytics({
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    organizationId: scopedOrganizationId,
    eventId: eventId as string | undefined,
  });

  res.json(successResponse(analytics));
});

export const getEventAnalytics = catchAsync(async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, organizationId, eventId } = req.query;
  const actor = await getActorScope(req);
  const scopedOrganizationId = resolveOrganizationFilter(
    actor,
    organizationId as string | undefined
  );
  if (eventId) {
    await assertEventAccess(actor, eventId as string);
  }

  const analytics = await analyticsService.getEventAnalytics({
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    organizationId: scopedOrganizationId,
    eventId: eventId as string | undefined,
  });

  res.json(successResponse(analytics));
});

export const getCustomerAnalytics = catchAsync(async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, organizationId, eventId } = req.query;
  const actor = await getActorScope(req);
  const scopedOrganizationId = resolveOrganizationFilter(
    actor,
    organizationId as string | undefined
  );
  if (eventId) {
    await assertEventAccess(actor, eventId as string);
  }

  const analytics = await analyticsService.getCustomerAnalytics({
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    organizationId: scopedOrganizationId,
    eventId: eventId as string | undefined,
  });

  res.json(successResponse(analytics));
});

export const getDashboardSummary = catchAsync(async (req: AuthRequest, res: Response) => {
  const { organizationId } = req.query;
  const actor = await getActorScope(req);
  const scopedOrganizationId = resolveOrganizationFilter(
    actor,
    organizationId as string | undefined
  );

  const summary = await analyticsService.getDashboardSummary(scopedOrganizationId);

  res.json(successResponse(summary));
});
