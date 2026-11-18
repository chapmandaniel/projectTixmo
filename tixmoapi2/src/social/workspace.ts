import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { readSocialConfig } from './config';
import { listConnections, ensureOrgSettings } from './connections';
import {
  dashboardThresholdLabels,
  DEFAULT_KEYWORD_VALUES,
  DEFAULT_THRESHOLD_VALUES,
} from './defaults';
import { resolveMode, tightestMode, type EventSchedule, type ThresholdMode } from './mode';
import { planPoll, readPollConfig } from './polling';

const modeLabel = (mode: ThresholdMode): string =>
  mode === 'ON_SALE_DAY' ? 'ON-SALE DAY' : mode === 'EVENT_DAY' ? 'EVENT DAY' : 'NORMAL';

const unansweredLabelFor = (mode: ThresholdMode, minutes: number): string => {
  if (mode === 'EVENT_DAY') return `Unanswered > ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Unanswered > ${hours}h`;
};

const loadSchedules = async (organizationId: string): Promise<EventSchedule[]> => {
  const events = await prisma.event.findMany({
    where: { organizationId, deletedAt: null },
    include: { ticketTypes: { select: { salesStart: true } } },
  });
  return events.map((event) => ({
    id: event.id,
    name: event.name,
    timezone: event.timezone || 'America/St_Johns',
    startDatetime: event.startDatetime?.toISOString() || null,
    endDatetime: event.endDatetime?.toISOString() || null,
    salesStart: event.salesStart?.toISOString() || null,
    ticketTypeSalesStarts: event.ticketTypes
      .map((tier) => tier.salesStart?.toISOString() || null)
      .filter(Boolean) as string[],
  }));
};

export const buildLiveWorkspace = async (input: {
  organizationId: string;
  eventId?: string | null;
  accountId?: string | null;
  range?: string | null;
  now?: Date;
}) => {
  const config = readSocialConfig();
  if (!config.enabled) throw ApiError.notFound('Social Command Center is not enabled');

  const now = input.now || new Date();
  await ensureOrgSettings(input.organizationId);
  const settings = await prisma.socialOrgSettings.findUniqueOrThrow({
    where: { organizationId: input.organizationId },
  });
  const accounts = await listConnections(input.organizationId);
  const schedules = await loadSchedules(input.organizationId);
  const holdRows = await prisma.socialModeHold.findMany({
    where: { organizationId: input.organizationId, until: { gt: now } },
  });
  const holds = Object.fromEntries(
    holdRows.map((row) => [
      row.eventId || 'all',
      { mode: row.mode, until: row.until.toISOString() },
    ])
  );

  const selectedSchedules = input.eventId
    ? schedules.filter((event) => event.id === input.eventId)
    : schedules;
  const tight = tightestMode(selectedSchedules.length ? selectedSchedules : schedules, now, holds);
  const mode = tight?.mode || 'NORMAL';
  const modeEvent = schedules.find((event) => event.id === tight?.eventId);
  const thresholds =
    (settings.thresholds as typeof DEFAULT_THRESHOLD_VALUES) || DEFAULT_THRESHOLD_VALUES;
  const unansweredMinutes =
    mode === 'EVENT_DAY'
      ? thresholds.EVENT_DAY.unansweredMinutes
      : mode === 'ON_SALE_DAY'
        ? thresholds.ON_SALE_DAY.unansweredMinutes
        : thresholds.NORMAL.unansweredMinutes;

  const rangeMs =
    input.range === '30d'
      ? 30 * 24 * 60 * 60 * 1000
      : input.range === '1d'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  const since = new Date(now.getTime() - rangeMs);

  const postWhere: Record<string, unknown> = {
    organizationId: input.organizationId,
    postedAt: { gte: since },
  };
  if (input.eventId) postWhere.eventId = input.eventId;
  if (input.accountId) postWhere.connectionId = input.accountId;

  const posts = await prisma.socialPost.findMany({
    where: postWhere,
    include: {
      comments: { orderBy: { createdTime: 'asc' } },
      connection: true,
    },
    orderBy: { postedAt: 'desc' },
  });

  const issues = await prisma.socialIssue.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.eventId ? { eventId: input.eventId } : {}),
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      activities: { orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'asc' } },
      comments: { include: { comment: true } },
      post: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const openIssues = issues.filter(
    (issue) => issue.state === 'NEW' || issue.state === 'IN_PROGRESS'
  );
  const waves = openIssues
    .filter((issue) => issue.kind === 'WAVE')
    .map((issue) => ({
      topic: issue.topic,
      count: String(issue.commentCount),
      status: `${issue.severity} open`,
    }));

  const topicCounts = new Map<string, number>();
  for (const issue of openIssues) {
    topicCounts.set(issue.topic, (topicCounts.get(issue.topic) || 0) + 1);
  }

  const lastSync = accounts
    .map((account) => account.lastSync)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const poll = planPoll(readPollConfig(), mode, now);
  const hold = holdRows[0]
    ? { mode: holdRows[0].mode, until: holdRows[0].until.toISOString().slice(0, 10) }
    : null;

  return {
    scene: 'live',
    phase: config.ready ? 'data' : 'mock',
    now: now.toISOString(),
    mode,
    modeLabel: modeLabel(mode),
    modeSource: hold ? 'held' : 'auto',
    modeEventName: modeEvent?.name || '',
    unansweredLabel: unansweredLabelFor(mode, unansweredMinutes),
    unansweredLimit:
      mode === 'EVENT_DAY' ? `${unansweredMinutes} min` : `${Math.round(unansweredMinutes / 60)} h`,
    oldestUnanswered: '',
    syncedLabel: lastSync
      ? `Synced ${Math.max(1, Math.round((now.getTime() - Date.parse(lastSync)) / 60000))} min ago`
      : 'Never synced',
    scheduleNote: schedules.every((event) => !event.startDatetime && !event.salesStart)
      ? 'No schedule dates. Alerts stay in NORMAL mode.'
      : '',
    onSaleNote: '',
    datesUsed: '',
    hold,
    modeLog: hold
      ? [`Hold ${modeLabel(hold.mode)} set until ${hold.until}.`]
      : ['Mode is automatic from event dates.'],
    accounts,
    events: schedules.map((event) => {
      const resolved = resolveMode(event, now, holds[event.id]);
      return {
        id: event.id,
        name: event.name,
        mode: resolved.mode,
        modeLabel: modeLabel(resolved.mode),
        onSale: Boolean(event.salesStart),
        scheduled: Boolean(event.startDatetime && event.endDatetime),
      };
    }),
    sandboxPages: [],
    kpis: {
      reach: String(posts.reduce((sum, post) => sum + (post.reach || 0), 0) || '—'),
      engagements: String(posts.reduce((sum, post) => sum + (post.engagements || 0), 0) || '—'),
      followers: '—',
      openIssues: String(openIssues.length),
      unanswered: String(
        issues.filter(
          (issue) =>
            issue.kind === 'UNANSWERED' && (issue.state === 'NEW' || issue.state === 'IN_PROGRESS')
        ).length
      ),
      reachDetail: '',
      engagementDetail: '',
      followerDetail: '',
      openDetail: `${openIssues.filter((issue) => issue.state === 'NEW').length} NEW`,
      unansweredDetail: `limit ${mode === 'EVENT_DAY' ? `${unansweredMinutes} min` : `${Math.round(unansweredMinutes / 60)} h`}, ${modeLabel(mode)}`,
    },
    trend: [],
    waves,
    topics: [...topicCounts.entries()].map(([topic, count]) => ({ topic, count })),
    posts: posts.map((post) => ({
      id: post.id,
      platform: post.platform === 'FACEBOOK_PAGE' ? 'FB' : 'IG',
      account: post.connection.displayName,
      accountId: post.connectionId,
      caption: post.captionExcerpt || '',
      postedAt: post.postedAt.toISOString(),
      reach: post.insightsPending ? '—' : post.reach == null ? '—' : String(post.reach),
      engagement: post.insightsPending
        ? '—'
        : post.engagements == null
          ? '—'
          : String(post.engagements),
      comments: post.commentsCount,
      flagged: post.comments.filter((comment) =>
        issues.some((issue) => issue.comments.some((link) => link.commentId === comment.id))
      ).length,
      openIssues: openIssues.filter((issue) => issue.postId === post.id).length,
      permalink: post.permalink,
      insightsPending: post.insightsPending,
      commentsList: post.comments.map((comment) => ({
        id: comment.id,
        handle: comment.handle || (comment.isPageReply ? 'Page' : 'commenter'),
        text: comment.body || '',
        createdAt: comment.createdTime.toISOString(),
        permalink: comment.permalink,
        isPageReply: comment.isPageReply,
        flagged: issues.some((issue) =>
          issue.comments.some((link) => link.commentId === comment.id)
        ),
      })),
    })),
    issues: issues.map((issue) => ({
      id: issue.id,
      kind: issue.kind,
      topic: issue.topic,
      severity: issue.severity,
      state: issue.state,
      ruleText: issue.ruleText,
      mode: issue.mode,
      commentCount: issue.commentCount,
      assignee: issue.assignee
        ? `${issue.assignee.firstName} ${issue.assignee.lastName}`.trim()
        : '',
      assigneeId: issue.assigneeId,
      postId: issue.postId,
      eventId: issue.eventId,
      activity: issue.activities.map((entry) => ({
        at: entry.createdAt.toISOString(),
        text: entry.detail || entry.action,
      })),
      notes: issue.notes.map((note) => ({
        at: note.createdAt.toISOString(),
        text: note.body,
      })),
    })),
    phrases:
      (settings.keywords as unknown as typeof DEFAULT_KEYWORD_VALUES) || DEFAULT_KEYWORD_VALUES,
    thresholds: dashboardThresholdLabels(thresholds),
    poll: { ...poll, running: Boolean(process.env.SOCIAL_POLL_ENABLED === 'true') },
    highEmailEnabled: settings.highEmailEnabled,
    digestEnabled: settings.digestEnabled,
  };
};
