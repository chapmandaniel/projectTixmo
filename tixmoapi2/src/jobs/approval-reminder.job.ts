import { approvalService } from '../api/approvals/service';
import { logger } from '../config/logger';
import { config } from '../config/environment';

const APPROVAL_REMINDER_INTERVAL_MS = 60 * 60 * 1000;
let activeRun: Promise<void> | null = null;

async function processApprovalReminders() {
  try {
    await approvalService.processPendingReminders();
  } catch (error) {
    logger.error('Approval reminder job failed:', error as Error);
  }
}

function runApprovalReminders() {
  if (activeRun) return;
  activeRun = processApprovalReminders().finally(() => {
    activeRun = null;
  });
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startApprovalReminderJob() {
  if (!config.enableApprovalReminders) {
    logger.info('Approval reminders are disabled pending explicit rollout enablement.');
    return;
  }
  if (intervalId) {
    return;
  }

  logger.info('Approval reminder job started (interval: 60m)');
  runApprovalReminders();
  intervalId = setInterval(runApprovalReminders, APPROVAL_REMINDER_INTERVAL_MS);
}

export function stopApprovalReminderJob() {
  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
  logger.info('Approval reminder job stopped');
}
