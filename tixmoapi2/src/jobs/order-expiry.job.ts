import prisma from '../config/prisma';
import { orderService } from '../api/orders/service';
import { logger } from '../config/logger';
import { config } from '../config/environment';

const ORDER_EXPIRY_INTERVAL_MS = 60_000; // Run every 60 seconds
const EXPIRY_BATCH = 10;
const EXPIRY_MAX_BATCHES = 5;
let sweeping = false;

/**
 * Background job that cancels expired PENDING orders and releases held inventory.
 *
 * Orders use the configured cart expiry window at creation time. If the user
 * does not complete payment within that window the order should be cancelled
 * so that held inventory is returned to the available pool.
 *
 * Each sweep takes a few small batches. A cancel that loses its transaction
 * (the load-test "commit cannot be executed on an expired transaction") is
 * logged and the rest of that batch still runs. Further batches wait for the
 * next sweep, which sees the same PENDING row and retries it.
 */
export async function processExpiredOrders(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    let deferRest = false;
    for (let batch = 0; batch < EXPIRY_MAX_BATCHES && !deferRest; batch += 1) {
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: new Date(),
          },
        },
        select: { id: true, orderNumber: true },
        orderBy: { expiresAt: 'asc' },
        take: EXPIRY_BATCH,
      });

      if (expiredOrders.length === 0) return;

      logger.info(`🕐 Processing ${expiredOrders.length} expired order(s)…`);

      for (const order of expiredOrders) {
        try {
          await orderService.cancelExpiredOrder(order.id);
          logger.info(`  ✓ Cancelled expired order ${order.orderNumber}`);
        } catch (err) {
          deferRest = true;
          logger.error(`  ✗ Failed to cancel order ${order.orderNumber}:`, err as Error);
        }
      }
      if (expiredOrders.length < EXPIRY_BATCH) return;
    }
  } catch (err) {
    logger.error('Order expiry job failed:', err as Error);
  } finally {
    sweeping = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startOrderExpiryJob(): void {
  if (intervalId) return; // Already running
  logger.info(`🕐 Order expiry job started (interval: 60s, expiry: ${config.cartExpiryMinutes}m)`);
  intervalId = setInterval(processExpiredOrders, ORDER_EXPIRY_INTERVAL_MS);
}

export function stopOrderExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('🕐 Order expiry job stopped');
  }
}
