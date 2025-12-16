import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/', validate(validation.getNotificationsSchema), controller.getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put('/:id/read', controller.markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/read-all', controller.markAllAsRead);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 */
router.get('/preferences', controller.getPreferences);

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailOrderConfirm:
 *                 type: boolean
 *               emailTicketTransfer:
 *                 type: boolean
 *               emailEventReminder:
 *                 type: boolean
 *               emailPromo:
 *                 type: boolean
 *               emailAnnouncement:
 *                 type: boolean
 *               smsOrderConfirm:
 *                 type: boolean
 *               smsEventReminder:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put(
  '/preferences',
  validate(validation.updatePreferencesSchema),
  controller.updatePreferences
);

export default router;
