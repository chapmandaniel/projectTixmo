import { randomUUID } from 'crypto';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { emitSocialLog, type SocialLogger } from './log';

const requireOrg = (organizationId?: string | null) => {
  if (!organizationId) throw ApiError.forbidden('Organization required');
  return organizationId;
};

const loadIssue = async (organizationId: string, issueId: string) => {
  const issue = await prisma.socialIssue.findFirst({
    where: { id: issueId, organizationId },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      activities: { orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'asc' } },
      comments: { include: { comment: true } },
    },
  });
  if (!issue) throw ApiError.notFound('Issue not found');
  return issue;
};

const activity = async (
  issueId: string,
  actorId: string | null | undefined,
  action: string,
  detail?: string
) => {
  await prisma.socialIssueActivity.create({
    data: {
      id: randomUUID(),
      issueId,
      actorId: actorId || null,
      action,
      detail: detail?.slice(0, 1000) || null,
    },
  });
};

export const listIssues = async (organizationId: string) => {
  const rows = await prisma.socialIssue.findMany({
    where: { organizationId },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      activities: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows;
};

export const getIssue = async (organizationId: string, issueId: string) =>
  loadIssue(requireOrg(organizationId), issueId);

export const patchIssue = async (input: {
  organizationId: string;
  userId: string;
  issueId: string;
  status?: 'NEW' | 'IN_PROGRESS' | 'HANDLED' | 'DISMISSED';
  severity?: 'HIGH' | 'MED' | 'LOW';
  topic?: string;
  assigneeId?: string | null;
  note?: string;
  dismissReason?: string;
  logger?: SocialLogger;
}) => {
  const organizationId = requireOrg(input.organizationId);
  const issue = await loadIssue(organizationId, input.issueId);
  const data: Record<string, unknown> = {};

  if (input.severity && input.severity !== issue.severity) {
    data.severity = input.severity;
    await activity(issue.id, input.userId, 'severity', `${issue.severity} → ${input.severity}`);
  }
  if (input.topic && input.topic !== issue.topic) {
    data.topic = input.topic;
    await activity(issue.id, input.userId, 'topic', `${issue.topic} → ${input.topic}`);
  }
  if (input.assigneeId !== undefined) {
    if (input.assigneeId) {
      const member = await prisma.user.findFirst({
        where: { id: input.assigneeId, organizationId },
      });
      if (!member) throw ApiError.badRequest('Assignee must be an org member');
      data.assigneeId = member.id;
      if (issue.state === 'NEW') data.state = 'IN_PROGRESS';
      await activity(
        issue.id,
        input.userId,
        'assign',
        `${member.firstName} ${member.lastName}`.trim()
      );
    } else {
      data.assigneeId = null;
      await activity(issue.id, input.userId, 'unassign', 'Unassigned');
    }
  }
  if (input.status) {
    if (input.status === 'DISMISSED' && !input.dismissReason?.trim() && !issue.dismissReason) {
      throw ApiError.badRequest('Dismiss requires a reason');
    }
    data.state = input.status;
    if (input.status === 'HANDLED') data.handledAt = new Date();
    if (input.status === 'DISMISSED')
      data.dismissReason = input.dismissReason?.trim() || issue.dismissReason;
    await activity(issue.id, input.userId, input.status.toLowerCase(), input.dismissReason);
  }
  if (input.note?.trim()) {
    await prisma.socialIssueNote.create({
      data: {
        id: randomUUID(),
        issueId: issue.id,
        authorId: input.userId,
        body: input.note.trim(),
      },
    });
    await activity(issue.id, input.userId, 'note', 'Internal note added');
  }

  const updated = await prisma.socialIssue.update({
    where: { id: issue.id },
    data,
  });
  emitSocialLog(input.logger, 'info', 'issue.patch', {
    organizationId,
    queryAction: 'update',
    queryModel: 'SocialIssue',
  });
  return loadIssue(organizationId, updated.id);
};

export const bulkIssues = async (input: {
  organizationId: string;
  userId: string;
  issueIds: string[];
  action: 'assign' | 'handled' | 'dismiss';
  assigneeId?: string | null;
  dismissReason?: string;
  logger?: SocialLogger;
}) => {
  const organizationId = requireOrg(input.organizationId);
  const ids = [...new Set(input.issueIds)].slice(0, 100);
  const results = [];
  for (const issueId of ids) {
    if (input.action === 'assign') {
      results.push(
        await patchIssue({
          organizationId,
          userId: input.userId,
          issueId,
          assigneeId: input.assigneeId || null,
          logger: input.logger,
        })
      );
    } else if (input.action === 'handled') {
      results.push(
        await patchIssue({
          organizationId,
          userId: input.userId,
          issueId,
          status: 'HANDLED',
          logger: input.logger,
        })
      );
    } else {
      results.push(
        await patchIssue({
          organizationId,
          userId: input.userId,
          issueId,
          status: 'DISMISSED',
          dismissReason: input.dismissReason,
          logger: input.logger,
        })
      );
    }
  }
  return { count: results.length, issues: results };
};
