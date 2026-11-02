import { OfficialAccount, ScamMatch } from '@prisma/client';

export type AccountRecord = OfficialAccount;
export type MatchRecord = ScamMatch;

const accountFields = (account: OfficialAccount, includeCode: boolean) => ({
  id: account.id,
  organizationId: account.organizationId,
  platform: account.platform,
  platformAccountId: account.platformAccountId,
  handle: account.handle,
  profileUrl: account.profileUrl,
  displayName: account.displayName,
  status: account.status,
  verificationMethod: account.verificationMethod,
  ...(includeCode && account.status === 'PENDING' && account.verificationCode
    ? {
        verificationCode: account.verificationCode,
        verificationCodeExpiresAt: account.verificationCodeExpiresAt,
      }
    : {}),
  verifiedAt: account.verifiedAt,
  createdBy: account.createdBy,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

export const presentAccount = (account: OfficialAccount, includePrivate: boolean) =>
  accountFields(account, includePrivate);

export const presentMatch = (match: ScamMatch, includeEvidence: boolean) => {
  const presented = {
    id: match.id,
    organizationId: match.organizationId,
    eventId: match.eventId,
    platform: match.platform,
    category: match.category,
    sourceUrl: match.sourceUrl,
    accountHandle: match.accountHandle,
    suspectDisplayName: match.suspectDisplayName,
    platformAccountId: match.platformAccountId,
    matchedText: match.matchedText,
    matchedRule: match.matchedRule,
    detectedAt: match.detectedAt,
    status: match.status,
    reviewedBy: match.reviewedBy,
    reviewedAt: match.reviewedAt,
    officialGiveawayId: match.officialGiveawayId,
    imitatedOfficialAccountId: match.imitatedOfficialAccountId,
    imitatedPlatformAccountId: match.imitatedPlatformAccountId,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
  if (!includeEvidence) return presented;
  return {
    ...presented,
    evidencePhones: match.evidencePhones,
    evidenceEmails: match.evidenceEmails,
  };
};
