import { approvalService } from '../api/approvals/service';
import { logger } from '../config/logger';

const APPROVAL_REMINDER_INTERVAL_MS = 60 * 60 * 1000;

async function processApprovalReminders() {
    try {
        await approvalService.processPendingReminders();
    } catch (error) {
        logger.error('Approval reminder job failed:', error as Error);
    }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startApprovalReminderJob() {
    if (intervalId) {
        return;
    }

    logger.info('Approval reminder job started (interval: 60m)');
    intervalId = setInterval(processApprovalReminders, APPROVAL_REMINDER_INTERVAL_MS);
}

export function stopApprovalReminderJob() {
    if (!intervalId) {
        return;
    }

    clearInterval(intervalId);
    intervalId = null;
    logger.info('Approval reminder job stopped');
}
