import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import { createPaymentIntentSchema } from './validation';

const router = Router();

/**
 * @swagger
 * /payments/create-intent:
 *   post:
 *     summary: Create Stripe Payment Intent
 *     description: Create a payment intent for an existing order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Payment intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                     paymentIntentId:
 *                       type: string
 */
router.post(
  '/create-intent',
  authenticate,
  validate(createPaymentIntentSchema),
  controller.createPaymentIntent
);

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Stripe Webhook
 *     description: Handle Stripe webhook events
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Webhook received
 */
router.post('/webhook', controller.handleWebhook);

export default router;
