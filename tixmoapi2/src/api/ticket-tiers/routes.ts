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
 * /ticket-tiers:
 *   post:
 *     summary: Create ticket tier
 *     description: Create a new pricing tier for a ticket type
 *     tags: [Ticket Tiers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ticketTypeId, name, price]
 *             properties:
 *               ticketTypeId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 example: Early Bird
 *               price:
 *                 type: number
 *                 example: 49.99
 *               quantityLimit:
 *                 type: integer
 *                 nullable: true
 *                 example: 100
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Tier created successfully
 */
router.post(
    '/',
    authorize('OWNER', 'ADMIN', 'PROMOTER'),
    validate(validation.createTierSchema),
    controller.createTier
);

/**
 * @swagger
 * /ticket-tiers:
 *   get:
 *     summary: List tiers by ticket type
 *     description: Get all pricing tiers for a specific ticket type
 *     tags: [Ticket Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketTypeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tiers retrieved successfully
 */
router.get('/', validate(validation.listTiersSchema), controller.listTiers);

/**
 * @swagger
 * /ticket-tiers/active:
 *   get:
 *     summary: Get active tier
 *     description: Get the currently active pricing tier for a ticket type
 *     tags: [Ticket Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ticketTypeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Active tier returned (null if none active)
 */
router.get('/active', validate(validation.listTiersSchema), controller.getActiveTier);

/**
 * @swagger
 * /ticket-tiers/reorder:
 *   post:
 *     summary: Reorder tiers
 *     description: Set the display/priority order of tiers for a ticket type
 *     tags: [Ticket Tiers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ticketTypeId, tierIds]
 *             properties:
 *               ticketTypeId:
 *                 type: string
 *                 format: uuid
 *               tierIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Tiers reordered successfully
 */
router.post(
    '/reorder',
    authorize('OWNER', 'ADMIN', 'PROMOTER'),
    validate(validation.reorderTiersSchema),
    controller.reorderTiers
);

/**
 * @swagger
 * /ticket-tiers/{id}:
 *   get:
 *     summary: Get tier by ID
 *     tags: [Ticket Tiers]
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
 *         description: Tier retrieved successfully
 */
router.get('/:id', validate(validation.tierIdSchema), controller.getTier);

/**
 * @swagger
 * /ticket-tiers/{id}:
 *   put:
 *     summary: Update tier
 *     tags: [Ticket Tiers]
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
 *               price:
 *                 type: number
 *               quantityLimit:
 *                 type: integer
 *                 nullable: true
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               sortOrder:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tier updated successfully
 */
router.put(
    '/:id',
    authorize('OWNER', 'ADMIN', 'PROMOTER'),
    validate(validation.updateTierSchema),
    controller.updateTier
);

/**
 * @swagger
 * /ticket-tiers/{id}:
 *   delete:
 *     summary: Delete tier
 *     description: Delete a tier (only if no tickets sold at this tier)
 *     tags: [Ticket Tiers]
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
 *         description: Tier deleted successfully
 */
router.delete(
    '/:id',
    authorize('OWNER', 'ADMIN', 'PROMOTER'),
    validate(validation.tierIdSchema),
    controller.deleteTier
);

export default router;
