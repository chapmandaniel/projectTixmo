import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'PROMOTER'));

/**
 * @swagger
 * /analytics/sales:
 *   get:
 *     summary: Get sales analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sales analytics retrieved successfully
 */
router.get('/sales', validate(validation.analyticsQuerySchema), controller.getSalesAnalytics);

/**
 * @swagger
 * /analytics/events:
 *   get:
 *     summary: Get event analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Event analytics retrieved successfully
 */
router.get('/events', validate(validation.analyticsQuerySchema), controller.getEventAnalytics);

/**
 * @swagger
 * /analytics/customers:
 *   get:
 *     summary: Get customer analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer analytics retrieved successfully
 */
router.get(
  '/customers',
  validate(validation.analyticsQuerySchema),
  controller.getCustomerAnalytics
);

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard summary (last 30 days)
 *     tags: [Analytics]
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
 *         description: Dashboard summary retrieved successfully
 */
router.get('/dashboard', validate(validation.dashboardQuerySchema), controller.getDashboardSummary);

export default router;
