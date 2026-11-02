import type { Finding, OrganizationTarget, SocialPlatform } from './types.js';
import { cleanText, compact, extractEvidence, normalizeSpaces, safeDetectedAt } from './text.js';

const CONTEST =
  /\b(giveaway|giveaways|contest|contests|enter to win|free tickets|winning tickets)\b/i;
const ASSOCIATION =
  /\b(official account|official page|official partner|we are the official|this page speaks for|authorized by|on behalf of)\b/i;

const mentionsOrg = (org: OrganizationTarget, text: string): boolean => {
  const spaced = normalizeSpaces(text);
  const packed = compact(text);
  for (const name of org.names) {
    const normal = normalizeSpaces(name);
    const tight = compact(name);
    if (normal.length >= 4 && spaced.includes(normal)) return true;
    if (tight.length >= 5 && packed.includes(tight)) return true;
  }
  return false;
};

const impersonates = (org: OrganizationTarget, platform: SocialPlatform, input: {
  accountHandle?: string;
  suspectDisplayName?: string;
}): boolean => {
  const display = input.suspectDisplayName ? normalizeSpaces(input.suspectDisplayName) : '';
  const handle = compact(input.accountHandle ?? '');
  for (const name of org.names) {
    if (display && display === normalizeSpaces(name)) return true;
    if (handle && handle === compact(name) && handle.length >= 5) return true;
  }
  for (const account of org.accounts) {
    if (account.platform !== platform) continue;
    const official = compact(account.handle);
    if (!handle || official.length < 5) continue;
    if (handle === official || (handle.startsWith(official) && handle.length > official.length)) return true;
  }
  return false;
};

export type SocialObservation = {
  platform: SocialPlatform;
  sourceUrl: string;
  platformAccountId?: string;
  accountHandle?: string;
  suspectDisplayName?: string;
  text: string;
  detectedAt?: string;
};

export const classifySocial = (
  org: OrganizationTarget,
  observation: SocialObservation,
  now = new Date()
): Finding | null => {
  const official = org.accounts.some(
    (account) =>
      account.platform === observation.platform &&
      observation.platformAccountId &&
      account.platformAccountId === observation.platformAccountId
  );
  if (official) return null;
  const text = cleanText(observation.text, 500);
  const contest = mentionsOrg(org, text) && CONTEST.test(text);
  const association = mentionsOrg(org, text) && ASSOCIATION.test(text);
  const profile = impersonates(org, observation.platform, observation);
  let category: Finding['category'] | null = null;
  let matchedRule = '';
  if (contest) {
    category = 'FAKE_CONTEST';
    matchedRule = 'fake-contest-language';
  } else if (association) {
    category = 'FALSE_ASSOCIATION';
    matchedRule = 'false-association-language';
  } else if (profile) {
    category = 'IMPERSONATION_PROFILE';
    matchedRule = observation.suspectDisplayName ? 'impersonation-display-name' : 'impersonation-handle';
  }
  if (!category) return null;
  const imitated = org.accounts.filter((account) => account.platform === observation.platform);
  const evidence = extractEvidence(text);
  const handle = observation.accountHandle
    ? cleanText(observation.accountHandle.replace(/^@+/, ''), 100)
    : '';
  const display = observation.suspectDisplayName
    ? cleanText(observation.suspectDisplayName, 200)
    : '';
  return {
    organizationId: org.organizationId,
    ...(org.eventId ? { eventId: org.eventId } : {}),
    platform: observation.platform,
    category,
    sourceUrl: observation.sourceUrl,
    ...(observation.platformAccountId
      ? { platformAccountId: cleanText(observation.platformAccountId, 200) }
      : {}),
    ...(handle ? { accountHandle: handle } : {}),
    ...(display ? { suspectDisplayName: display } : {}),
    ...(text ? { matchedText: text } : {}),
    matchedRule,
    detectedAt: safeDetectedAt(observation.detectedAt, now),
    ...(imitated.length === 1 ? { imitatedPlatformAccountId: imitated[0].platformAccountId } : {}),
    ...evidence,
  };
};

const CODE = /\b[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}\b/g;

export const verificationFromOfficialText = (
  platform: SocialPlatform,
  platformAccountId: string,
  text: string
): { platform: SocialPlatform; platformAccountId: string; code: string; verificationMethod: 'ONE_TIME_CODE' } | null => {
  const match = text.toUpperCase().match(CODE);
  if (!match) return null;
  return {
    platform,
    platformAccountId,
    code: match[0],
    verificationMethod: 'ONE_TIME_CODE',
  };
};
