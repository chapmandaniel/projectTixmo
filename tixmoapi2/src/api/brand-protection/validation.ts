import { z } from 'zod';
import {
  CHECKER_STATES,
  INGEST_BATCH_LIMIT,
  MATCH_CATEGORIES,
  MATCH_PLATFORMS,
  REVIEW_STATUSES,
  SOCIAL_PLATFORMS,
  VERIFICATION_METHODS,
} from './constants';

const guid = z.string().guid();
const handle = z.string().trim().min(1).max(100);
const platformAccountId = z.string().trim().min(1).max(200);
const socialPlatform = z.enum(SOCIAL_PLATFORMS);
const matchPlatform = z.enum(MATCH_PLATFORMS);
const category = z.enum(MATCH_CATEGORIES);

const evidencePhones = z.array(z.string().trim().min(3).max(40)).max(5);
const evidenceEmails = z.array(z.string().trim().email().max(120)).max(5);

export const createAccountSchema = z.object({
  body: z
    .object({
      organizationId: guid.optional(),
      platform: socialPlatform,
      platformAccountId,
      handle,
      profileUrl: z.string().trim().min(8).max(500),
      displayName: z.string().trim().min(1).max(200).optional(),
    })
    .strict(),
});

export const updateAccountSchema = z.object({
  params: z.object({ id: guid }).strict(),
  body: z
    .object({
      handle: handle.optional(),
      profileUrl: z.string().trim().min(8).max(500).optional(),
      displayName: z.string().trim().min(1).max(200).nullable().optional(),
    })
    .strict(),
});

export const accountIdSchema = z.object({
  params: z.object({ id: guid }).strict(),
});

export const listAccountsSchema = z.object({
  query: z
    .object({
      organizationId: guid.optional(),
      eventId: guid.optional(),
    })
    .strict(),
});

export const createGiveawaySchema = z.object({
  body: z
    .object({
      organizationId: guid.optional(),
      eventId: guid.optional(),
      title: z.string().trim().min(1).max(200),
      platform: socialPlatform,
      officialPostUrl: z.string().trim().min(8).max(500),
      accountHandle: handle,
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      notes: z.string().trim().max(2000).optional(),
    })
    .strict()
    .refine((data) => new Date(data.startsAt) < new Date(data.endsAt), {
      message: 'startsAt must be before endsAt',
      path: ['startsAt'],
    }),
});

export const updateGiveawaySchema = z.object({
  params: z.object({ id: guid }).strict(),
  body: z
    .object({
      eventId: guid.nullable().optional(),
      title: z.string().trim().min(1).max(200).optional(),
      platform: socialPlatform.optional(),
      officialPostUrl: z.string().trim().min(8).max(500).optional(),
      accountHandle: handle.optional(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    })
    .strict(),
});

export const listGiveawaysSchema = z.object({
  query: z
    .object({
      organizationId: guid.optional(),
      eventId: guid.optional(),
    })
    .strict(),
});

const ingestMatchSchema = z
  .object({
    organizationId: guid,
    eventId: guid.optional(),
    platform: matchPlatform,
    category,
    sourceUrl: z.string().trim().min(1).max(500),
    platformAccountId: platformAccountId.optional(),
    accountHandle: handle.optional(),
    suspectDisplayName: z.string().trim().min(1).max(200).optional(),
    matchedText: z.string().max(500).optional(),
    matchedRule: z.string().trim().min(1).max(200),
    detectedAt: z.string().datetime(),
    imitatedPlatformAccountId: platformAccountId.optional(),
    imitatedOfficialAccountId: guid.optional(),
    evidencePhones: evidencePhones.optional(),
    evidenceEmails: evidenceEmails.optional(),
  })
  .strict();

export const parseIngestMatch = (value: unknown) => ingestMatchSchema.safeParse(value);

export const ingestMatchesSchema = z.object({
  body: z
    .object({
      matches: z.array(z.unknown()).min(1).max(INGEST_BATCH_LIMIT),
    })
    .strict(),
});

export const ingestStatusSchema = z.object({
  body: z
    .object({
      platform: matchPlatform,
      state: z.enum(CHECKER_STATES),
      detail: z.string().trim().max(200).optional(),
    })
    .strict(),
});

export const ingestVerificationSchema = z.object({
  body: z
    .object({
      platform: socialPlatform,
      platformAccountId,
      code: z.string().trim().min(4).max(32),
      verificationMethod: z.enum(VERIFICATION_METHODS).optional(),
    })
    .strict(),
});

export const listMatchesSchema = z.object({
  query: z
    .object({
      organizationId: guid.optional(),
      eventId: guid.optional(),
      platform: matchPlatform.optional(),
      category: category.optional(),
      status: z.enum(['NEW', 'CONFIRMED_SCAM', 'FALSE_POSITIVE', 'OFFICIAL']).optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .strict(),
});

export const reviewMatchSchema = z.object({
  params: z.object({ id: guid }).strict(),
  body: z
    .object({
      status: z.enum(REVIEW_STATUSES),
      officialGiveawayId: guid.optional(),
    })
    .strict(),
});

export const resolveDisputeSchema = z.object({
  body: z.object({ winnerAccountId: guid }).strict(),
});

export const issueTokenSchema = z.object({
  body: z
    .object({
      label: z.string().trim().min(1).max(80).optional(),
    })
    .strict(),
});

export const revokeTokenSchema = z.object({
  params: z.object({ id: guid }).strict(),
});
