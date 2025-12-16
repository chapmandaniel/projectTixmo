import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     description: Create a new event for an organization. Requires ADMIN or PROMOTER role.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - organizationId
 *               - venueId
 *               - startDateTime
 *               - endDateTime
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Summer Music Festival 2025"
 *               description:
 *                 type: string
 *                 example: "Join us for an amazing night of live music"
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               venueId:
 *                 type: string
 *                 format: uuid
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-07-15T19:00:00Z"
 *               endDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-07-15T23:00:00Z"
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, CANCELLED]
 *                 default: DRAFT
 *               capacity:
 *                 type: integer
 *                 example: 5000
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Organization or venue not found
 */
router.post(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.createEventSchema),
  controller.createEvent
);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by ID
 *     description: Get detailed information about an event including venue and ticket counts
 *     tags: [Events]
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
 *         description: Event retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:id', controller.getEvent);

/**
 * @swagger
 * /events/{id}:
 *   put:
 *     summary: Update event
 *     description: Update event details
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               venueId:
 *                 type: string
 *                 format: uuid
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *               endDateTime:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, CANCELLED]
 *               capacity:
 *                 type: integer
 *               imageUrl:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.put(
  '/:id',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updateEventSchema),
  controller.updateEvent
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete event
 *     description: Delete an event (admin only). Cannot delete if event has tickets.
 *     tags: [Events]
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
 *       204:
 *         description: Event deleted successfully
 *       400:
 *         description: Cannot delete event with existing tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Event not found
 */
router.delete('/:id', authorize('ADMIN'), controller.deleteEvent);

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List all events
 *     description: Get a paginated list of events with optional filters
 *     tags: [Events]
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: venueId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listEventsSchema), controller.listEvents);

/**
 * @swagger
 * /events/{id}/publish:
 *   post:
 *     summary: Publish event
 *     description: Change event status from DRAFT to PUBLISHED
 *     tags: [Events]
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
 *         description: Event published successfully
 *       400:
 *         description: Event is already published or cancelled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.post('/:id/publish', authorize('ADMIN', 'PROMOTER'), controller.publishEvent);

/**
 * @swagger
 * /events/{id}/cancel:
 *   post:
 *     summary: Cancel event
 *     description: Change event status to CANCELLED
 *     tags: [Events]
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
 *         description: Event cancelled successfully
 *       400:
 *         description: Event is already cancelled
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.post('/:id/cancel', authorize('ADMIN', 'PROMOTER'), controller.cancelEvent);

/**
 * @swagger
 * /events/{id}/stats:
 *   get:
 *     summary: Get event statistics
 *     description: Get real-time statistics for an event including tickets, scans, and occupancy
 *     tags: [Events]
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
 *         description: Event statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:id/stats', authorize('ADMIN', 'PROMOTER'), controller.getEventStats);

/**
 * @swagger
 * /events/{id}/occupancy:
 *   get:
 *     summary: Get current occupancy
 *     description: Get real-time venue occupancy for the event
 *     tags: [Events]
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
 *         description: Occupancy data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:id/occupancy', authorize('ADMIN', 'PROMOTER'), controller.getEventOccupancy);

/**
 * @swagger
 * /events/{id}/timeline:
 *   get:
 *     summary: Get entry timeline
 *     description: Get hourly breakdown of entries and exits
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to look back
 *     responses:
 *       200:
 *         description: Entry timeline retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:id/timeline', authorize('ADMIN', 'PROMOTER'), controller.getEntryTimeline);

/**
 * @swagger
 * /events/{id}/scanner-stats:
 *   get:
 *     summary: Get scanner statistics
 *     description: Get statistics about scanner activity for the event
 *     tags: [Events]
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
 *         description: Scanner statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get('/:id/scanner-stats', authorize('ADMIN', 'PROMOTER'), controller.getScannerStats);

export default router;
