import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

/**
 * @swagger
 * /reports/sales:
 *   get:
 *     summary: Get sales report
 *     description: Retrieve sales metrics with filters
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, event]
 *     responses:
 *       200:
 *         description: Sales report retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/sales',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.getSalesReportSchema),
  controller.getSalesReport
);

/**
 * @swagger
 * /reports/attendance:
 *   get:
 *     summary: Get attendance report
 *     description: Retrieve attendance metrics for an event
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Attendance report retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/attendance',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.getAttendanceReportSchema),
  controller.getAttendanceReport
);

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard stats
 *     description: Retrieve high-level dashboard statistics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.getDashboardStatsSchema),
  controller.getDashboardStats
);

export default router;
