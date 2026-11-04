import { logger } from '../config/logger';
import { vendorImportService } from '../services/vendors/import-service';

const INTERVAL_MS = 60_000;
let activeRun: Promise<void> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function processDueVendorSyncs() {
  try {
    await vendorImportService.runDueSyncs();
  } catch (error) {
    logger.error('Vendor sync job failed', error as Error);
  }
}

function runVendorSync() {
  if (activeRun) return;
  activeRun = processDueVendorSyncs().finally(() => {
    activeRun = null;
  });
}

export function startVendorSyncJob() {
  if (intervalId) return;
  logger.info('Vendor sync job started (interval: 1m)');
  intervalId = setInterval(runVendorSync, INTERVAL_MS);
}

export function stopVendorSyncJob() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}
