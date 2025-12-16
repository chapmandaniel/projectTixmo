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
 * /ticket-types:
 *   post:
 *     summary: Create a new ticket type
 *     description: Create a new ticket type for an event. Requires ADMIN or PROMOTER role.
 *     tags: [Ticket Types]
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
 *               - name
 *               - price
 *               - quantity
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 example: "General Admission"
 *               description:
 *                 type: string
 *                 example: "Standard entry ticket"
 *               price:
 *                 type: number
 *                 example: 50.00
 *               quantity:
 *                 type: integer
 *                 example: 1000
 *               maxPerOrder:
 *                 type: integer
 *                 example: 10
 *               salesStart:
 *                 type: string
 *                 format: date-time
 *               salesEnd:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Ticket type created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Event not found
 */
router.post(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.createTicketTypeSchema),
  controller.createTicketType
);

/**
 * @swagger
 * /ticket-types/{id}:
 *   get:
 *     summary: Get ticket type by ID
 *     description: Get detailed information about a ticket type
 *     tags: [Ticket Types]
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
 *         description: Ticket type retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 */
router.get('/:id', controller.getTicketType);

/**
 * @swagger
 * /ticket-types/{id}:
 *   put:
 *     summary: Update ticket type
 *     description: Update ticket type details
 *     tags: [Ticket Types]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: integer
 *               maxPerOrder:
 *                 type: integer
 *               salesStart:
 *                 type: string
 *                 format: date-time
 *               salesEnd:
 *                 type: string
 *                 format: date-time
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Ticket type updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 */
router.put(
  '/:id',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updateTicketTypeSchema),
  controller.updateTicketType
);

/**
 * @swagger
 * /ticket-types/{id}:
 *   delete:
 *     summary: Delete ticket type
 *     description: Delete a ticket type (admin only). Cannot delete if tickets have been sold.
 *     tags: [Ticket Types]
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
 *         description: Ticket type deleted successfully
 *       400:
 *         description: Cannot delete ticket type with sold tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Ticket type not found
 */
router.delete('/:id', authorize('ADMIN'), controller.deleteTicketType);

/**
 * @swagger
 * /ticket-types:
 *   get:
 *     summary: List ticket types for an event
 *     description: Get all ticket types for a specific event
 *     tags: [Ticket Types]
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
 *         description: Ticket types retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listTicketTypesSchema), controller.listTicketTypes);

/**
 * @swagger
 * /ticket-types/{id}/availability:
 *   post:
 *     summary: Check ticket availability
 *     description: Check if tickets are available for purchase
 *     tags: [Ticket Types]
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
 *               quantity:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Availability checked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 */
router.post('/:id/availability', controller.checkAvailability);

export default router;
