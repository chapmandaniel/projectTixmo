import { logger } from '../config/logger';
import { readSocialConfig } from '../social/config';
import { purgeExpiredComments } from '../social/purge';

const INTERVAL_MS = 60 * 60 * 1000;
let intervalId: ReturnType<typeof setInterval> | null = null;
let activeRun: Promise<void> | null = null;

async function runPurge() {
  const config = readSocialConfig();
  if (!config.enabled) return;
  try {
    const result = await purgeExpiredComments({ logger });
    logger.info('Social retention purge finished', result);
  } catch (error) {
    logger.error('Social retention purge failed', error as Error);
  }
}

function tick() {
  if (activeRun) return;
  activeRun = runPurge().finally(() => {
    activeRun = null;
  });
}

export function startSocialRetentionJob() {
  if (intervalId) return;
  logger.info('Social retention job started (interval: 1h)');
  intervalId = setInterval(tick, INTERVAL_MS);
}

export function stopSocialRetentionJob() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}
