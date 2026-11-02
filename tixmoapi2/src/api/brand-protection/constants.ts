export const SOCIAL_PLATFORMS = ['X', 'REDDIT', 'FACEBOOK', 'INSTAGRAM'] as const;
export const MATCH_PLATFORMS = [...SOCIAL_PLATFORMS, 'LOOKALIKE_DOMAIN'] as const;
export const MATCH_CATEGORIES = [
  'IMPERSONATION_PROFILE',
  'FAKE_CONTEST',
  'FALSE_ASSOCIATION',
  'LOOKALIKE_DOMAIN',
] as const;
export const REVIEW_STATUSES = ['CONFIRMED_SCAM', 'FALSE_POSITIVE', 'OFFICIAL'] as const;
export const CHECKER_STATES = ['OK', 'BLOCKED', 'LOGIN_PROMPT', 'CAPTCHA'] as const;
export const ACCOUNT_STATUSES = ['PENDING', 'VERIFIED', 'REVOKED', 'DISPUTED'] as const;
export const VERIFICATION_METHODS = ['ONE_TIME_CODE', 'PLATFORM_OAUTH'] as const;

export const CHECKER_TOKEN_PREFIX = 'gwc_';
export const MATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const VERIFICATION_CODE_TTL_MS = 48 * 60 * 60 * 1000;
export const DETECTED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const INGEST_BATCH_LIMIT = 50;

export const ORG_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

export type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];
export type MatchPlatformName = (typeof MATCH_PLATFORMS)[number];
export type MatchCategoryName = (typeof MATCH_CATEGORIES)[number];
export type ReviewStatusName = (typeof REVIEW_STATUSES)[number];
export type CheckerStateName = (typeof CHECKER_STATES)[number];
export type VerificationMethodName = (typeof VERIFICATION_METHODS)[number];
