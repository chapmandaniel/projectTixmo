import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /waitlists/join:
 *   post:
 *     summary: Join waitlist
 *     description: Join the waitlist for a sold-out event
 *     tags: [Waitlists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Joined waitlist successfully
 *       409:
 *         description: Already on waitlist
 *       404:
 *         description: Event not found
 */
router.post('/join', validate(controller.joinWaitlistSchema), controller.joinWaitlist);

/**
 * @swagger
 * /waitlists/leave:
 *   post:
 *     summary: Leave waitlist
 *     description: Remove yourself from a waitlist
 *     tags: [Waitlists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Left waitlist successfully
 *       404:
 *         description: Not on waitlist
 */
router.post('/leave', validate(controller.leaveWaitlistSchema), controller.leaveWaitlist);

/**
 * @swagger
 * /waitlists/status:
 *   get:
 *     summary: Get waitlist status
 *     description: Check if you are on the waitlist for an event
 *     tags: [Waitlists]
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
 *         description: Status retrieved successfully
 */
router.get('/status', controller.getWaitlistStatus);

export default router;
