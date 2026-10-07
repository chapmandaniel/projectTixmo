import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';
import { approvalService } from '../../src/api/approvals/service';
import { approvalEmailService } from '../../src/services/approval-email.service';
import { cleanupTestData, prisma } from '../utils/testUtils';

const first = new PrismaClient();
const second = new PrismaClient();

async function fixture() {
  const organization = await prisma.organization.create({
    data: { name: 'Reminder fixture', slug: randomUUID(), type: 'PROMOTER', status: 'ACTIVE' },
  });
  const creator = await prisma.user.create({
    data: {
      email: `${randomUUID()}@test.invalid`,
      passwordHash: 'fixture-not-for-login',
      firstName: 'Fixture',
      lastName: 'Owner',
      role: 'OWNER',
      organizationId: organization.id,
    },
  });
  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      name: 'Reminder fixture event',
      slug: randomUUID(),
      tags: [],
      status: 'PUBLISHED',
    },
  });
  const approval = await prisma.approvalRequest.create({
    data: {
      organizationId: organization.id,
      eventId: event.id,
      createdById: creator.id,
      title: 'Reminder fixture',
      deadline: new Date(Date.now() + 5 * 86400000),
      revisions: {
        create: {
          revisionNumber: 1,
          uploadedById: creator.id,
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      },
      reviewers: {
        create: {
          email: 'reviewer@test.invalid',
          token: randomUUID(),
          tokenExpiresAt: new Date(Date.now() + 5 * 86400000),
        },
      },
    },
    include: { revisions: true, reviewers: true },
  });
  return {
    approval,
    revision: approval.revisions[0],
    reviewer: approval.reviewers[0],
    event,
    creator,
  };
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await cleanupTestData();
});
afterAll(async () => {
  jest.restoreAllMocks();
  await cleanupTestData();
  await first.$disconnect();
  await second.$disconnect();
});

it('two independent database clients and concurrent workers make one durable claim before sending', async () => {
  await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockImplementation(async (_reviewer, _creator, _approval, _url, id) => {
      const claimed = await prisma.approvalReminder.findUniqueOrThrow({ where: { id } });
      expect(claimed.status).toBe('SENDING');
      expect(claimed.leaseToken).toBeTruthy();
      expect(claimed.sentAt).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { status: 'SENT', messageId: 'owned-provider-receipt' };
    });
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      approvalService.processPendingReminders(index % 2 ? first : second)
    )
  );
  expect(send).toHaveBeenCalledTimes(1);
  const rows = await prisma.approvalReminder.findMany();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    status: 'SENT',
    attempts: 1,
    providerMessageId: 'owned-provider-receipt',
    leaseToken: null,
  });
  expect(rows[0].sentAt).toBeInstanceOf(Date);
});

it('quarantines an expired claim after a worker stops without sending again', async () => {
  await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockRejectedValue(new Error('Simulated worker interruption after handoff'));
  await expect(approvalService.processPendingReminders(first)).rejects.toThrow(
    'worker interruption'
  );
  const row = await prisma.approvalReminder.findFirstOrThrow();
  expect(row.status).toBe('SENDING');
  await prisma.approvalReminder.update({
    where: { id: row.id },
    data: { claimedAt: new Date(Date.now() - 6 * 60 * 1000) },
  });
  send.mockClear().mockResolvedValue({ status: 'SENT', messageId: 'unexpected' });
  await approvalService.processPendingReminders(second);
  expect(send).not.toHaveBeenCalled();
  expect((await prisma.approvalReminder.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
    'UNCERTAIN'
  );
});

it('does not repeat a provider-accepted send when the outcome write fails', async () => {
  await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockResolvedValue({ status: 'SENT', messageId: 'accepted-before-db-failure' });
  const original = first.approvalReminder.updateMany.bind(first.approvalReminder);
  const persistence = jest
    .spyOn(first.approvalReminder, 'updateMany')
    .mockImplementation((args: any) => {
      if (args.data.status === 'SENT')
        return Promise.reject(new Error('Simulated outcome persistence failure')) as any;
      return original(args);
    });
  await expect(approvalService.processPendingReminders(first)).rejects.toThrow(
    'persistence failure'
  );
  persistence.mockRestore();
  await prisma.approvalReminder.updateMany({
    data: { claimedAt: new Date(Date.now() - 6 * 60 * 1000) },
  });
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await prisma.approvalReminder.findFirstOrThrow()).status).toBe('UNCERTAIN');
});

it('retries confirmed transient rejection after backoff and stops at three attempts', async () => {
  await fixture();
  const send = jest.spyOn(approvalEmailService, 'sendReminderDelivery').mockResolvedValue({
    status: 'FAILED',
    retryable: true,
    error: 'Confirmed transient rejection.',
  });
  await approvalService.processPendingReminders(first);
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(1);
  for (let index = 0; index < 2; index++) {
    await prisma.approvalReminder.updateMany({
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    await approvalService.processPendingReminders(second);
  }
  const row = await prisma.approvalReminder.findFirstOrThrow();
  expect(row).toMatchObject({ status: 'FAILED', attempts: 3, nextAttemptAt: null });
  await approvalService.processPendingReminders(first);
  expect(send).toHaveBeenCalledTimes(3);
});

it('does not retry an uncertain result or a confirmed permanent rejection', async () => {
  const uncertain = await fixture();
  const permanent = await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockImplementation(async (_reviewer, _creator, approval) =>
      approval.title === 'Permanent failure'
        ? { status: 'FAILED', retryable: false, error: 'Confirmed permanent rejection.' }
        : { status: 'UNCERTAIN', error: 'Acceptance is unknown.' }
    );
  await prisma.approvalRequest.update({
    where: { id: permanent.approval.id },
    data: { title: 'Permanent failure' },
  });
  await approvalService.processPendingReminders(first);
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    (
      await prisma.approvalReminder.findFirstOrThrow({
        where: { approvalRevisionId: uncertain.revision.id },
      })
    ).status
  ).toBe('UNCERTAIN');
  expect(
    (
      await prisma.approvalReminder.findFirstOrThrow({
        where: { approvalRevisionId: permanent.revision.id },
      })
    ).status
  ).toBe('FAILED');
});

it('does not send for interacted, decided, expired, archived, deleted or completed work', async () => {
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockResolvedValue({ status: 'SENT' });
  for (const kind of [
    'interacted',
    'decided',
    'expired-token',
    'expired-deadline',
    'archived',
    'deleted-event',
    'completed',
    'new-revision',
  ]) {
    const data = await fixture();
    if (kind === 'interacted')
      await prisma.approvalReviewer.update({
        where: { id: data.reviewer.id },
        data: { lastInteractionRevisionNumber: 1 },
      });
    if (kind === 'decided')
      await prisma.approvalReviewDecision.create({
        data: {
          approvalRequestId: data.approval.id,
          approvalRevisionId: data.revision.id,
          reviewerId: data.reviewer.id,
          decision: 'APPROVED',
        },
      });
    if (kind === 'expired-token')
      await prisma.approvalReviewer.update({
        where: { id: data.reviewer.id },
        data: { tokenExpiresAt: new Date(Date.now() - 1000) },
      });
    if (kind === 'expired-deadline')
      await prisma.approvalRequest.update({
        where: { id: data.approval.id },
        data: { deadline: new Date(Date.now() - 1000) },
      });
    if (kind === 'archived')
      await prisma.approvalRequest.update({
        where: { id: data.approval.id },
        data: { archivedAt: new Date() },
      });
    if (kind === 'deleted-event')
      await prisma.event.update({ where: { id: data.event.id }, data: { deletedAt: new Date() } });
    if (kind === 'completed')
      await prisma.approvalRequest.update({
        where: { id: data.approval.id },
        data: { status: 'APPROVED' },
      });
    if (kind === 'new-revision') {
      await prisma.approvalRevision.create({
        data: {
          approvalRequestId: data.approval.id,
          revisionNumber: 2,
          uploadedById: data.creator.id,
        },
      });
      await prisma.approvalRequest.update({
        where: { id: data.approval.id },
        data: { latestRevisionNumber: 2 },
      });
    }
  }
  await approvalService.processPendingReminders(first);
  expect(send).not.toHaveBeenCalled();
  expect(await prisma.approvalReminder.count()).toBe(0);
});

it('requires explicit operator authorization and reconciles an uncertain outcome before retry', async () => {
  await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockResolvedValue({ status: 'UNCERTAIN', error: 'Provider evidence is required.' });
  await approvalService.processPendingReminders(first);
  const row = await prisma.approvalReminder.findFirstOrThrow();
  const args = [
    path.resolve(__dirname, '../../prisma/reconcile-approval-reminders.js'),
    'resolve',
    '--id',
    row.id,
    '--outcome',
    'not-sent',
    '--reason',
    'Owned provider log confirmed rejection.',
  ];
  const env = {
    ...process.env,
    TIXMO_REMINDER_DATABASE_URL: process.env.DATABASE_URL,
    TIXMO_ALLOW_REMINDER_RECONCILIATION: '',
  };
  expect(spawnSync(process.execPath, args, { env, encoding: 'utf8' }).status).toBe(1);
  env.TIXMO_ALLOW_REMINDER_RECONCILIATION = 'true';
  expect(spawnSync(process.execPath, args, { env, encoding: 'utf8' }).status).toBe(0);
  send.mockResolvedValue({ status: 'SENT', messageId: 'accepted-after-confirmed-rejection' });
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(2);
  expect((await prisma.approvalReminder.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
    'SENT'
  );
});

it('records confirmed operator acceptance without sending again and rejects a mismatched target', async () => {
  await fixture();
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockResolvedValue({ status: 'UNCERTAIN', error: 'Provider evidence is required.' });
  await approvalService.processPendingReminders(first);
  const row = await prisma.approvalReminder.findFirstOrThrow();
  const args = [
    path.resolve(__dirname, '../../prisma/reconcile-approval-reminders.js'),
    'resolve',
    '--id',
    row.id,
    '--outcome',
    'sent',
    '--reason',
    'Owned provider log confirmed acceptance.',
    '--provider-message-id',
    'operator-confirmed-receipt',
  ];
  const env = {
    ...process.env,
    TIXMO_REMINDER_DATABASE_URL: process.env.DATABASE_URL,
    TIXMO_ALLOW_REMINDER_RECONCILIATION: 'true',
  };
  const mismatch = spawnSync(process.execPath, args, {
    env: { ...env, TIXMO_REMINDER_DATABASE_URL: 'postgresql://invalid.test/other' },
    encoding: 'utf8',
  });
  expect(mismatch.status).toBe(1);
  expect(mismatch.stderr).toContain('match the inherited DATABASE_URL');
  expect((await prisma.approvalReminder.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
    'UNCERTAIN'
  );
  expect(spawnSync(process.execPath, args, { env, encoding: 'utf8' }).status).toBe(0);
  expect(spawnSync(process.execPath, args, { env, encoding: 'utf8' }).status).toBe(1);
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(1);
  expect(await prisma.approvalReminder.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
    status: 'SENT',
    leaseToken: null,
    providerMessageId: 'operator-confirmed-receipt',
  });
});

it('preserves independent deadline reminder types while preventing repeats', async () => {
  const data = await fixture();
  await prisma.approvalRequest.update({
    where: { id: data.approval.id },
    data: { deadline: new Date(Date.now() + 36 * 60 * 60 * 1000) },
  });
  const send = jest
    .spyOn(approvalEmailService, 'sendReminderDelivery')
    .mockResolvedValue({ status: 'SENT', messageId: 'owned-receipt' });
  await approvalService.processPendingReminders(first);
  await approvalService.processPendingReminders(second);
  expect(send).toHaveBeenCalledTimes(2);
  expect((await prisma.approvalReminder.findMany()).map((row) => row.reminderType).sort()).toEqual([
    'AFTER_24_HOURS',
    'DEADLINE_48_HOURS',
  ]);
});

it('records a late confirmed acceptance without retrying a quarantined claim', async () => {
  await fixture();
  let accept: (value: { status: 'SENT'; messageId: string }) => void = () => undefined;
  let entered: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const send = jest.spyOn(approvalEmailService, 'sendReminderDelivery').mockImplementation(() => {
    entered();
    return new Promise((resolve) => {
      accept = resolve;
    });
  });
  const run = approvalService.processPendingReminders(first);
  await started;
  await prisma.approvalReminder.updateMany({
    data: { claimedAt: new Date(Date.now() - 6 * 60 * 1000) },
  });
  await approvalService.processPendingReminders(second);
  expect((await prisma.approvalReminder.findFirstOrThrow()).status).toBe('UNCERTAIN');
  accept({ status: 'SENT', messageId: 'late-confirmed-acceptance' });
  await run;
  expect(send).toHaveBeenCalledTimes(1);
  expect((await prisma.approvalReminder.findFirstOrThrow()).status).toBe('SENT');
});
