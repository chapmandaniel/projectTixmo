import prisma from '../config/prisma';
import { orderService } from '../api/orders/service';
import { logger } from '../config/logger';

const ORDER_EXPIRY_INTERVAL_MS = 60_000; // Run every 60 seconds

/**
 * Background job that cancels expired PENDING orders and releases held inventory.
 *
 * Orders are given a 30-minute expiry window at creation time.  If the user
 * does not complete payment within that window the order should be cancelled
 * so that held inventory is returned to the available pool.
 */
async function processExpiredOrders(): Promise<void> {
    try {
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lt: new Date(),
                },
            },
            select: { id: true, orderNumber: true },
            take: 50, // Process in batches to avoid long-running queries
        });

        if (expiredOrders.length === 0) return;

        logger.info(`🕐 Processing ${expiredOrders.length} expired order(s)…`);

        for (const order of expiredOrders) {
            try {
                await orderService.cancelOrder(order.id);
                logger.info(`  ✓ Cancelled expired order ${order.orderNumber}`);
            } catch (err) {
                // Log but don't stop processing other orders
                logger.error(`  ✗ Failed to cancel order ${order.orderNumber}:`, err as Error);
            }
        }
    } catch (err) {
        logger.error('Order expiry job failed:', err as Error);
    }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startOrderExpiryJob(): void {
    if (intervalId) return; // Already running
    logger.info('🕐 Order expiry job started (interval: 60s)');
    intervalId = setInterval(processExpiredOrders, ORDER_EXPIRY_INTERVAL_MS);
}

export function stopOrderExpiryJob(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info('🕐 Order expiry job stopped');
    }
}
