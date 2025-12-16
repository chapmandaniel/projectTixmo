import { Response, NextFunction } from 'express';
import { reportService } from './service';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

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
    let organizationId = req.query.organizationId as string | undefined;

    if (req.user!.role !== 'ADMIN') {
      // Fetch user's org
      const user = await (
        await import('@prisma/client')
      ).PrismaClient.prototype.user.findUnique({
        where: { id: req.user!.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        // If promoter has no org, they see nothing or error?
        // Let's assume they see nothing
        res.json(successResponse([]));
        return;
      }
      organizationId = user.organizationId;
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
    let organizationId = req.query.organizationId as string | undefined;

    if (req.user!.role !== 'ADMIN') {
      const user = await (
        await import('@prisma/client')
      ).PrismaClient.prototype.user.findUnique({
        where: { id: req.user!.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        res.json(
          successResponse({
            totalRevenue: 0,
            totalTicketsSold: 0,
            activeEvents: 0,
            recentOrders: [],
          })
        );
        return;
      }
      organizationId = user.organizationId;
    }

    const stats = await reportService.getDashboardStats({
      organizationId,
    });
    res.json(successResponse(stats, 'Dashboard stats retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
