import { randomBytes, timingSafeEqual } from 'crypto';
import { OfficialAccount, Prisma, ScamMatchStatus, SocialPlatform } from '@prisma/client';
import prisma from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { getActorScopeById, isGlobalAdmin } from '../../utils/tenantScope';
import { recordStaffAction, StaffActionName } from '../../services/staff-action-audit';
import {
  CHECKER_SCOPES,
  CHECKER_TOKEN_PREFIX,
  DEFAULT_CHECKER_SCOPES,
  DETECTED_AT_FUTURE_SKEW_MS,
  MATCH_RETENTION_MS,
  VERIFICATION_CODE_TTL_MS,
  CheckerScopeName,
  MatchCategoryName,
} from './constants';
import { hashCheckerToken } from './checkerGuard';
import { presentAccount, presentMatch } from './serialize';
import { assertNoControlChars, displayHandle, normalizeDomain, normalizeSocialUrl } from './urls';
import { parseIngestMatch } from './validation';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Tx = Prisma.TransactionClient;

type AccountInput = {
  organizationId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  handle: string;
  profileUrl: string;
  displayName?: string;
  createdBy: string;
};

type GiveawayInput = {
  organizationId: string;
  eventId?: string | null;
  title: string;
  platform: SocialPlatform;
  officialPostUrl: string;
  accountHandle: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  createdBy: string;
};

type IngestMatchInput = {
  organizationId: string;
  eventId?: string;
  platform: SocialPlatform;
  category: MatchCategoryName;
  sourceUrl: string;
  platformAccountId?: string;
  accountHandle?: string;
  suspectDisplayName?: string;
  matchedText?: string;
  matchedRule: string;
  detectedAt: string;
  imitatedPlatformAccountId?: string;
  imitatedOfficialAccountId?: string;
  evidencePhones?: string[];
  evidenceEmails?: string[];
};

const verifiedKey = (platform: string, platformAccountId: string) =>
  `${platform}:${platformAccountId}`;

const verificationCodeExpiry = (now = new Date()) =>
  new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

const issueVerificationCode = () => ({
  verificationCode: createVerificationCode(),
  verificationCodeExpiresAt: verificationCodeExpiry(),
});

const normalizeDetectedAt = (raw: string, now = new Date()): Date => {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.UTC(2010, 0, 1)) {
    throw ApiError.badRequest('detectedAt is not a usable timestamp');
  }
  if (parsed.getTime() > now.getTime() + DETECTED_AT_FUTURE_SKEW_MS) {
    throw ApiError.badRequest('detectedAt is too far in the future');
  }
  return parsed.getTime() > now.getTime() ? now : parsed;
};

const createVerificationCode = (): string => {
  const bytes = randomBytes(8);
  let raw = '';
  for (let index = 0; index < bytes.length; index += 1) {
    raw += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
};

const codesMatch = (stored: string, submitted: string): boolean => {
  const left = Buffer.from(stored.replace(/[\s-]/g, '').toUpperCase());
  const right = Buffer.from(submitted.replace(/[\s-]/g, '').toUpperCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const lockIdentity = async (tx: Tx, platform: string, platformAccountId: string) => {
  const key = verifiedKey(platform, platformAccountId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
};

const auditAccount = async (
  tx: Tx,
  input: {
    action: StaffActionName;
    account: { id: string; organizationId: string; status: string };
    actorId: string;
    reason: string;
    afterStatus: string;
  }
) => {
  await recordStaffAction(tx, {
    action: input.action,
    subjectType: 'OFFICIAL_ACCOUNT',
    subjectId: input.account.id,
    organizationId: input.account.organizationId,
    actorId: input.actorId,
    reason: input.reason,
    before: { status: input.account.status },
    after: { status: input.afterStatus },
  });
};

const markDisputed = async (tx: Tx, account: OfficialAccount, actorId: string, reason: string) => {
  if (account.status === 'DISPUTED' || account.status === 'REVOKED') return account;
  const updated = await tx.officialAccount.update({
    where: { id: account.id },
    data: {
      status: 'DISPUTED',
      verifiedPlatformAccountKey: null,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verifiedAt: null,
    },
  });
  await auditAccount(tx, {
    action: 'OFFICIAL_ACCOUNT_DISPUTE',
    account,
    actorId,
    reason,
    afterStatus: 'DISPUTED',
  });
  return updated;
};

const assertEventInOrg = async (
  db: Tx | typeof prisma,
  eventId: string | null | undefined,
  organizationId: string
) => {
  if (!eventId) return;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event || event.organizationId !== organizationId) {
    throw ApiError.badRequest('eventId does not belong to the organization');
  }
};

const RECLAIM_BLOCKED = 'This organization cannot claim that platform account';

const activeReclaimBlock = (
  db: Tx | typeof prisma,
  organizationId: string,
  platform: SocialPlatform,
  platformAccountId: string
) =>
  db.officialAccountReclaimBlock.findFirst({
    where: { organizationId, platform, platformAccountId, liftedAt: null },
    select: { id: true },
  });

const assertReclaimAllowed = async (
  db: Tx | typeof prisma,
  organizationId: string,
  platform: SocialPlatform,
  platformAccountId: string
) => {
  if (await activeReclaimBlock(db, organizationId, platform, platformAccountId)) {
    throw ApiError.conflict(RECLAIM_BLOCKED);
  }
};

const recordReclaimBlock = async (
  tx: Tx,
  account: { organizationId: string; platform: SocialPlatform; platformAccountId: string }
) => {
  const existing = await activeReclaimBlock(
    tx,
    account.organizationId,
    account.platform,
    account.platformAccountId
  );
  if (existing) return;
  await tx.officialAccountReclaimBlock.create({
    data: {
      organizationId: account.organizationId,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      reason: 'Dispute resolved against this organization',
    },
  });
};

const assertOrgExists = async (tx: Tx, organizationId: string) => {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) throw ApiError.badRequest('organizationId does not exist');
};

export const createOfficialAccount = async (input: AccountInput) => {
  const handle = displayHandle(input.handle);
  const profileUrl = normalizeSocialUrl(input.profileUrl, 'profileUrl', input.platform);
  assertNoControlChars(input.platformAccountId, 'platformAccountId');
  if (input.displayName) assertNoControlChars(input.displayName, 'displayName');

  return prisma.$transaction(async (tx) => {
    await lockIdentity(tx, input.platform, input.platformAccountId);
    const rows = await tx.officialAccount.findMany({
      where: { platform: input.platform, platformAccountId: input.platformAccountId },
    });
    const own = rows.filter((row) => row.organizationId === input.organizationId);
    if (own.some((row) => row.status === 'REVOKED')) {
      throw ApiError.conflict(RECLAIM_BLOCKED);
    }
    await assertReclaimAllowed(tx, input.organizationId, input.platform, input.platformAccountId);
    if (own.some((row) => row.status !== 'REVOKED')) {
      throw ApiError.conflict('This organization already claimed that platform account');
    }
    return tx.officialAccount.create({
      data: {
        organizationId: input.organizationId,
        platform: input.platform,
        platformAccountId: input.platformAccountId,
        handle,
        profileUrl,
        displayName: input.displayName ?? null,
        status: 'PENDING',
        verificationMethod: 'ONE_TIME_CODE',
        ...issueVerificationCode(),
        createdBy: input.createdBy,
      },
    });
  });
};

export const updateOfficialAccount = async (
  id: string,
  organizationId: string,
  input: { handle?: string; profileUrl?: string; displayName?: string | null }
) => {
  const existing = await prisma.officialAccount.findFirst({ where: { id, organizationId } });
  if (!existing) throw ApiError.notFound('Official account not found');
  const data: Prisma.OfficialAccountUpdateInput = {};
  let handleChanged = false;
  let urlChanged = false;
  if (input.handle !== undefined) {
    const handle = displayHandle(input.handle);
    handleChanged = handle !== existing.handle;
    data.handle = handle;
  }
  if (input.profileUrl !== undefined) {
    const profileUrl = normalizeSocialUrl(input.profileUrl, 'profileUrl', existing.platform);
    urlChanged = profileUrl !== existing.profileUrl;
    data.profileUrl = profileUrl;
  }
  if (input.displayName !== undefined) {
    if (input.displayName) assertNoControlChars(input.displayName, 'displayName');
    data.displayName = input.displayName;
  }
  if (existing.status === 'VERIFIED' && (handleChanged || urlChanged)) {
    data.status = 'PENDING';
    data.verifiedAt = null;
    data.verifiedPlatformAccountKey = null;
    Object.assign(data, issueVerificationCode());
  }
  return prisma.$transaction(async (tx) => {
    await lockIdentity(tx, existing.platform, existing.platformAccountId);
    return tx.officialAccount.update({ where: { id }, data });
  });
};

export const regenerateVerificationCode = async (id: string, organizationId: string) => {
  const existing = await prisma.officialAccount.findFirst({ where: { id, organizationId } });
  if (!existing) throw ApiError.notFound('Official account not found');
  if (existing.status !== 'PENDING' || existing.verificationMethod !== 'ONE_TIME_CODE') {
    throw ApiError.badRequest('Only a pending one-time code can be regenerated');
  }
  return prisma.officialAccount.update({
    where: { id },
    data: issueVerificationCode(),
  });
};

export const deleteOfficialAccount = async (
  id: string,
  organizationId: string,
  actorId: string
) => {
  const existing = await prisma.officialAccount.findFirst({ where: { id, organizationId } });
  if (!existing) throw ApiError.notFound('Official account not found');
  if (existing.status === 'REVOKED') {
    throw ApiError.conflict('A revoked official account cannot be deleted');
  }
  await prisma.$transaction(async (tx) => {
    await auditAccount(tx, {
      action: 'OFFICIAL_ACCOUNT_REVOKE',
      account: existing,
      actorId,
      reason: 'Organization removed the official account',
      afterStatus: 'DELETED',
    });
    await tx.officialAccount.delete({ where: { id } });
  });
};

export const listOfficialAccounts = async (organizationId: string) =>
  prisma.officialAccount.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

export const getOfficialAccount = async (id: string, organizationId: string) => {
  const account = await prisma.officialAccount.findFirst({ where: { id, organizationId } });
  if (!account) throw ApiError.notFound('Official account not found');
  return account;
};

const assertGiveawayDates = (startsAt: Date, endsAt: Date) => {
  if (!(startsAt < endsAt)) throw ApiError.badRequest('startsAt must be before endsAt');
};

export const createOfficialGiveaway = async (input: GiveawayInput) => {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  assertGiveawayDates(startsAt, endsAt);
  if (input.notes) assertNoControlChars(input.notes, 'notes');
  assertNoControlChars(input.title, 'title');
  return prisma.$transaction(async (tx) => {
    await assertEventInOrg(tx, input.eventId, input.organizationId);
    return tx.officialGiveaway.create({
      data: {
        organizationId: input.organizationId,
        eventId: input.eventId ?? null,
        title: input.title.trim(),
        platform: input.platform,
        officialPostUrl: normalizeSocialUrl(
          input.officialPostUrl,
          'officialPostUrl',
          input.platform
        ),
        accountHandle: displayHandle(input.accountHandle),
        startsAt,
        endsAt,
        notes: input.notes?.trim() || null,
        createdBy: input.createdBy,
      },
    });
  });
};

export const updateOfficialGiveaway = async (
  id: string,
  organizationId: string,
  input: Partial<GiveawayInput>
) => {
  const existing = await prisma.officialGiveaway.findFirst({ where: { id, organizationId } });
  if (!existing) throw ApiError.notFound('Official giveaway not found');
  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
  assertGiveawayDates(startsAt, endsAt);
  if (input.title) assertNoControlChars(input.title, 'title');
  if (input.notes) assertNoControlChars(input.notes, 'notes');
  return prisma.$transaction(async (tx) => {
    if (input.eventId) await assertEventInOrg(tx, input.eventId, organizationId);
    return tx.officialGiveaway.update({
      where: { id },
      data: {
        ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.platform !== undefined ? { platform: input.platform } : {}),
        ...(input.officialPostUrl !== undefined
          ? {
              officialPostUrl: normalizeSocialUrl(
                input.officialPostUrl,
                'officialPostUrl',
                input.platform ?? existing.platform
              ),
            }
          : {}),
        ...(input.accountHandle !== undefined
          ? { accountHandle: displayHandle(input.accountHandle) }
          : {}),
        startsAt,
        endsAt,
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });
  });
};

export const deleteOfficialGiveaway = async (id: string, organizationId: string) => {
  const existing = await prisma.officialGiveaway.findFirst({ where: { id, organizationId } });
  if (!existing) throw ApiError.notFound('Official giveaway not found');
  await prisma.officialGiveaway.delete({ where: { id } });
};

export const listOfficialGiveaways = async (organizationId: string, eventId?: string) => {
  if (eventId) await assertEventInOrg(prisma, eventId, organizationId);
  return prisma.officialGiveaway.findMany({
    where: { organizationId, ...(eventId ? { eventId } : {}) },
    orderBy: { startsAt: 'desc' },
  });
};

/**
 * Extension point for provider OAuth. ONE_TIME_CODE compares the public code
 * the checker read. PLATFORM_OAUTH is reserved and rejected.
 */
export const confirmOfficialAccount = async (
  input: {
    platform: SocialPlatform;
    platformAccountId: string;
    code: string;
    verificationMethod?: 'ONE_TIME_CODE' | 'PLATFORM_OAUTH';
  },
  checkerTokenId: string
) => {
  if (input.verificationMethod === 'PLATFORM_OAUTH') {
    throw ApiError.badRequest('Platform OAuth verification is not implemented');
  }
  return confirmOneTimeCode(input, checkerTokenId);
};

const confirmOneTimeCode = async (
  input: { platform: SocialPlatform; platformAccountId: string; code: string },
  checkerTokenId: string
) => {
  assertNoControlChars(input.platformAccountId, 'platformAccountId');
  assertNoControlChars(input.code, 'code');
  const actorId = `checker:${checkerTokenId}`;
  return prisma.$transaction(async (tx) => {
    await lockIdentity(tx, input.platform, input.platformAccountId);
    const rows = await tx.officialAccount.findMany({
      where: { platform: input.platform, platformAccountId: input.platformAccountId },
    });
    if (
      rows.some((row) => row.verificationMethod === 'PLATFORM_OAUTH' && row.status === 'PENDING')
    ) {
      throw ApiError.badRequest('Platform OAuth verification is not implemented');
    }
    const matched = rows.find(
      (row) =>
        row.status === 'PENDING' &&
        row.verificationMethod === 'ONE_TIME_CODE' &&
        row.verificationCode &&
        codesMatch(row.verificationCode, input.code)
    );
    if (!matched) {
      throw ApiError.notFound('No pending account matched that platform account and code');
    }
    if (
      !matched.verificationCodeExpiresAt ||
      matched.verificationCodeExpiresAt.getTime() <= Date.now()
    ) {
      throw ApiError.badRequest('Verification code expired');
    }
    await assertReclaimAllowed(
      tx,
      matched.organizationId,
      matched.platform,
      matched.platformAccountId
    );
    const contested = rows.some(
      (row) => row.id !== matched.id && (row.status === 'VERIFIED' || row.status === 'DISPUTED')
    );
    if (contested) {
      const verified = rows.find((row) => row.status === 'VERIFIED');
      if (verified) {
        await markDisputed(
          tx,
          verified,
          actorId,
          'Another organization confirmed the same platform account'
        );
      }
      await markDisputed(
        tx,
        matched,
        actorId,
        'Confirmation conflicts with another claim on this platform account'
      );
      return { accountId: matched.id, status: 'DISPUTED' as const };
    }
    await tx.officialAccount.update({
      where: { id: matched.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verifiedPlatformAccountKey: verifiedKey(matched.platform, matched.platformAccountId),
      },
    });
    await auditAccount(tx, {
      action: 'OFFICIAL_ACCOUNT_VERIFY',
      account: matched,
      actorId,
      reason: 'Checker confirmed the one-time code',
      afterStatus: 'VERIFIED',
    });
    return { accountId: matched.id, status: 'VERIFIED' as const };
  });
};

export const resolveOfficialAccountDispute = async (actorId: string, winnerAccountId: string) => {
  return prisma.$transaction(async (tx) => {
    const winner = await tx.officialAccount.findUnique({ where: { id: winnerAccountId } });
    if (!winner) throw ApiError.notFound('Official account not found');
    if (winner.status !== 'DISPUTED') {
      throw ApiError.badRequest('Only a disputed account can be resolved');
    }
    await lockIdentity(tx, winner.platform, winner.platformAccountId);
    const rows = await tx.officialAccount.findMany({
      where: { platform: winner.platform, platformAccountId: winner.platformAccountId },
    });
    for (const row of rows) {
      if (row.id === winner.id || row.status === 'REVOKED') continue;
      await tx.officialAccount.update({
        where: { id: row.id },
        data: {
          status: 'REVOKED',
          verifiedPlatformAccountKey: null,
          verificationCode: null,
          verificationCodeExpiresAt: null,
          verifiedAt: null,
        },
      });
      await recordReclaimBlock(tx, row);
      await auditAccount(tx, {
        action: 'OFFICIAL_ACCOUNT_REVOKE',
        account: row,
        actorId,
        reason: 'Platform admin resolved the platform-account dispute',
        afterStatus: 'REVOKED',
      });
    }
    const updated = await tx.officialAccount.update({
      where: { id: winner.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verifiedPlatformAccountKey: verifiedKey(winner.platform, winner.platformAccountId),
      },
    });
    await auditAccount(tx, {
      action: 'OFFICIAL_ACCOUNT_RESOLVE',
      account: winner,
      actorId,
      reason: 'Platform admin confirmed this organization owns the platform account',
      afterStatus: 'VERIFIED',
    });
    return updated;
  });
};

const assertMatchContent = (match: IngestMatchInput) => {
  assertNoControlChars(match.sourceUrl, 'sourceUrl');
  assertNoControlChars(match.matchedRule, 'matchedRule');
  if (match.platformAccountId) assertNoControlChars(match.platformAccountId, 'platformAccountId');
  if (match.suspectDisplayName)
    assertNoControlChars(match.suspectDisplayName, 'suspectDisplayName');
  if (match.matchedText) assertNoControlChars(match.matchedText, 'matchedText');
  for (const phone of match.evidencePhones ?? []) assertNoControlChars(phone, 'evidencePhones');
  for (const email of match.evidenceEmails ?? []) assertNoControlChars(email, 'evidenceEmails');
  const lookalike = match.platform === 'LOOKALIKE_DOMAIN' || match.category === 'LOOKALIKE_DOMAIN';
  if (lookalike) {
    if (match.platform !== 'LOOKALIKE_DOMAIN' || match.category !== 'LOOKALIKE_DOMAIN') {
      throw ApiError.badRequest('Lookalike domains use platform and category LOOKALIKE_DOMAIN');
    }
    const hasPageContent = Boolean(
      match.matchedText?.trim() ||
        match.accountHandle ||
        match.suspectDisplayName ||
        match.platformAccountId ||
        match.imitatedPlatformAccountId ||
        match.imitatedOfficialAccountId ||
        match.evidencePhones?.length ||
        match.evidenceEmails?.length
    );
    if (hasPageContent) throw ApiError.badRequest('Lookalike domains record only the domain');
  }
};

const autoOfficial = async (
  tx: Tx,
  organizationId: string,
  sourceUrl: string,
  platform: SocialPlatform,
  platformAccountId?: string
) => {
  const giveaway = await tx.officialGiveaway.findFirst({
    where: { organizationId, officialPostUrl: sourceUrl },
    select: { id: true },
  });
  if (giveaway) return { status: 'OFFICIAL' as const, officialGiveawayId: giveaway.id };
  if (platformAccountId && platform !== 'LOOKALIKE_DOMAIN') {
    const account = await tx.officialAccount.findFirst({
      where: { organizationId, platform, platformAccountId, status: 'VERIFIED' },
      select: { id: true },
    });
    if (account) return { status: 'OFFICIAL' as const, officialGiveawayId: null as string | null };
  }
  return { status: 'NEW' as const, officialGiveawayId: null as string | null };
};

const resolveImitation = async (tx: Tx, match: IngestMatchInput) => {
  if (match.imitatedOfficialAccountId) {
    const account = await tx.officialAccount.findFirst({
      where: { id: match.imitatedOfficialAccountId, organizationId: match.organizationId },
    });
    if (!account) {
      throw ApiError.badRequest('imitatedOfficialAccountId is not an account in this organization');
    }
    return {
      imitatedOfficialAccountId: account.id,
      imitatedPlatformAccountId: match.imitatedPlatformAccountId ?? account.platformAccountId,
    };
  }
  if (match.imitatedPlatformAccountId && match.platform !== 'LOOKALIKE_DOMAIN') {
    const account = await tx.officialAccount.findFirst({
      where: {
        organizationId: match.organizationId,
        platform: match.platform,
        platformAccountId: match.imitatedPlatformAccountId,
      },
    });
    return {
      imitatedOfficialAccountId: account?.id ?? null,
      imitatedPlatformAccountId: match.imitatedPlatformAccountId,
    };
  }
  return { imitatedOfficialAccountId: null, imitatedPlatformAccountId: null };
};

const sourceIdentity = (match: IngestMatchInput): string =>
  match.platform === 'LOOKALIKE_DOMAIN'
    ? normalizeDomain(match.sourceUrl)
    : normalizeSocialUrl(match.sourceUrl, 'sourceUrl', match.platform);

const ingestOne = async (tx: Tx, match: IngestMatchInput, checkerTokenId: string) => {
  assertMatchContent(match);
  await assertOrgExists(tx, match.organizationId);
  await assertEventInOrg(tx, match.eventId, match.organizationId);
  const sourceUrl = sourceIdentity(match);
  const imitation = await resolveImitation(tx, match);
  const official = await autoOfficial(
    tx,
    match.organizationId,
    sourceUrl,
    match.platform,
    match.platformAccountId
  );
  const existing = await tx.scamMatch.findUnique({
    where: { organizationId_sourceUrl: { organizationId: match.organizationId, sourceUrl } },
  });
  if (existing) {
    if (existing.status === 'NEW') {
      const updated = await tx.scamMatch.update({
        where: { id: existing.id },
        data: {
          eventId: match.eventId ?? existing.eventId,
          platform: match.platform,
          category: match.category,
          accountHandle: match.accountHandle ? displayHandle(match.accountHandle) : null,
          suspectDisplayName: match.suspectDisplayName ?? null,
          platformAccountId: match.platformAccountId ?? null,
          matchedText: match.matchedText ?? null,
          matchedRule: match.matchedRule,
          status: official.status,
          officialGiveawayId: official.officialGiveawayId,
          ...imitation,
          evidencePhones: match.evidencePhones ?? [],
          evidenceEmails: match.evidenceEmails ?? [],
          ...(official.status === 'OFFICIAL'
            ? { reviewedAt: new Date(), reviewedBy: `checker:${checkerTokenId}` }
            : {}),
        },
      });
      return { id: updated.id, status: updated.status, created: false };
    }
    return { id: existing.id, status: existing.status, created: false };
  }
  const created = await tx.scamMatch.create({
    data: {
      organizationId: match.organizationId,
      eventId: match.eventId ?? null,
      platform: match.platform,
      category: match.category,
      sourceUrl,
      accountHandle: match.accountHandle ? displayHandle(match.accountHandle) : null,
      suspectDisplayName: match.suspectDisplayName ?? null,
      platformAccountId: match.platformAccountId ?? null,
      matchedText: match.matchedText ?? null,
      matchedRule: match.matchedRule,
      detectedAt: normalizeDetectedAt(match.detectedAt),
      status: official.status,
      officialGiveawayId: official.officialGiveawayId,
      ...imitation,
      evidencePhones: match.evidencePhones ?? [],
      evidenceEmails: match.evidenceEmails ?? [],
      ...(official.status === 'OFFICIAL'
        ? { reviewedAt: new Date(), reviewedBy: `checker:${checkerTokenId}` }
        : {}),
    },
  });
  return { id: created.id, status: created.status, created: true };
};

export const ingestMatches = async (matches: unknown[], checkerTokenId: string) => {
  const results = [];
  for (const raw of matches) {
    const parsed = parseIngestMatch(raw);
    if (!parsed.success) {
      results.push({ error: 'Validation failed' });
      continue;
    }
    try {
      results.push(await prisma.$transaction((tx) => ingestOne(tx, parsed.data, checkerTokenId)));
    } catch (error) {
      results.push({
        error: error instanceof ApiError ? error.message : 'Match rejected',
      });
    }
  }
  return results;
};

export const reportCheckerStatus = async (input: {
  platform: SocialPlatform;
  state: 'OK' | 'BLOCKED' | 'LOGIN_PROMPT' | 'CAPTCHA';
  detail?: string;
}) => {
  if (input.detail) assertNoControlChars(input.detail, 'detail');
  const row = await prisma.checkerPlatformStatus.upsert({
    where: { platform: input.platform },
    create: {
      platform: input.platform,
      state: input.state,
      detail: input.detail ?? null,
      reportedAt: new Date(),
    },
    update: {
      state: input.state,
      detail: input.detail ?? null,
      reportedAt: new Date(),
    },
  });
  return { platform: row.platform, state: row.state, reportedAt: row.reportedAt };
};

export const listCheckerStatus = async () =>
  prisma.checkerPlatformStatus.findMany({ orderBy: { platform: 'asc' } });

type MatchFilters = {
  organizationId: string;
  eventId?: string;
  platform?: SocialPlatform;
  category?: MatchCategoryName;
  status?: ScamMatchStatus;
  page?: number;
  limit?: number;
};

const matchWhere = (filters: MatchFilters): Prisma.ScamMatchWhereInput => ({
  organizationId: filters.organizationId,
  ...(filters.eventId ? { eventId: filters.eventId } : {}),
  ...(filters.platform ? { platform: filters.platform } : {}),
  ...(filters.category ? { category: filters.category } : {}),
  ...(filters.status ? { status: filters.status } : {}),
});

export const listScamMatches = async (filters: MatchFilters, includeEvidence: boolean) => {
  await assertEventInOrg(prisma, filters.eventId, filters.organizationId);
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 50, 100);
  const where = matchWhere(filters);
  const [rows, total, newCount] = await Promise.all([
    prisma.scamMatch.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.scamMatch.count({ where }),
    prisma.scamMatch.count({ where: { ...where, status: 'NEW' } }),
  ]);
  return {
    matches: rows.map((row) => presentMatch(row, includeEvidence)),
    newCount,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const getScamMatch = async (
  id: string,
  organizationId: string,
  includeEvidence: boolean
) => {
  const match = await prisma.scamMatch.findFirst({ where: { id, organizationId } });
  if (!match) throw ApiError.notFound('Match not found');
  return presentMatch(match, includeEvidence);
};

export const reviewScamMatch = async (
  id: string,
  organizationId: string,
  actorId: string,
  input: { status: ScamMatchStatus; officialGiveawayId?: string },
  includeEvidence: boolean
) => {
  const match = await prisma.scamMatch.findFirst({ where: { id, organizationId } });
  if (!match) throw ApiError.notFound('Match not found');
  if (input.officialGiveawayId) {
    const giveaway = await prisma.officialGiveaway.findFirst({
      where: { id: input.officialGiveawayId, organizationId },
      select: { id: true },
    });
    if (!giveaway) {
      throw ApiError.badRequest('officialGiveawayId is not a giveaway in this organization');
    }
  }
  const updated = await prisma.scamMatch.update({
    where: { id },
    data: {
      status: input.status,
      reviewedBy: actorId,
      reviewedAt: new Date(),
      ...(input.officialGiveawayId ? { officialGiveawayId: input.officialGiveawayId } : {}),
    },
  });
  return presentMatch(updated, includeEvidence);
};

export const resolveCheckerScopes = (scopes?: readonly string[]): CheckerScopeName[] => {
  if (!scopes) return [...DEFAULT_CHECKER_SCOPES];
  const unique = [...new Set(scopes)];
  if (
    !unique.length ||
    unique.some((scope) => !CHECKER_SCOPES.includes(scope as CheckerScopeName))
  ) {
    throw ApiError.badRequest('Unknown checker token scope');
  }
  return unique as CheckerScopeName[];
};

export const listVerifiedTargets = async (page: number, limit: number) => {
  const where = {
    status: 'VERIFIED' as const,
    verifiedPlatformAccountKey: { not: null },
    organization: { status: 'ACTIVE' as const },
  };
  const [total, rows] = await Promise.all([
    prisma.officialAccount.count({ where }),
    prisma.officialAccount.findMany({
      where,
      select: {
        organizationId: true,
        platform: true,
        platformAccountId: true,
        handle: true,
      },
      orderBy: [{ organizationId: 'asc' }, { platform: 'asc' }, { platformAccountId: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return {
    targets: rows.map((row) => ({
      organizationId: row.organizationId,
      platform: row.platform,
      platformAccountId: row.platformAccountId,
      handle: row.handle,
    })),
    total,
  };
};

export const issueCheckerToken = async (actorId: string, label?: string, scopes?: string[]) => {
  const granted = resolveCheckerScopes(scopes);
  if (granted.includes('targets:read')) {
    const actor = await getActorScopeById(actorId);
    if (!isGlobalAdmin(actor)) {
      throw ApiError.forbidden('Only a platform admin can grant targets:read');
    }
  }
  const token = `${CHECKER_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.giveawayCheckerToken.create({
      data: { tokenHash: hashCheckerToken(token), label: label || 'checker', scopes: granted },
    });
    await recordStaffAction(tx, {
      action: 'CHECKER_TOKEN_ISSUE',
      subjectType: 'CHECKER_TOKEN',
      subjectId: row.id,
      organizationId: 'platform',
      actorId,
      reason: 'Issued a giveaway checker token',
      after: { label: row.label, scopes: granted },
    });
    return row;
  });
  return { id: created.id, token, scopes: granted, createdAt: created.createdAt };
};

export const revokeCheckerToken = async (actorId: string, id: string) => {
  const existing = await prisma.giveawayCheckerToken.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Checker token not found');
  if (existing.revokedAt) return { id: existing.id, revokedAt: existing.revokedAt };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.giveawayCheckerToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await recordStaffAction(tx, {
      action: 'CHECKER_TOKEN_REVOKE',
      subjectType: 'CHECKER_TOKEN',
      subjectId: row.id,
      organizationId: 'platform',
      actorId,
      reason: 'Revoked a giveaway checker token',
      after: { revokedAt: row.revokedAt?.toISOString() ?? null },
    });
    return row;
  });
  return { id: updated.id, revokedAt: updated.revokedAt };
};

export const liftReclaimBlock = async (actorId: string, accountId: string) => {
  const existing = await prisma.officialAccount.findUnique({ where: { id: accountId } });
  if (!existing) throw ApiError.notFound('Official account not found');
  if (existing.status !== 'REVOKED') {
    throw ApiError.badRequest('Only a revoked claim can be lifted');
  }
  await prisma.$transaction(async (tx) => {
    await tx.officialAccountReclaimBlock.updateMany({
      where: {
        organizationId: existing.organizationId,
        platform: existing.platform,
        platformAccountId: existing.platformAccountId,
        liftedAt: null,
      },
      data: { liftedAt: new Date(), liftedBy: actorId },
    });
    await recordStaffAction(tx, {
      action: 'OFFICIAL_ACCOUNT_LIFT',
      subjectType: 'OFFICIAL_ACCOUNT',
      subjectId: existing.id,
      organizationId: existing.organizationId,
      actorId,
      reason: 'Platform admin lifted the re-claim block',
      before: { status: 'REVOKED' },
      after: { status: 'LIFTED' },
    });
    await tx.officialAccount.delete({ where: { id: existing.id } });
  });
};

export const purgeExpiredScamMatches = async (now = new Date()): Promise<number> => {
  const cutoff = new Date(now.getTime() - MATCH_RETENTION_MS);
  const result = await prisma.scamMatch.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
};

export const presentAccountsForActor = (accounts: OfficialAccount[], includePrivate: boolean) =>
  accounts.map((account) => presentAccount(account, includePrivate));
