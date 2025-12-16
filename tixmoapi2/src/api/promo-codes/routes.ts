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
 * /promo-codes:
 *   post:
 *     summary: Create promo code
 *     description: Create a new promotional discount code. Requires ADMIN or PROMOTER role.
 *     tags: [Promo Codes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - discountType
 *               - discountValue
 *             properties:
 *               code:
 *                 type: string
 *                 example: SUMMER2025
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED_AMOUNT]
 *               discountValue:
 *                 type: number
 *                 example: 20
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               maxUses:
 *                 type: integer
 *                 example: 100
 *               maxUsesPerUser:
 *                 type: integer
 *                 example: 1
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *               minOrderAmount:
 *                 type: number
 *                 example: 50
 *     responses:
 *       201:
 *         description: Promo code created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Promo code already exists
 */
router.post(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.createPromoCodeSchema),
  controller.createPromoCode
);

/**
 * @swagger
 * /promo-codes/{id}:
 *   get:
 *     summary: Get promo code by ID
 *     description: Get detailed information about a promo code
 *     tags: [Promo Codes]
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
 *         description: Promo code retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Promo code not found
 */
router.get('/:id', authorize('ADMIN', 'PROMOTER'), controller.getPromoCode);

/**
 * @swagger
 * /promo-codes/{id}:
 *   put:
 *     summary: Update promo code
 *     description: Update promo code details
 *     tags: [Promo Codes]
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
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED_AMOUNT]
 *               discountValue:
 *                 type: number
 *               maxUses:
 *                 type: integer
 *               maxUsesPerUser:
 *                 type: integer
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *               minOrderAmount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, EXPIRED]
 *     responses:
 *       200:
 *         description: Promo code updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Promo code not found
 */
router.put(
  '/:id',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updatePromoCodeSchema),
  controller.updatePromoCode
);

/**
 * @swagger
 * /promo-codes/{id}:
 *   delete:
 *     summary: Delete promo code
 *     description: Delete a promo code (admin only). Cannot delete if it has been used.
 *     tags: [Promo Codes]
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
 *         description: Promo code deleted successfully
 *       400:
 *         description: Cannot delete used promo code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Promo code not found
 */
router.delete('/:id', authorize('ADMIN', 'PROMOTER'), controller.deletePromoCode);

/**
 * @swagger
 * /promo-codes:
 *   get:
 *     summary: List promo codes
 *     description: Get a paginated list of promo codes
 *     tags: [Promo Codes]
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, EXPIRED]
 *     responses:
 *       200:
 *         description: Promo codes retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.listPromoCodesSchema),
  controller.listPromoCodes
);

/**
 * @swagger
 * /promo-codes/validate:
 *   post:
 *     summary: Validate promo code
 *     description: Check if a promo code is valid and calculate discount
 *     tags: [Promo Codes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: SUMMER2025
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               orderAmount:
 *                 type: number
 *                 example: 100.00
 *     responses:
 *       200:
 *         description: Validation result returned
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/validate',
  validate(validation.validatePromoCodeSchema),
  controller.validatePromoCode
);

export default router;
