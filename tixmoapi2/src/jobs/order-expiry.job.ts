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
 * Each sweep claims up to five batches of 10. The claim uses the checkout
 * transaction limits and a per-order advisory lock, so other replicas take
 * different rows and only this process logs a cancel it committed. A row
 * another replica already holds, or one that replica already cancelled, is
 * skipped without a log and does not use a claim slot. A cancel that loses
 * its transaction is logged, left PENDING, and retried next minute. The rest
 * of that batch still runs. Further batches wait. One process does not start
 * a second sweep while the first is running.
 */
export async function sweepExpiredOrders(): Promise<string[]> {
  const cancelled: string[] = [];
  const excludeIds: string[] = [];
  let deferRest = false;
  try {
    for (let batch = 0; batch < EXPIRY_MAX_BATCHES && !deferRest; batch += 1) {
      let claimed = 0;
      let skips = 0;
      while (claimed < EXPIRY_BATCH) {
        const result = await orderService.claimNextExpiredOrder(excludeIds.slice());
        if (result.status === 'empty') {
          if (claimed > 0) logger.info(`🕐 Processing ${claimed} expired order(s)…`);
          return cancelled;
        }
        if (result.status === 'skipped') {
          excludeIds.push(result.id);
          skips += 1;
          if (skips > EXPIRY_BATCH * EXPIRY_MAX_BATCHES) return cancelled;
          continue;
        }
        claimed += 1;
        if (result.status === 'failed') {
          excludeIds.push(result.id);
          deferRest = true;
          logger.error(`  ✗ Failed to cancel order ${result.orderNumber}:`, result.error as Error);
          continue;
        }
        cancelled.push(result.orderNumber);
        logger.info(`  ✓ Cancelled expired order ${result.orderNumber}`);
      }
      logger.info(`🕐 Processing ${claimed} expired order(s)…`);
    }
  } catch (err) {
    logger.error('Order expiry job failed:', err as Error);
  }
  return cancelled;
}

export async function processExpiredOrders(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepExpiredOrders();
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
