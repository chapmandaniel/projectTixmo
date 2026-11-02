import { Response } from 'express';
import { ScamMatchStatus, SocialPlatform } from '@prisma/client';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { getActorScope, isGlobalAdmin, requireOrganizationId } from '../../utils/tenantScope';
import { MatchCategoryName } from './constants';
import { presentAccount } from './serialize';
import {
  confirmOfficialAccount,
  createOfficialAccount,
  createOfficialGiveaway,
  deleteOfficialAccount,
  deleteOfficialGiveaway,
  getScamMatch,
  ingestMatches,
  issueCheckerToken,
  listCheckerStatus,
  listOfficialAccounts,
  listOfficialGiveaways,
  listScamMatches,
  presentAccountsForActor,
  reportCheckerStatus,
  resolveOfficialAccountDispute,
  reviewScamMatch,
  revokeCheckerToken,
  updateOfficialAccount,
  updateOfficialGiveaway,
} from './service';

const privateView = async (req: AuthRequest) => {
  const actor = await getActorScope(req);
  return { actor, includePrivate: !isGlobalAdmin(actor) };
};

const orgId = (actor: Awaited<ReturnType<typeof getActorScope>>, requested?: string | null) =>
  requireOrganizationId(actor, requested);

export const createAccount = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const body = req.body as {
    organizationId?: string;
    platform: SocialPlatform;
    platformAccountId: string;
    handle: string;
    profileUrl: string;
    displayName?: string;
  };
  const account = await createOfficialAccount({
    ...body,
    organizationId: orgId(actor, body.organizationId),
    createdBy: actor.userId,
  });
  res
    .status(201)
    .json(successResponse(presentAccount(account, includePrivate), 'Official account saved'));
});

export const updateAccount = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const account = await updateOfficialAccount(
    req.params.id,
    orgId(actor),
    req.body as { handle?: string; profileUrl?: string; displayName?: string | null }
  );
  res.json(successResponse(presentAccount(account, includePrivate), 'Official account updated'));
});

export const removeAccount = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await deleteOfficialAccount(req.params.id, orgId(actor), actor.userId);
  res.status(204).send();
});

export const listAccounts = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const query = req.query as { organizationId?: string };
  const accounts = await listOfficialAccounts(orgId(actor, query.organizationId));
  res.json(successResponse({ accounts: presentAccountsForActor(accounts, includePrivate) }));
});

export const createGiveaway = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  const body = req.body as {
    organizationId?: string;
    eventId?: string;
    title: string;
    platform: SocialPlatform;
    officialPostUrl: string;
    accountHandle: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
  };
  const giveaway = await createOfficialGiveaway({
    ...body,
    organizationId: orgId(actor, body.organizationId),
    createdBy: actor.userId,
  });
  res.status(201).json(successResponse(giveaway, 'Official giveaway saved'));
});

export const updateGiveaway = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  const giveaway = await updateOfficialGiveaway(
    req.params.id,
    orgId(actor),
    req.body as Parameters<typeof updateOfficialGiveaway>[2]
  );
  res.json(successResponse(giveaway, 'Official giveaway updated'));
});

export const removeGiveaway = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  await deleteOfficialGiveaway(req.params.id, orgId(actor));
  res.status(204).send();
});

export const listGiveaways = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  const query = req.query as { organizationId?: string; eventId?: string };
  const giveaways = await listOfficialGiveaways(orgId(actor, query.organizationId), query.eventId);
  res.json(successResponse({ giveaways }));
});

export const listMatches = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const query = req.query as {
    organizationId?: string;
    eventId?: string;
    platform?: SocialPlatform;
    category?: MatchCategoryName;
    status?: ScamMatchStatus;
    page?: number;
    limit?: number;
  };
  const result = await listScamMatches(
    { ...query, organizationId: orgId(actor, query.organizationId) },
    includePrivate
  );
  res.json(
    successResponse({ matches: result.matches, newCount: result.newCount }, undefined, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    })
  );
});

export const getMatch = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const query = req.query as { organizationId?: string };
  const match = await getScamMatch(
    req.params.id,
    orgId(actor, query.organizationId),
    includePrivate
  );
  res.json(successResponse(match));
});

export const reviewMatch = catchAsync(async (req: AuthRequest, res: Response) => {
  const { actor, includePrivate } = await privateView(req);
  const body = req.body as { status: ScamMatchStatus; officialGiveawayId?: string };
  const match = await reviewScamMatch(
    req.params.id,
    orgId(actor),
    actor.userId,
    body,
    includePrivate
  );
  res.json(successResponse(match, 'Match reviewed'));
});

export const checkerStatus = catchAsync(async (req: AuthRequest, res: Response) => {
  await getActorScope(req);
  const statuses = await listCheckerStatus();
  res.json(successResponse({ statuses }));
});

export const ingest = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!req.checkerTokenId) throw ApiError.unauthorized('Checker token required');
  const body = req.body as { matches: Parameters<typeof ingestMatches>[0] };
  const results = await ingestMatches(body.matches, req.checkerTokenId);
  res.json(successResponse({ results }));
});

export const ingestStatus = catchAsync(async (req: AuthRequest, res: Response) => {
  const status = await reportCheckerStatus(req.body as Parameters<typeof reportCheckerStatus>[0]);
  res.json(successResponse(status));
});

export const ingestVerification = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!req.checkerTokenId) throw ApiError.unauthorized('Checker token required');
  const result = await confirmOfficialAccount(
    req.body as Parameters<typeof confirmOfficialAccount>[0],
    req.checkerTokenId
  );
  res.json(successResponse(result));
});

const requirePlatformAdmin = async (req: AuthRequest) => {
  const actor = await getActorScope(req);
  if (!isGlobalAdmin(actor)) {
    throw ApiError.forbidden('Only a platform admin can perform this action');
  }
  return actor;
};

export const resolveDispute = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await requirePlatformAdmin(req);
  const body = req.body as { winnerAccountId: string };
  const account = await resolveOfficialAccountDispute(actor.userId, body.winnerAccountId);
  res.json(successResponse(presentAccount(account, false), 'Dispute resolved'));
});

export const issueToken = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await requirePlatformAdmin(req);
  const body = req.body as { label?: string };
  const issued = await issueCheckerToken(actor.userId, body.label);
  res.status(201).json(successResponse(issued, 'Checker token issued once'));
});

export const revokeToken = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await requirePlatformAdmin(req);
  const revoked = await revokeCheckerToken(actor.userId, req.params.id);
  res.json(successResponse(revoked, 'Checker token revoked'));
});
