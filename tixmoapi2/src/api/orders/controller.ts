import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { orderService } from './service';

export const createOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const payload = req.body as Parameters<typeof orderService.createOrder>[1];
  const order = await orderService.createOrder(userId, payload);
  res.status(201).json(successResponse(order, 'Order created successfully'));
});

export const getOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const order = await orderService.getOrderById(id, userId);

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  res.json(successResponse(order));
});

export const confirmOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await orderService.confirmOrder(id);

  // Send confirmation email (async, don't block response)
  orderService.sendOrderConfirmationEmail(id).catch((error) => {
    console.error('Failed to send order confirmation email:', error);
  });

  res.json(successResponse(order, 'Order confirmed successfully'));
});

export const cancelOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const order = await orderService.cancelOrder(id, userId);
  res.json(successResponse(order, 'Order cancelled successfully'));
});

export const listOrders = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.role === 'ADMIN' ? undefined : req.user!.userId;

  const query = { ...(req.query as Record<string, unknown>), userId };

  const result = await orderService.listOrders(query);

  res.json(successResponse(result));
});
