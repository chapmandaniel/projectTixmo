import { Response } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { writeStaffAction } from '../../services/staff-action-audit';
import { orderService } from './service';
import { buyerEmailVisible, presentOrderDetail } from './order-privacy';
import { receiptDisclosure } from '../../utils/receipt';

const canManageOrders = (role?: string) => ['OWNER', 'ADMIN', 'MANAGER'].includes(role || '');

export const createOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const payload = req.body as Parameters<typeof orderService.createOrder>[1];
  const result = await orderService.createOrderHttp(userId, payload, req.get('Idempotency-Key'));
  if (result.kind === 'idempotent') {
    res.status(result.statusCode).type('application/json').send(result.body);
    return;
  }
  res.status(201).json(successResponse(result.order, 'Order created successfully'));
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
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
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         description: Optional buyer-scoped key. The same key and body replay the original 201 response and do not create another hold. The same key with a different body returns 409. Omitting the header keeps create-every-time behavior.
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *     responses:
 *       201:
 *         description: Order created successfully. An identical Idempotency-Key replay returns this same response.
 *       400:
 *         description: Invalid request (for example, limit exceeded). Insufficient inventory is 409, not 400.
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 *       409:
 *         description: Not enough tickets available (errors.code SOLD_OUT), or the idempotency key was reused with a different body (errors.code IDEMPOTENCY_KEY_MISMATCH).
 *       429:
 *         description: Too Many Requests - Rate limit exceeded
 *       503:
 *         description: Service Unavailable - High traffic (Waiting Room active)
 */

export const getConsumerOrderRecovery = catchAsync(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getConsumerOrderRecovery(req.params.id, req.user!.userId);
  if (!order) throw ApiError.notFound('Order not found');
  res.json(successResponse(order));
});

export const getOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, undefined, req.user!.userId);
  if (!order) throw ApiError.notFound('Order not found');
  const detail = { ...order, receiptDisclosure: receiptDisclosure(order.totalAmount) };
  if (buyerEmailVisible(req.user!.role)) {
    const event = await prisma.event.findUnique({
      where: { id: order.eventId },
      select: { organizationId: true },
    });
    if (event) {
      await writeStaffAction({
        action: 'STAFF_PII_VIEW',
        subjectType: 'ORDER',
        subjectId: order.id,
        organizationId: event.organizationId,
        actorId: req.user!.userId,
        reason: 'Staff order detail',
      });
    }
  }
  res.json(successResponse(presentOrderDetail(detail, req.user!.role)));
});

export const confirmOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await orderService.confirmOrder(id, req.user!.userId);

  // Send confirmation email (async, don't block response)
  orderService.sendOrderConfirmationEmail(id).catch((error) => {
    console.error('Failed to send order confirmation email:', error);
  });

  res.json(successResponse(order, 'Order confirmed successfully'));
});

export const cancelOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const order = await orderService.cancelOrder(id, undefined, req.user!.userId);
  res.json(successResponse(order, 'Order cancelled successfully'));
});

export const listOrders = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = canManageOrders(req.user!.role) ? undefined : req.user!.userId;

  const query = { ...(req.query as Record<string, unknown>), userId };

  const result = await orderService.listOrders(query, req.user!.userId);

  res.json(successResponse(result));
});

export const listMyOrders = catchAsync(async (req: AuthRequest, res: Response) => {
  res.json(
    successResponse(await orderService.listOrders({ ...req.query, userId: req.user!.userId }))
  );
});

export const resendReceipt = catchAsync(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, undefined, req.user!.userId);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'PAID' && order.status !== 'REFUNDED')
    throw ApiError.badRequest('Receipts can only be sent for paid or refunded orders');
  await orderService.sendOrderConfirmationEmail(order.id, true);
  res.json(successResponse(null, 'Receipt sent to the buyer'));
});

export const voidOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reason, ticketId } = req.body as { reason: string; ticketId?: string };
  const order = await orderService.voidPaidTickets(req.params.id, req.user!.userId, {
    reason,
    ticketId,
  });
  res.json(successResponse(order, 'Tickets voided'));
});

export const refundOrder = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await orderService.refundOrder(id, req.user!.userId);
  res.json(
    successResponse(
      order,
      order.status === 'REFUNDED' ? 'Order refunded successfully' : 'Refund processing'
    )
  );
});

export const requestRefund = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!['OWNER', 'ADMIN'].includes(req.user!.role)) {
    throw new ApiError(403, 'All sales are final. Refunds are issued by Tixmo staff.', {
      code: 'BUYER_REFUNDS_DISABLED',
    });
  }
  const order = await orderService.getOrderById(req.params.id, req.user!.userId);
  if (!order) throw ApiError.notFound('Order not found');
  const result = await orderService.refundOrder(order.id);
  res.json(
    successResponse(
      result,
      result.status === 'REFUNDED' ? 'Order refunded successfully' : 'Refund processing'
    )
  );
});
