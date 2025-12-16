import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { paymentService } from './service';

export const createPaymentIntent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;
  const userId = req.user!.userId;

  const result = await paymentService.createPaymentIntent(orderId, userId);

  res.json(successResponse(result, 'Payment intent created successfully'));
});

export const handleWebhook = catchAsync(async (req: any, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  // Use req.rawBody if available (needs raw body parser middleware for webhooks)
  // Assuming express.raw({ type: 'application/json' }) is used for this route or globally handled
  // For now, let's assume req.body is Buffer if configured correctly, or we need to ensure raw body access.
  // Standard express.json() parses body, which breaks signature verification.
  // We'll need to handle this in routes or app.ts.

  await paymentService.handleWebhook(signature, req.body);

  res.json({ received: true });
});
