-- Brand protection: official accounts and giveaways, scam matches, checker tokens.
-- Additive. Existing ticket, order, and payment rows are not rewritten.
-- Marketplace sources are not part of this schema.

CREATE TYPE "SocialPlatform" AS ENUM ('X', 'REDDIT', 'FACEBOOK', 'INSTAGRAM', 'LOOKALIKE_DOMAIN');
CREATE TYPE "OfficialAccountStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED', 'DISPUTED');
CREATE TYPE "AccountVerificationMethod" AS ENUM ('ONE_TIME_CODE', 'PLATFORM_OAUTH');
CREATE TYPE "ScamMatchStatus" AS ENUM ('NEW', 'CONFIRMED_SCAM', 'FALSE_POSITIVE', 'OFFICIAL');
CREATE TYPE "ScamMatchCategory" AS ENUM ('IMPERSONATION_PROFILE', 'FAKE_CONTEST', 'FALSE_ASSOCIATION', 'LOOKALIKE_DOMAIN');
CREATE TYPE "CheckerRunState" AS ENUM ('OK', 'BLOCKED', 'LOGIN_PROMPT', 'CAPTCHA');

CREATE TABLE "official_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "platform_account_id" VARCHAR(200) NOT NULL,
    "handle" VARCHAR(100) NOT NULL,
    "profile_url" VARCHAR(500) NOT NULL,
    "display_name" VARCHAR(200),
    "status" "OfficialAccountStatus" NOT NULL DEFAULT 'PENDING',
    "verification_method" "AccountVerificationMethod" NOT NULL DEFAULT 'ONE_TIME_CODE',
    "verification_code" VARCHAR(32),
    "verification_code_expires_at" TIMESTAMP(3),
    "verified_platform_account_key" VARCHAR(220),
    "verified_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "official_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_accounts_verified_platform_account_key_key"
    ON "official_accounts"("verified_platform_account_key");
CREATE INDEX "official_accounts_organization_id_status_idx"
    ON "official_accounts"("organization_id", "status");
CREATE INDEX "official_accounts_platform_platform_account_id_idx"
    ON "official_accounts"("platform", "platform_account_id");

CREATE TABLE "official_giveaways" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "official_post_url" VARCHAR(500) NOT NULL,
    "account_handle" VARCHAR(100) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "notes" VARCHAR(2000),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "official_giveaways_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_giveaways_organization_id_idx" ON "official_giveaways"("organization_id");
CREATE INDEX "official_giveaways_organization_id_official_post_url_idx"
    ON "official_giveaways"("organization_id", "official_post_url");

CREATE TABLE "scam_matches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "category" "ScamMatchCategory" NOT NULL,
    "source_url" VARCHAR(500) NOT NULL,
    "account_handle" VARCHAR(100),
    "suspect_display_name" VARCHAR(200),
    "platform_account_id" VARCHAR(200),
    "matched_text" VARCHAR(500),
    "matched_rule" VARCHAR(200) NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "status" "ScamMatchStatus" NOT NULL DEFAULT 'NEW',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "official_giveaway_id" TEXT,
    "imitated_official_account_id" TEXT,
    "imitated_platform_account_id" VARCHAR(200),
    "evidence_phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scam_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scam_matches_organization_id_source_url_key"
    ON "scam_matches"("organization_id", "source_url");
CREATE INDEX "scam_matches_organization_id_status_detected_at_idx"
    ON "scam_matches"("organization_id", "status", "detected_at");
CREATE INDEX "scam_matches_detected_at_idx" ON "scam_matches"("detected_at");

CREATE TABLE "giveaway_checker_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL DEFAULT 'checker',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "giveaway_checker_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "giveaway_checker_tokens_token_hash_key"
    ON "giveaway_checker_tokens"("token_hash");

CREATE TABLE "checker_platform_statuses" (
    "platform" "SocialPlatform" NOT NULL,
    "state" "CheckerRunState" NOT NULL,
    "detail" VARCHAR(200),
    "reported_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "checker_platform_statuses_pkey" PRIMARY KEY ("platform")
);

ALTER TABLE "official_accounts"
    ADD CONSTRAINT "official_accounts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "official_giveaways"
    ADD CONSTRAINT "official_giveaways_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "official_giveaways"
    ADD CONSTRAINT "official_giveaways_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scam_matches"
    ADD CONSTRAINT "scam_matches_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scam_matches"
    ADD CONSTRAINT "scam_matches_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scam_matches"
    ADD CONSTRAINT "scam_matches_official_giveaway_id_fkey"
    FOREIGN KEY ("official_giveaway_id") REFERENCES "official_giveaways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scam_matches"
    ADD CONSTRAINT "scam_matches_imitated_official_account_id_fkey"
    FOREIGN KEY ("imitated_official_account_id") REFERENCES "official_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
