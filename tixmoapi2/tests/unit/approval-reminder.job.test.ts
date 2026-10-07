jest.mock('../../src/config/environment', () => ({ config: { enableApprovalReminders: true } }));
jest.mock('../../src/api/approvals/service', () => ({
  approvalService: { processPendingReminders: jest.fn() },
}));

import { config } from '../../src/config/environment';
import { approvalService } from '../../src/api/approvals/service';
import {
  startApprovalReminderJob,
  stopApprovalReminderJob,
} from '../../src/jobs/approval-reminder.job';

afterEach(() => {
  stopApprovalReminderJob();
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('requires explicit enablement before starting or sending reminders', () => {
  jest.useFakeTimers();
  (config as { enableApprovalReminders: boolean }).enableApprovalReminders = false;
  startApprovalReminderJob();
  jest.advanceTimersByTime(2 * 60 * 60 * 1000);
  expect(approvalService.processPendingReminders).not.toHaveBeenCalled();
});

it('runs on enabled startup and prevents overlapping local runs until completion', async () => {
  jest.useFakeTimers();
  (config as { enableApprovalReminders: boolean }).enableApprovalReminders = true;
  let finish: () => void = () => undefined;
  const job = approvalService.processPendingReminders as jest.Mock;
  job.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  startApprovalReminderJob();
  startApprovalReminderJob();
  jest.advanceTimersByTime(2 * 60 * 60 * 1000);
  expect(job).toHaveBeenCalledTimes(1);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  job.mockResolvedValue(undefined);
  jest.advanceTimersByTime(60 * 60 * 1000);
  expect(job).toHaveBeenCalledTimes(2);
});
