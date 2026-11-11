-- Social Command Center v1 (additive only). Rollback: DROP the new tables/types listed in docs/social/v1-data-design.md.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SOCIAL_ALERT';

-- CreateEnum
CREATE TYPE "SocialTokenKind" AS ENUM ('sandbox', 'live');
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'NEEDS_ATTENTION');
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK_PAGE', 'INSTAGRAM');
CREATE TYPE "SocialIssueState" AS ENUM ('NEW', 'IN_PROGRESS', 'HANDLED', 'DISMISSED');
CREATE TYPE "SocialSeverity" AS ENUM ('HIGH', 'MED', 'LOW');
CREATE TYPE "SocialThresholdMode" AS ENUM ('NORMAL', 'ON_SALE_DAY', 'EVENT_DAY');
CREATE TYPE "SocialMappingSource" AS ENUM ('automatic', 'override');

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "handle" TEXT,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "token_kind" "SocialTokenKind" NOT NULL,
    "key_id" TEXT,
    "token_ciphertext" TEXT,
    "refresh_ciphertext" TEXT,
    "lookup_hmac" TEXT,
    "graph_base_url" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linked_connection_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_org_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL,
    "keywords" JSONB NOT NULL,
    "high_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_hour_local" INTEGER NOT NULL DEFAULT 9,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_org_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_mode_holds" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "mode" "SocialThresholdMode" NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_mode_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_event_mappings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "external_post_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" "SocialMappingSource" NOT NULL DEFAULT 'automatic',
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_event_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "event_id" TEXT,
    "external_post_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "caption_excerpt" VARCHAR(280),
    "permalink" TEXT,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "reach" INTEGER,
    "engagements" INTEGER,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "insights_pending" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "external_comment_id" TEXT NOT NULL,
    "parent_external_id" TEXT,
    "provider_commenter_id" TEXT,
    "handle" TEXT,
    "body" TEXT,
    "permalink" TEXT,
    "is_page_reply" BOOLEAN NOT NULL DEFAULT false,
    "created_time" TIMESTAMP(3) NOT NULL,
    "sentiment_label" TEXT,
    "topic_label" TEXT,
    "classifier_confidence" DOUBLE PRECISION,
    "purged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_issues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "post_id" TEXT,
    "kind" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "severity" "SocialSeverity" NOT NULL,
    "state" "SocialIssueState" NOT NULL DEFAULT 'NEW',
    "rule_text" TEXT NOT NULL,
    "mode" "SocialThresholdMode" NOT NULL,
    "wave_bucket_key" TEXT,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "assignee_id" TEXT,
    "dismiss_reason" VARCHAR(1000),
    "last_alert_at" TIMESTAMP(3),
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_issue_comments" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_issue_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_issue_notes" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_issue_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_issue_activities" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_issue_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_sync_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "posts_fetched" INTEGER NOT NULL DEFAULT 0,
    "comments_fetched" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "social_sync_runs_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "social_connections_organization_id_platform_external_account_id_key" ON "social_connections"("organization_id", "platform", "external_account_id");
CREATE INDEX "social_connections_organization_id_status_idx" ON "social_connections"("organization_id", "status");
CREATE UNIQUE INDEX "social_org_settings_organization_id_key" ON "social_org_settings"("organization_id");
CREATE INDEX "social_mode_holds_organization_id_event_id_until_idx" ON "social_mode_holds"("organization_id", "event_id", "until");
CREATE UNIQUE INDEX "social_event_mappings_organization_id_external_post_id_key" ON "social_event_mappings"("organization_id", "external_post_id");
CREATE INDEX "social_event_mappings_organization_id_event_id_idx" ON "social_event_mappings"("organization_id", "event_id");
CREATE UNIQUE INDEX "social_posts_organization_id_external_post_id_key" ON "social_posts"("organization_id", "external_post_id");
CREATE INDEX "social_posts_organization_id_posted_at_idx" ON "social_posts"("organization_id", "posted_at");
CREATE INDEX "social_posts_organization_id_event_id_idx" ON "social_posts"("organization_id", "event_id");
CREATE UNIQUE INDEX "social_comments_organization_id_external_comment_id_key" ON "social_comments"("organization_id", "external_comment_id");
CREATE INDEX "social_comments_organization_id_created_time_idx" ON "social_comments"("organization_id", "created_time");
CREATE INDEX "social_comments_post_id_created_time_idx" ON "social_comments"("post_id", "created_time");
CREATE INDEX "social_issues_organization_id_state_severity_idx" ON "social_issues"("organization_id", "state", "severity");
CREATE INDEX "social_issues_organization_id_wave_bucket_key_idx" ON "social_issues"("organization_id", "wave_bucket_key");
CREATE INDEX "social_issues_organization_id_event_id_idx" ON "social_issues"("organization_id", "event_id");
CREATE UNIQUE INDEX "social_issue_comments_issue_id_comment_id_key" ON "social_issue_comments"("issue_id", "comment_id");
CREATE INDEX "social_issue_notes_issue_id_created_at_idx" ON "social_issue_notes"("issue_id", "created_at");
CREATE INDEX "social_issue_activities_issue_id_created_at_idx" ON "social_issue_activities"("issue_id", "created_at");
CREATE INDEX "social_sync_runs_organization_id_started_at_idx" ON "social_sync_runs"("organization_id", "started_at");

-- ForeignKeys (org/member/event/post/comment only — never order/ticket/buyer)
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_org_settings" ADD CONSTRAINT "social_org_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_mode_holds" ADD CONSTRAINT "social_mode_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_mode_holds" ADD CONSTRAINT "social_mode_holds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_mode_holds" ADD CONSTRAINT "social_mode_holds_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_event_mappings" ADD CONSTRAINT "social_event_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_event_mappings" ADD CONSTRAINT "social_event_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_event_mappings" ADD CONSTRAINT "social_event_mappings_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "social_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "social_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_comments" ADD CONSTRAINT "social_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issues" ADD CONSTRAINT "social_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issues" ADD CONSTRAINT "social_issues_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_issues" ADD CONSTRAINT "social_issues_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_issues" ADD CONSTRAINT "social_issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_issue_comments" ADD CONSTRAINT "social_issue_comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "social_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issue_comments" ADD CONSTRAINT "social_issue_comments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "social_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issue_notes" ADD CONSTRAINT "social_issue_notes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "social_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issue_notes" ADD CONSTRAINT "social_issue_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_issue_activities" ADD CONSTRAINT "social_issue_activities_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "social_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_issue_activities" ADD CONSTRAINT "social_issue_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
