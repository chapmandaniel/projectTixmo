import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { logger } from '../../config/logger';
import { createRuleKeywordClassifier, normalizeClassification } from '../../social/classifier';
import { readSocialConfig, toPublicSocialConfig } from '../../social/config';
import {
  connectSandboxPage,
  disconnectSandboxAccount,
  discoverSandboxPages,
  listConnections,
} from '../../social/connections';
import { listCapturedSocialEmails, requireCaptureReader } from '../../social/email-capture';
import { triggerCapturedSocialEmail } from '../../social/email-trigger';
import { bulkIssues, getIssue, listIssues, patchIssue } from '../../social/issues-service';
import { purgeExpiredComments } from '../../social/purge';
import {
  getSettings,
  saveEventMapping,
  saveKeywords,
  saveThresholds,
  setModeHold,
} from '../../social/settings-service';
import { syncOrganization } from '../../social/sync';
import { buildLiveWorkspace } from '../../social/workspace';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';

const requireUserOrg = (
  req: AuthRequest
): { organizationId: string; userId: string; role: string } => {
  if (!req.user?.organizationId || !req.user?.userId) {
    throw ApiError.forbidden('Organization required');
  }
  return {
    organizationId: req.user.organizationId,
    userId: req.user.userId,
    role: req.user.role,
  };
};

export const getConfig = (_req: AuthRequest, res: Response): void => {
  res.json(successResponse(toPublicSocialConfig(readSocialConfig())));
};

export const classifyComments = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const body = req.body as { comments?: { id?: string; text?: string }[] } | undefined;
    const comments = Array.isArray(body?.comments) ? body.comments.slice(0, 50) : [];
    const classifier = createRuleKeywordClassifier();
    const classifications = comments.map((comment, index) => {
      const commentId = String(comment?.id || `comment-${index + 1}`);
      return normalizeClassification({
        ...classifier.classify({ id: commentId, text: String(comment?.text || '') }),
        commentId,
      });
    });
    res.json(successResponse({ classifications }));
  } catch (error) {
    next(error);
  }
};

export const listEmailCaptures = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const config = readSocialConfig();
    const organizationId = requireCaptureReader(
      { role: req.user?.role, organizationId: req.user?.organizationId },
      config.enabled
    );
    res.json(successResponse({ captures: listCapturedSocialEmails(organizationId) }));
  } catch (error) {
    next(error);
  }
};

export const triggerEmailCapture = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = req.body as { kind?: 'high' | 'digest' } & Record<string, unknown>;
    if (body.kind !== 'high' && body.kind !== 'digest') {
      throw ApiError.badRequest('kind must be high or digest');
    }
    const result = await triggerCapturedSocialEmail({
      organizationId: actor.organizationId,
      role: actor.role,
      kind: body.kind,
      ...(body as object),
      logger,
    });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

export const getWorkspace = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({
      organizationId: actor.organizationId,
      eventId: typeof req.query.event === 'string' ? req.query.event : null,
      accountId: typeof req.query.account === 'string' ? req.query.account : null,
      range: typeof req.query.range === 'string' ? req.query.range : '7d',
    });
    res.json(successResponse(workspace));
  } catch (error) {
    next(error);
  }
};

export const getOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({
      organizationId: actor.organizationId,
      eventId: typeof req.query.event === 'string' ? req.query.event : null,
      accountId: typeof req.query.account === 'string' ? req.query.account : null,
      range: typeof req.query.range === 'string' ? req.query.range : '7d',
    });
    res.json(
      successResponse({
        kpis: workspace.kpis,
        trend: workspace.trend,
        waves: workspace.waves,
        topics: workspace.topics,
        mode: workspace.mode,
        modeLabel: workspace.modeLabel,
        accounts: workspace.accounts,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getPosts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({
      organizationId: actor.organizationId,
      eventId: typeof req.query.event === 'string' ? req.query.event : null,
      accountId: typeof req.query.account === 'string' ? req.query.account : null,
      range: typeof req.query.range === 'string' ? req.query.range : '7d',
    });
    res.json(successResponse({ posts: workspace.posts }));
  } catch (error) {
    next(error);
  }
};

export const getPost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({ organizationId: actor.organizationId });
    const post = workspace.posts.find((item) => item.id === req.params.id);
    if (!post) throw ApiError.notFound('Post not found');
    res.json(successResponse({ post }));
  } catch (error) {
    next(error);
  }
};

export const getIssuesHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const issues = await listIssues(actor.organizationId);
    res.json(successResponse({ issues }));
  } catch (error) {
    next(error);
  }
};

export const getIssueHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const issue = await getIssue(actor.organizationId, req.params.id);
    res.json(successResponse({ issue }));
  } catch (error) {
    next(error);
  }
};

export const patchIssueHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = (req.body || {}) as {
      status?: 'NEW' | 'IN_PROGRESS' | 'HANDLED' | 'DISMISSED';
      severity?: 'HIGH' | 'MED' | 'LOW';
      topic?: string;
      assigneeId?: string | null;
      note?: string;
      dismissReason?: string;
    };
    const issue = await patchIssue({
      organizationId: actor.organizationId,
      userId: actor.userId,
      issueId: req.params.id,
      status: body.status,
      severity: body.severity,
      topic: body.topic,
      assigneeId: body.assigneeId,
      note: body.note,
      dismissReason: body.dismissReason,
      logger,
    });
    res.json(successResponse({ issue }));
  } catch (error) {
    next(error);
  }
};

export const bulkIssuesHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = req.body as {
      issueIds?: string[];
      action?: 'assign' | 'handled' | 'dismiss';
      assigneeId?: string;
      dismissReason?: string;
    };
    if (!Array.isArray(body.issueIds) || !body.action) {
      throw ApiError.badRequest('issueIds and action are required');
    }
    const result = await bulkIssues({
      organizationId: actor.organizationId,
      userId: actor.userId,
      issueIds: body.issueIds,
      action: body.action,
      assigneeId: body.assigneeId,
      dismissReason: body.dismissReason,
      logger,
    });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

export const getWaves = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({ organizationId: actor.organizationId });
    res.json(successResponse({ waves: workspace.waves }));
  } catch (error) {
    next(error);
  }
};

export const getUnanswered = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const workspace = await buildLiveWorkspace({ organizationId: actor.organizationId });
    const unanswered = workspace.issues.filter(
      (issue) =>
        issue.kind === 'UNANSWERED' && (issue.state === 'NEW' || issue.state === 'IN_PROGRESS')
    );
    res.json(successResponse({ unanswered }));
  } catch (error) {
    next(error);
  }
};

export const getSettingsHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    res.json(successResponse(await getSettings(actor.organizationId)));
  } catch (error) {
    next(error);
  }
};

export const patchThresholds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = (req.body || {}) as {
      thresholds?: Parameters<typeof saveThresholds>[0]['thresholds'];
      reset?: boolean;
      highEmailEnabled?: boolean;
      digestEnabled?: boolean;
    };
    const settings = await saveThresholds({
      organizationId: actor.organizationId,
      role: actor.role,
      thresholds: body.thresholds,
      reset: body.reset,
      highEmailEnabled: body.highEmailEnabled,
      digestEnabled: body.digestEnabled,
      logger,
    });
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
};

export const postHold = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = req.body as {
      mode?: 'NORMAL' | 'ON_SALE_DAY' | 'EVENT_DAY';
      until?: string;
      eventId?: string;
      clear?: boolean;
    };
    const settings = await setModeHold({
      organizationId: actor.organizationId,
      role: actor.role,
      userId: actor.userId,
      mode: body.mode || 'NORMAL',
      until: body.until || new Date().toISOString(),
      eventId: body.eventId,
      clear: Boolean(body.clear),
      logger,
    });
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
};

export const postKeywords = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = (req.body || {}) as {
      keywords?: Parameters<typeof saveKeywords>[0]['keywords'];
      reset?: boolean;
    };
    const settings = await saveKeywords({
      organizationId: actor.organizationId,
      role: actor.role,
      keywords: body.keywords,
      reset: body.reset,
      logger,
    });
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
};

export const postMapping = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = req.body as { externalPostId?: string; eventId?: string };
    if (!body.externalPostId || !body.eventId) {
      throw ApiError.badRequest('externalPostId and eventId are required');
    }
    const settings = await saveEventMapping({
      organizationId: actor.organizationId,
      role: actor.role,
      userId: actor.userId,
      externalPostId: body.externalPostId,
      eventId: body.eventId,
      logger,
    });
    res.json(successResponse(settings));
  } catch (error) {
    next(error);
  }
};

export const getAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    res.json(successResponse({ accounts: await listConnections(actor.organizationId) }));
  } catch (error) {
    next(error);
  }
};

export const discoverAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const accessToken = String((req.body as { accessToken?: string })?.accessToken || '');
    const pages = await discoverSandboxPages({
      organizationId: actor.organizationId,
      role: actor.role,
      accessToken,
      logger,
    });
    res.json(successResponse({ pages }));
  } catch (error) {
    next(error);
  }
};

export const connectAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const body = req.body as { accessToken?: string; pageId?: string; eventIds?: string[] };
    if (!body.accessToken || !body.pageId) {
      throw ApiError.badRequest('accessToken and pageId are required');
    }
    const result = await connectSandboxPage({
      organizationId: actor.organizationId,
      userId: actor.userId,
      role: actor.role,
      accessToken: body.accessToken,
      pageId: body.pageId,
      eventIds: body.eventIds,
      logger,
    });
    res.status(201).json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

export const disconnectAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const result = await disconnectSandboxAccount({
      organizationId: actor.organizationId,
      role: actor.role,
      connectionId: req.params.id,
      logger,
    });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

export const syncNow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    const result = await syncOrganization({
      organizationId: actor.organizationId,
      trigger: 'manual',
      logger,
    });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

export const purgeComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actor = requireUserOrg(req);
    if (actor.role !== 'OWNER' && actor.role !== 'ADMIN') {
      throw ApiError.forbidden('Org admins can run retention purge');
    }
    const result = await purgeExpiredComments({
      organizationId: actor.organizationId,
      logger,
    });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};
