import { Response, NextFunction } from 'express';
import { reportService } from './service';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import {
  assertEventAccess,
  getActorScope,
  resolveOrganizationFilter,
} from '../../utils/tenantScope';

/**
 * Get sales report
 */
export const getSalesReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // If user is admin, they can see all or filter by any org
    // If user is promoter, force organizationId to their org
    const actor = await getActorScope(req);
    const organizationId = resolveOrganizationFilter(
      actor,
      req.query.organizationId as string | undefined
    );

    if (req.query.eventId) {
      await assertEventAccess(actor, req.query.eventId as string);
    }

    const report = await reportService.getSalesReport({
      ...req.query,
      organizationId,
    });
    res.json(successResponse(report, 'Sales report retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance report
 */
export const getAttendanceReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const actor = await getActorScope(req);
    await assertEventAccess(actor, req.query.eventId as string);

    const report = await reportService.getAttendanceReport({
      eventId: req.query.eventId as string,
    });
    res.json(successResponse(report, 'Attendance report retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard stats
 */
export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const actor = await getActorScope(req);
    const organizationId = resolveOrganizationFilter(
      actor,
      req.query.organizationId as string | undefined
    );

    const stats = await reportService.getDashboardStats({
      organizationId,
    });
    res.json(successResponse(stats, 'Dashboard stats retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
