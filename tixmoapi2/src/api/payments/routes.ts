import { Router } from 'express';
import express from 'express';
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
// Webhook route needs raw body for signature verification
// This is typically handled at the app level or by using a specific parser here
// For this implementation, we assume the raw body is passed correctly or handled in app.ts
router.post('/webhook', express.raw({ type: 'application/json' }), controller.handleWebhook);

export default router;
