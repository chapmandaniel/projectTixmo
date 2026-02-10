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
 * /orders:
 *   post:
 *     summary: Create a new order
 *     description: Create a new order with tickets. This will hold inventory until payment is confirmed.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - ticketTypeId
 *                     - quantity
 *                   properties:
 *                     ticketTypeId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *               promoCode:
 *                 type: string
 *                 example: "SUMMER2025"
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid input or tickets not available
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 */
router.post('/', validate(validation.createOrderSchema), controller.createOrder);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     description: Get detailed information about an order. Users can only view their own orders unless they are admin.
 *     tags: [Orders]
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
 *         description: Order retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own orders
 *       404:
 *         description: Order not found
 */
router.get('/:id', controller.getOrder);

/**
 * @swagger
 * /orders/{id}/confirm:
 *   post:
 *     summary: Confirm order
 *     description: Confirm order after successful payment. This converts held inventory to sold and generates tickets.
 *     tags: [Orders]
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
 *         description: Order confirmed successfully
 *       400:
 *         description: Cannot confirm order in current status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
router.post('/:id/confirm', authorize('ADMIN', 'PROMOTER'), controller.confirmOrder);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel order
 *     description: Cancel a pending order and release held inventory. Users can cancel their own pending orders.
 *     tags: [Orders]
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
 *         description: Order cancelled successfully
 *       400:
 *         description: Cannot cancel order in current status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only cancel own orders
 *       404:
 *         description: Order not found
 */
router.post('/:id/cancel', controller.cancelOrder);

/**
 * @swagger
 * /orders/{id}/refund:
 *   post:
 *     summary: Refund order
 *     description: Refund a paid order. Admin only. Cancels all tickets and restores inventory.
 *     tags: [Orders]
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
 *         description: Order refunded successfully
 *       400:
 *         description: Only paid orders can be refunded
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Order not found
 */
router.post('/:id/refund', authorize('ADMIN'), controller.refundOrder);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List orders
 *     description: Get a paginated list of orders. Users see only their own orders, admins see all.
 *     tags: [Orders]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED, REFUNDED, PARTIALLY_REFUNDED]
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listOrdersSchema), controller.listOrders);

export default router;
