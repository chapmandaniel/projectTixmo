import { Response } from 'express';
import { successResponse } from '../../utils/response';

type CommittedOrder = {
  id: string;
  orderNumber?: string;
  status?: string;
  totalAmount?: { toString(): string } | string | number | null;
};

/**
 * The order row is already committed. A serialization failure must still be
 * 201, or a buyer who retries will hold the same tickets again.
 */
export function committedOrderJson(order: CommittedOrder): string {
  try {
    return JSON.stringify(successResponse(order, 'Order created successfully'));
  } catch {
    const total = order.totalAmount;
    return JSON.stringify(
      successResponse(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount:
            total && typeof total === 'object' && 'toString' in total ? total.toString() : total,
        },
        'Order created successfully'
      )
    );
  }
}

export function sendCommittedOrder(res: Response, order: CommittedOrder): void {
  res.status(201).type('application/json').send(committedOrderJson(order));
}
