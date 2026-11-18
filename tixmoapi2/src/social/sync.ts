import { randomUUID } from 'crypto';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { createRuleKeywordClassifier, normalizeClassification } from './classifier';
import { readSocialConfig } from './config';
import { graphErrorCode, sandboxGraphGet, type GraphFetcher } from './graph-client';
import { evaluateIssues, type SocialIssue as RuleIssue } from './issue-rules';
import { emitSocialLog, type SocialLogger } from './log';
import { resolveEventMapping, resolveMode, type EventSchedule } from './mode';
import { planPoll, readPollConfig } from './polling';
import { deliverHighAlert } from './social-mailer';
import { decryptSocialToken, loadKeyRing, SocialTokenError } from './token-crypto';

const asArray = (json: unknown): unknown[] => {
  const data = (json as { data?: unknown })?.data;
  return Array.isArray(data) ? data : [];
};

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const excerpt = (value: unknown, max = 160): string | null => {
  const text = asText(value).trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const toDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const loadEventSchedules = async (organizationId: string): Promise<EventSchedule[]> => {
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

const decryptConnectionToken = (row: {
  id: string;
  organizationId: string;
  tokenKind: string;
  tokenCiphertext: string | null;
  graphBaseUrl: string;
}): string => {
  if (row.tokenKind !== 'sandbox') {
    throw new SocialTokenError('Live tokens are refused in the sandbox environment.');
  }
  if (!row.tokenCiphertext) throw new SocialTokenError('Sandbox token missing.');
  return decryptSocialToken(
    row.tokenCiphertext,
    {
      organizationId: row.organizationId,
      connectionId: row.id,
      tokenKind: 'sandbox',
    },
    loadKeyRing()
  );
};

const upsertPost = async (input: {
  organizationId: string;
  connectionId: string;
  platform: 'FACEBOOK_PAGE' | 'INSTAGRAM';
  externalPostId: string;
  caption: string | null;
  permalink: string | null;
  postedAt: Date;
  reach: number | null;
  engagements: number | null;
  commentsCount: number;
  insightsPending: boolean;
  eventId: string | null;
}) => {
  return prisma.socialPost.upsert({
    where: {
      organizationId_externalPostId: {
        organizationId: input.organizationId,
        externalPostId: input.externalPostId,
      },
    },
    create: {
      id: randomUUID(),
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      eventId: input.eventId,
      externalPostId: input.externalPostId,
      platform: input.platform,
      captionExcerpt: input.caption,
      permalink: input.permalink,
      postedAt: input.postedAt,
      reach: input.reach,
      engagements: input.engagements,
      commentsCount: input.commentsCount,
      insightsPending: input.insightsPending,
    },
    update: {
      captionExcerpt: input.caption,
      permalink: input.permalink,
      postedAt: input.postedAt,
      reach: input.reach,
      engagements: input.engagements,
      commentsCount: input.commentsCount,
      insightsPending: input.insightsPending,
      eventId: input.eventId,
      connectionId: input.connectionId,
    },
  });
};

const upsertComment = async (input: {
  organizationId: string;
  connectionId: string;
  postId: string;
  externalCommentId: string;
  parentExternalId: string | null;
  providerCommenterId: string | null;
  handle: string | null;
  body: string | null;
  permalink: string | null;
  isPageReply: boolean;
  createdTime: Date;
  classification: { label: string; topic: string; confidence: number };
}) => {
  return prisma.socialComment.upsert({
    where: {
      organizationId_externalCommentId: {
        organizationId: input.organizationId,
        externalCommentId: input.externalCommentId,
      },
    },
    create: {
      id: randomUUID(),
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      postId: input.postId,
      externalCommentId: input.externalCommentId,
      parentExternalId: input.parentExternalId,
      providerCommenterId: input.providerCommenterId,
      handle: input.handle,
      body: input.body,
      permalink: input.permalink,
      isPageReply: input.isPageReply,
      createdTime: input.createdTime,
      sentimentLabel: input.classification.label,
      topicLabel: input.classification.topic,
      classifierConfidence: input.classification.confidence,
      purgedAt: null,
    },
    update: {
      parentExternalId: input.parentExternalId,
      providerCommenterId: input.providerCommenterId,
      handle: input.handle,
      body: input.body,
      permalink: input.permalink,
      isPageReply: input.isPageReply,
      createdTime: input.createdTime,
      sentimentLabel: input.classification.label,
      topicLabel: input.classification.topic,
      classifierConfidence: input.classification.confidence,
      purgedAt: null,
    },
  });
};

export const syncOrganization = async (input: {
  organizationId: string;
  trigger?: 'manual' | 'poll';
  fetcher?: GraphFetcher;
  logger?: SocialLogger;
  now?: Date;
}): Promise<{
  syncRunId: string;
  postsFetched: number;
  commentsFetched: number;
  status: string;
}> => {
  const config = readSocialConfig();
  if (!config.enabled) throw ApiError.notFound('Social Command Center is not enabled');
  if (!config.ready || !config.sandboxBaseUrl) {
    throw ApiError.badRequest('Social Command Center is not ready');
  }

  const now = input.now || new Date();
  const syncRunId = randomUUID();
  await prisma.socialSyncRun.create({
    data: {
      id: syncRunId,
      organizationId: input.organizationId,
      status: 'running',
      trigger: input.trigger || 'manual',
    },
  });

  emitSocialLog(input.logger, 'info', 'sync.start', {
    organizationId: input.organizationId,
    syncRunId,
    trigger: input.trigger || 'manual',
  });

  let postsFetched = 0;
  let commentsFetched = 0;
  const classifier = createRuleKeywordClassifier();
  const events = await loadEventSchedules(input.organizationId);
  const mode = events.length === 0 ? 'NORMAL' : resolveMode(events[0], now, undefined).mode;
  const poll = planPoll(readPollConfig(), mode, now);
  const sinceUnix = Math.floor(new Date(poll.postsSince).getTime() / 1000);

  try {
    const connections = await prisma.socialConnection.findMany({
      where: {
        organizationId: input.organizationId,
        status: { in: ['CONNECTED', 'NEEDS_ATTENTION'] },
        tokenCiphertext: { not: null },
      },
    });

    const overrides = await prisma.socialEventMapping.findMany({
      where: { organizationId: input.organizationId, source: 'override' },
    });
    const overrideByPost = new Map(overrides.map((row) => [row.externalPostId, row.eventId]));

    for (const connection of connections) {
      let accessToken: string;
      try {
        accessToken = decryptConnectionToken(connection);
      } catch (error) {
        await prisma.socialConnection.update({
          where: { id: connection.id },
          data: {
            status: 'NEEDS_ATTENTION',
            lastErrorCode: 'token',
            lastErrorAt: now,
          },
        });
        continue;
      }

      if (connection.platform === 'FACEBOOK_PAGE') {
        const feed = await sandboxGraphGet({
          baseUrl: connection.graphBaseUrl,
          path: `/${connection.externalAccountId}/feed`,
          accessToken,
          query: {
            fields: 'id,message,created_time,permalink_url,comments.summary(true).limit(0)',
            since: sinceUnix,
            limit: 50,
          },
          teamAccessKey: process.env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY,
          fetcher: input.fetcher,
          logger: input.logger,
          organizationId: input.organizationId,
          connectionId: connection.id,
        });
        if (feed.status >= 400) {
          const code = graphErrorCode(feed.json) || String(feed.status);
          await prisma.socialConnection.update({
            where: { id: connection.id },
            data: { status: 'NEEDS_ATTENTION', lastErrorCode: code, lastErrorAt: now },
          });
          continue;
        }

        for (const raw of asArray(feed.json)) {
          const item = raw as {
            id?: string;
            message?: string;
            created_time?: string;
            permalink_url?: string;
            comments?: { summary?: { total_count?: number } };
          };
          if (!item.id) continue;
          const postedAt = toDate(item.created_time) || now;
          const mapped =
            overrideByPost.get(item.id) ||
            resolveEventMapping({ postTime: postedAt.toISOString(), events }).eventId ||
            null;
          // Preserve admin overrides.
          if (!overrideByPost.has(item.id) && mapped) {
            await prisma.socialEventMapping.upsert({
              where: {
                organizationId_externalPostId: {
                  organizationId: input.organizationId,
                  externalPostId: item.id,
                },
              },
              create: {
                id: randomUUID(),
                organizationId: input.organizationId,
                externalPostId: item.id,
                eventId: mapped,
                source: 'automatic',
              },
              update: { eventId: mapped, source: 'automatic' },
            });
          }
          const post = await upsertPost({
            organizationId: input.organizationId,
            connectionId: connection.id,
            platform: 'FACEBOOK_PAGE',
            externalPostId: item.id,
            caption: excerpt(item.message),
            permalink: item.permalink_url || null,
            postedAt,
            reach: null,
            engagements: null,
            commentsCount: item.comments?.summary?.total_count || 0,
            insightsPending: false,
            eventId: overrideByPost.get(item.id) || mapped,
          });
          postsFetched += 1;

          const comments = await sandboxGraphGet({
            baseUrl: connection.graphBaseUrl,
            path: `/${item.id}/comments`,
            accessToken,
            query: {
              fields: 'id,message,created_time,from,permalink_url,parent',
              filter: 'stream',
              limit: 100,
            },
            teamAccessKey: process.env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY,
            fetcher: input.fetcher,
            logger: input.logger,
            organizationId: input.organizationId,
            connectionId: connection.id,
          });
          if (comments.status >= 400) continue;
          for (const rawComment of asArray(comments.json)) {
            const comment = rawComment as {
              id?: string;
              message?: string;
              created_time?: string;
              permalink_url?: string;
              parent?: { id?: string };
              from?: { id?: string; name?: string };
            };
            if (!comment.id) continue;
            const createdTime = toDate(comment.created_time) || now;
            const isPageReply = comment.from?.id === connection.externalAccountId;
            const classification = normalizeClassification(
              classifier.classify({ id: comment.id, text: String(comment.message || '') })
            );
            await upsertComment({
              organizationId: input.organizationId,
              connectionId: connection.id,
              postId: post.id,
              externalCommentId: comment.id,
              parentExternalId: comment.parent?.id || null,
              providerCommenterId: comment.from?.id || null,
              handle: isPageReply ? null : comment.from?.name || null,
              body: comment.message || null,
              permalink: comment.permalink_url || item.permalink_url || null,
              isPageReply,
              createdTime,
              classification,
            });
            commentsFetched += 1;
          }
        }
      }

      if (connection.platform === 'INSTAGRAM') {
        const media = await sandboxGraphGet({
          baseUrl: connection.graphBaseUrl,
          path: `/${connection.externalAccountId}/media`,
          accessToken,
          query: {
            fields: 'id,caption,timestamp,permalink,comments_count',
            since: sinceUnix,
            limit: 50,
          },
          teamAccessKey: process.env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY,
          fetcher: input.fetcher,
          logger: input.logger,
          organizationId: input.organizationId,
          connectionId: connection.id,
        });
        if (media.status >= 400) {
          const code = graphErrorCode(media.json) || String(media.status);
          await prisma.socialConnection.update({
            where: { id: connection.id },
            data: { status: 'NEEDS_ATTENTION', lastErrorCode: code, lastErrorAt: now },
          });
          continue;
        }
        for (const raw of asArray(media.json)) {
          const item = raw as {
            id?: string;
            caption?: string;
            timestamp?: string;
            permalink?: string;
            comments_count?: number;
          };
          if (!item.id) continue;
          const postedAt = toDate(item.timestamp) || now;
          const mapped =
            overrideByPost.get(item.id) ||
            resolveEventMapping({ postTime: postedAt.toISOString(), events }).eventId ||
            null;
          const post = await upsertPost({
            organizationId: input.organizationId,
            connectionId: connection.id,
            platform: 'INSTAGRAM',
            externalPostId: item.id,
            caption: excerpt(item.caption),
            permalink: item.permalink || null,
            postedAt,
            reach: null,
            engagements: null,
            commentsCount: item.comments_count || 0,
            insightsPending: false,
            eventId: overrideByPost.get(item.id) || mapped,
          });
          postsFetched += 1;

          const comments = await sandboxGraphGet({
            baseUrl: connection.graphBaseUrl,
            path: `/${item.id}/comments`,
            accessToken,
            query: {
              fields: 'id,text,timestamp,username,like_count,replies',
              limit: 100,
            },
            teamAccessKey: process.env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY,
            fetcher: input.fetcher,
            logger: input.logger,
            organizationId: input.organizationId,
            connectionId: connection.id,
          });
          if (comments.status >= 400) continue;
          for (const rawComment of asArray(comments.json)) {
            const comment = rawComment as {
              id?: string;
              text?: string;
              timestamp?: string;
              username?: string;
            };
            if (!comment.id) continue;
            const createdTime = toDate(comment.timestamp) || now;
            const isPageReply =
              Boolean(comment.username) &&
              Boolean(connection.handle) &&
              comment.username === connection.handle;
            const classification = normalizeClassification(
              classifier.classify({ id: comment.id, text: String(comment.text || '') })
            );
            await upsertComment({
              organizationId: input.organizationId,
              connectionId: connection.id,
              postId: post.id,
              externalCommentId: comment.id,
              parentExternalId: null,
              providerCommenterId: null,
              handle: isPageReply ? null : comment.username || null,
              body: comment.text || null,
              permalink: item.permalink || null,
              isPageReply,
              createdTime,
              classification,
            });
            commentsFetched += 1;
          }
        }
      }

      await prisma.socialConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now, lastErrorCode: null, lastErrorAt: null, status: 'CONNECTED' },
      });
    }

    await applyIssueRules({
      organizationId: input.organizationId,
      events,
      now,
      logger: input.logger,
    });

    await prisma.socialSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        postsFetched,
        commentsFetched,
      },
    });

    emitSocialLog(input.logger, 'info', 'sync.finish', {
      organizationId: input.organizationId,
      syncRunId,
      postsFetched,
      commentsFetched,
      status: 200,
    });

    return { syncRunId, postsFetched, commentsFetched, status: 'ok' };
  } catch (error) {
    const code = error instanceof SocialTokenError ? 'token' : 'sync';
    await prisma.socialSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'error',
        finishedAt: new Date(),
        postsFetched,
        commentsFetched,
        errorCode: code,
      },
    });
    emitSocialLog(input.logger, 'error', 'sync.error', {
      organizationId: input.organizationId,
      syncRunId,
      errorCode: code,
      postsFetched,
      commentsFetched,
    });
    throw error;
  }
};

const applyIssueRules = async (input: {
  organizationId: string;
  events: EventSchedule[];
  now: Date;
  logger?: SocialLogger;
}) => {
  const settings = await prisma.socialOrgSettings.findUnique({
    where: { organizationId: input.organizationId },
  });
  const holdRow = await prisma.socialModeHold.findFirst({
    where: {
      organizationId: input.organizationId,
      until: { gt: input.now },
    },
    orderBy: { createdAt: 'desc' },
  });
  const primary =
    input.events[0] ||
    ({
      id: 'none',
      name: 'All events',
      timezone: 'America/St_Johns',
      startDatetime: null,
      endDatetime: null,
      salesStart: null,
      ticketTypeSalesStarts: [],
    } satisfies EventSchedule);

  const comments = await prisma.socialComment.findMany({
    where: { organizationId: input.organizationId, purgedAt: null },
    include: { post: true },
    orderBy: { createdTime: 'asc' },
  });
  const existing = await prisma.socialIssue.findMany({
    where: { organizationId: input.organizationId },
    include: { comments: true, activities: { orderBy: { createdAt: 'asc' } } },
  });

  const prior: RuleIssue[] = existing.map((issue) => ({
    id: issue.id,
    kind: issue.kind === 'WAVE' ? 'WAVE' : 'SINGLE',
    topic: issue.topic as RuleIssue['topic'],
    severity: issue.severity,
    state: issue.state,
    ruleText: issue.ruleText,
    commentIds: issue.comments.map((link) => link.commentId),
    tags: [issue.kind],
    bucketStart: issue.waveBucketKey || undefined,
    handledAt: issue.handledAt?.toISOString() || null,
    lastAlertAt: issue.lastAlertAt?.toISOString() || null,
    openedAt: issue.createdAt.toISOString(),
    mode: issue.mode,
    count: issue.commentCount,
    activity: issue.activities.map((entry) => ({
      at: entry.createdAt.toISOString(),
      text: entry.detail || entry.action,
    })),
  }));

  const result = evaluateIssues({
    now: input.now,
    event: primary,
    hold: holdRow
      ? {
          mode: holdRow.mode,
          until: holdRow.until.toISOString(),
        }
      : null,
    comments: comments.map((comment) => ({
      id: comment.id,
      text: comment.body || '',
      createdAt: comment.createdTime.toISOString(),
      authorIsPage: comment.isPageReply,
      hasPageReply: comment.isPageReply
        ? false
        : comments.some(
            (other) =>
              other.isPageReply &&
              (other.parentExternalId === comment.externalCommentId ||
                other.parentExternalId === comment.parentExternalId)
          ),
    })),
    issues: prior,
    classifier: createRuleKeywordClassifier(),
    highEmailEnabled: settings?.highEmailEnabled !== false,
  });

  for (const issue of result.issues) {
    const existingRow = existing.find((row) => row.id === issue.id);
    const postId =
      issue.commentIds
        .map((id) => comments.find((comment) => comment.id === id)?.postId)
        .find(Boolean) || null;
    const eventId = postId
      ? comments.find((comment) => comment.postId === postId)?.post.eventId || null
      : null;
    const waveBucketKey = issue.bucketStart || null;

    if (existingRow) {
      await prisma.socialIssue.update({
        where: { id: existingRow.id },
        data: {
          topic: issue.topic,
          severity: issue.severity,
          state: issue.state,
          ruleText: issue.ruleText,
          mode: issue.mode,
          waveBucketKey,
          commentCount: issue.commentIds.length,
          postId,
          eventId,
          lastAlertAt: issue.lastAlertAt ? new Date(issue.lastAlertAt) : existingRow.lastAlertAt,
          handledAt: issue.handledAt ? new Date(issue.handledAt) : existingRow.handledAt,
        },
      });
      for (const commentId of issue.commentIds) {
        await prisma.socialIssueComment
          .upsert({
            where: { issueId_commentId: { issueId: existingRow.id, commentId } },
            create: { id: randomUUID(), issueId: existingRow.id, commentId },
            update: {},
          })
          .catch(() => undefined);
      }
      continue;
    }

    const created = await prisma.socialIssue.create({
      data: {
        id: issue.id || randomUUID(),
        organizationId: input.organizationId,
        eventId,
        postId,
        kind: issue.kind,
        topic: issue.topic,
        severity: issue.severity,
        state: issue.state,
        ruleText: issue.ruleText,
        mode: issue.mode,
        waveBucketKey,
        commentCount: issue.commentIds.length,
        lastAlertAt: issue.lastAlertAt ? new Date(issue.lastAlertAt) : null,
      },
    });
    for (const commentId of issue.commentIds) {
      await prisma.socialIssueComment
        .create({ data: { id: randomUUID(), issueId: created.id, commentId } })
        .catch(() => undefined);
    }
    await prisma.socialIssueActivity.create({
      data: {
        id: randomUUID(),
        issueId: created.id,
        action: 'opened',
        detail: issue.ruleText.slice(0, 1000),
      },
    });
  }

  const owners = await prisma.user.findMany({
    where: { organizationId: input.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { email: true },
  });
  for (const alert of result.alerts) {
    if (alert.suppressed || !alert.channels.includes('email')) continue;
    const issue = result.issues.find((row) => row.id === alert.issueId);
    if (!issue || issue.severity !== 'HIGH') continue;
    await deliverHighAlert(
      {
        organizationId: input.organizationId,
        to: owners.map((user) => user.email),
        severity: issue.severity,
        topic: issue.topic,
        state: issue.state,
        commentCount: issue.commentIds.length,
        eventName: primary.name,
        detectedAt: input.now.toISOString(),
        assignee: null,
        ruleName: issue.ruleText.slice(0, 120),
        dashboardUrl: `/social?tab=issues&issue=${encodeURIComponent(issue.id)}`,
      },
      process.env,
      { logger: input.logger }
    );
  }

  void resolveMode;
};
