import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authenticateScanner } from '../../middleware/scannerAuth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

/**
 * @swagger
 * /scanners/register:
 *   post:
 *     summary: Register new scanner
 *     description: Register a new scanner device for an organization/event
 *     tags: [Scanners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - organizationId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Main Entrance Scanner
 *               deviceId:
 *                 type: string
 *                 example: DEVICE-12345
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               eventId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Scanner registered successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post(
  '/register',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.registerScannerSchema),
  controller.registerScanner
);

/**
 * @swagger
 * /scanners/auth:
 *   post:
 *     summary: Authenticate scanner
 *     description: Authenticate a scanner using API key
 *     tags: [Scanners]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 example: sk_scanner_abc123...
 *     responses:
 *       200:
 *         description: Scanner authenticated successfully
 *       401:
 *         description: Invalid API key
 *       403:
 *         description: Scanner disabled or revoked
 */
router.post(
  '/auth',
  validate(validation.authenticateScannerSchema),
  controller.authenticateScanner
);

/**
 * @swagger
 * /scanners/sync:
 *   get:
 *     summary: Sync tickets
 *     description: Download valid tickets for offline validation
 *     tags: [Scanners]
 *     security:
 *       - scannerApiKey: []
 *     parameters:
 *       - in: query
 *         name: eventId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Tickets synced successfully
 *       401:
 *         description: Invalid scanner API key
 */
router.get(
  '/sync',
  authenticateScanner,
  validate(validation.syncTicketsSchema),
  controller.syncTickets
);

/**
 * @swagger
 * /scanners/validate:
 *   post:
 *     summary: Upload offline scans
 *     description: Upload batch of scans performed offline
 *     tags: [Scanners]
 *     security:
 *       - scannerApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scans
 *             properties:
 *               scans:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - qrData
 *                     - scannedAt
 *                   properties:
 *                     qrData:
 *                       type: string
 *                     scannedAt:
 *                       type: string
 *                       format: date-time
 *                     scanType:
 *                       type: string
 *                       enum: [ENTRY, EXIT, VALIDATION]
 *     responses:
 *       200:
 *         description: Scans processed successfully
 *       401:
 *         description: Invalid scanner API key
 */
router.post(
  '/validate',
  authenticateScanner,
  validate(validation.offlineScanSchema),
  controller.syncOfflineScans
);

/**
 * @swagger
 * /scanners:
 *   get:
 *     summary: List scanners
 *     description: Get list of scanners with optional filters
 *     tags: [Scanners]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED, REVOKED]
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
 *     responses:
 *       200:
 *         description: Scanners retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.listScannersSchema),
  controller.listScanners
);

/**
 * @swagger
 * /scanners/scan:
 *   post:
 *     summary: Scan ticket
 *     description: Scan a ticket using QR code (requires scanner API key)
 *     tags: [Scanners]
 *     security:
 *       - scannerApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrData
 *             properties:
 *               qrData:
 *                 type: string
 *                 description: QR code data from ticket
 *                 example: TICKET:123e4567-e89b-12d3-a456-426614174000:TIX-1234567890-ABC:987e6543-e21b-98d7-a654-321987654321
 *               scanType:
 *                 type: string
 *                 enum: [ENTRY, EXIT, VALIDATION]
 *                 default: ENTRY
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Scan completed (check success field for result)
 *       401:
 *         description: Invalid scanner API key
 */
router.post(
  '/scan',
  authenticateScanner,
  validate(validation.scanTicketSchema),
  controller.scanTicket
);

/**
 * @swagger
 * /scanners/logs:
 *   get:
 *     summary: Get scan logs
 *     description: Retrieve scan history with filters
 *     tags: [Scanners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scannerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: ticketId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: success
 *         schema:
 *           type: boolean
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
 *     responses:
 *       200:
 *         description: Scan logs retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/logs',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.getScanLogsSchema),
  controller.getScanLogs
);

/**
 * @swagger
 * /scanners/{id}:
 *   get:
 *     summary: Get scanner by ID
 *     description: Get detailed information about a scanner
 *     tags: [Scanners]
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
 *         description: Scanner retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scanner not found
 */
router.get('/:id', authenticate, authorize('ADMIN', 'PROMOTER'), controller.getScanner);

/**
 * @swagger
 * /scanners/{id}:
 *   put:
 *     summary: Update scanner
 *     description: Update scanner details
 *     tags: [Scanners]
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
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED, REVOKED]
 *               eventId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Scanner updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scanner not found
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updateScannerSchema),
  controller.updateScanner
);

/**
 * @swagger
 * /scanners/{id}:
 *   delete:
 *     summary: Delete scanner
 *     description: Revoke scanner access (soft delete)
 *     tags: [Scanners]
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
 *         description: Scanner deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scanner not found
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'PROMOTER'), controller.deleteScanner);

export default router;
