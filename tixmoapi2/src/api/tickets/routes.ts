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
 * /tickets:
 *   get:
 *     summary: List tickets
 *     description: Get a list of tickets for the authenticated user. Admins can see all tickets.
 *     tags: [Tickets]
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
 *         name: eventId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [VALID, USED, CANCELLED, TRANSFERRED]
 *     responses:
 *       200:
 *         description: Tickets retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listTicketsSchema), controller.listTickets);

// ── STATIC routes MUST come before /:id ──────────────────────

/**
 * @swagger
 * /tickets/validate:
 *   post:
 *     summary: Validate ticket
 *     description: Validate a ticket by barcode without checking it in
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *             properties:
 *               barcode:
 *                 type: string
 *                 example: TIX-1234567890-ABC
 *     responses:
 *       200:
 *         description: Validation result returned
 *       401:
 *         description: Unauthorized
 */
router.post('/validate', authorize('ADMIN', 'PROMOTER'), controller.validateTicket);

/**
 * @swagger
 * /tickets/check-in:
 *   post:
 *     summary: Check in ticket
 *     description: Mark ticket as used (check in at event entry)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *             properties:
 *               barcode:
 *                 type: string
 *                 example: TIX-1234567890-ABC
 *     responses:
 *       200:
 *         description: Ticket checked in successfully
 *       400:
 *         description: Ticket is not valid for check-in
 *       401:
 *         description: Unauthorized
 */
router.post('/check-in', authorize('ADMIN', 'PROMOTER'), controller.checkInTicket);

// ── PARAMETERIZED routes (/:id) ─────────────────────────────

/**
 * @swagger
 * /tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     description: Get detailed information about a ticket
 *     tags: [Tickets]
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
 *         description: Ticket retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
router.get('/:id', controller.getTicket);

/**
 * @swagger
 * /tickets/{id}/transfer:
 *   post:
 *     summary: Transfer ticket
 *     description: Transfer ticket to another user by email
 *     tags: [Tickets]
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
 *             required:
 *               - recipientEmail
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 example: recipient@example.com
 *     responses:
 *       200:
 *         description: Ticket transferred successfully
 *       400:
 *         description: Cannot transfer ticket
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket or recipient not found
 */
router.post('/:id/transfer', validate(validation.transferTicketSchema), controller.transferTicket);

/**
 * @swagger
 * /tickets/{id}/cancel:
 *   post:
 *     summary: Cancel ticket
 *     description: Cancel a ticket and request refund
 *     tags: [Tickets]
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
 *         description: Ticket cancelled successfully
 *       400:
 *         description: Cannot cancel ticket
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket not found
 */
router.post('/:id/cancel', controller.cancelTicket);

/**
 * @swagger
 * /tickets/{id}/qr:
 *   get:
 *     summary: Get ticket QR code
 *     description: Get the QR code for a ticket (generates if not exists)
 *     tags: [Tickets]
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
 *         description: QR code retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrCode:
 *                       type: string
 *                       description: QR code as data URL
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not ticket owner
 *       404:
 *         description: Ticket not found
 */
router.get('/:id/qr', controller.getTicketQRCode);

/**
 * @swagger
 * /tickets/{id}/regenerate-qr:
 *   post:
 *     summary: Regenerate ticket QR code
 *     description: Generate a new QR code for a ticket (useful after transfer or if compromised)
 *     tags: [Tickets]
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
 *         description: QR code regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrCode:
 *                       type: string
 *                       description: New QR code as data URL
 *       400:
 *         description: Cannot regenerate QR for used/cancelled tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not ticket owner
 *       404:
 *         description: Ticket not found
 */
router.post('/:id/regenerate-qr', controller.regenerateTicketQRCode);

export default router;
