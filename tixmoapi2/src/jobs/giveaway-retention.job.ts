import { logger } from '../config/logger';
import { redactGiveawayLogText } from '../utils/giveawayLogRedaction';
import { purgeExpiredScamMatches } from '../api/brand-protection/service';

const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Deletes scam matches whose detectedAt is older than 30 days, including
 * evidence fields stored on those rows. Repeat runs delete nothing further.
 * The job keeps running when the feature flag is off so evidence cannot
 * outlive the window after the flag is turned off. It has no HTTP route.
 */
export async function runGiveawayRetention(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const count = await purgeExpiredScamMatches();
    if (count > 0) logger.info(`Brand protection retention deleted ${count} match(es)`);
    return count;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    logger.error(redactGiveawayLogText(`Brand protection retention failed ${message}`));
    return 0;
  } finally {
    running = false;
  }
}

export function startGiveawayRetentionJob(): void {
  if (timer) return;
  logger.info('Brand protection retention job started (interval: 6h, keep: 30d)');
  void runGiveawayRetention();
  timer = setInterval(() => {
    void runGiveawayRetention();
  }, RETENTION_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopGiveawayRetentionJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
