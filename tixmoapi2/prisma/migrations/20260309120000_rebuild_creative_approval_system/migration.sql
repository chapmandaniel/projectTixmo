DROP TABLE IF EXISTS "approval_comments";
DROP TABLE IF EXISTS "approval_review_decisions";
DROP TABLE IF EXISTS "approval_reminders";
DROP TABLE IF EXISTS "approval_reviewers";
DROP TABLE IF EXISTS "approval_assets";
DROP TABLE IF EXISTS "approval_revisions";
DROP TABLE IF EXISTS "approval_requests";

DROP TYPE IF EXISTS "ApprovalPriority";
DROP TYPE IF EXISTS "ApprovalType";
DROP TYPE IF EXISTS "ApprovalReminderType";
DROP TYPE IF EXISTS "ApprovalReviewerType";
DROP TYPE IF EXISTS "ApprovalDecision";
DROP TYPE IF EXISTS "ApprovalStatus";

CREATE TYPE "ApprovalStatus" AS ENUM (
    'PENDING_REVIEW',
    'CHANGES_REQUESTED',
    'UPDATED',
    'APPROVED',
    'DECLINED'
);

CREATE TYPE "ApprovalDecision" AS ENUM (
    'APPROVED',
    'CHANGES_REQUESTED',
    'DECLINED'
);

CREATE TYPE "ApprovalReviewerType" AS ENUM (
    'INTERNAL',
    'EXTERNAL'
);

CREATE TYPE "ApprovalReminderType" AS ENUM (
    'AFTER_24_HOURS',
    'DEADLINE_48_HOURS',
    'DEADLINE_24_HOURS'
);

CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "deadline" TIMESTAMP(3) NOT NULL,
    "latest_revision_number" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "last_comment_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_revisions" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "summary" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_assets" (
    "id" TEXT NOT NULL,
    "approval_revision_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_reviewers" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "reviewer_type" "ApprovalReviewerType" NOT NULL DEFAULT 'EXTERNAL',
    "user_id" TEXT,
    "token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "first_viewed_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),
    "last_comment_at" TIMESTAMP(3),
    "last_decision_at" TIMESTAMP(3),
    "last_interaction_at" TIMESTAMP(3),
    "last_interaction_revision_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_reviewers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_review_decisions" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "approval_revision_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_review_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_comments" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "approval_revision_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "user_id" TEXT,
    "parent_comment_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_reminders" (
    "id" TEXT NOT NULL,
    "approval_revision_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reminder_type" "ApprovalReminderType" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_revisions_approval_request_id_revision_number_key"
ON "approval_revisions"("approval_request_id", "revision_number");

CREATE UNIQUE INDEX "approval_reviewers_token_key"
ON "approval_reviewers"("token");

CREATE UNIQUE INDEX "approval_reviewers_approval_request_id_email_key"
ON "approval_reviewers"("approval_request_id", "email");

CREATE UNIQUE INDEX "approval_review_decisions_approval_revision_id_reviewer_id_key"
ON "approval_review_decisions"("approval_revision_id", "reviewer_id");

CREATE UNIQUE INDEX "approval_reminders_approval_revision_id_reviewer_id_reminder_type_key"
ON "approval_reminders"("approval_revision_id", "reviewer_id", "reminder_type");

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
ADD CONSTRAINT "approval_requests_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_revisions"
ADD CONSTRAINT "approval_revisions_approval_request_id_fkey"
FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_revisions"
ADD CONSTRAINT "approval_revisions_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_assets"
ADD CONSTRAINT "approval_assets_approval_revision_id_fkey"
FOREIGN KEY ("approval_revision_id") REFERENCES "approval_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_reviewers"
ADD CONSTRAINT "approval_reviewers_approval_request_id_fkey"
FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_reviewers"
ADD CONSTRAINT "approval_reviewers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_review_decisions"
ADD CONSTRAINT "approval_review_decisions_approval_request_id_fkey"
FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_review_decisions"
ADD CONSTRAINT "approval_review_decisions_approval_revision_id_fkey"
FOREIGN KEY ("approval_revision_id") REFERENCES "approval_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_review_decisions"
ADD CONSTRAINT "approval_review_decisions_reviewer_id_fkey"
FOREIGN KEY ("reviewer_id") REFERENCES "approval_reviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_comments"
ADD CONSTRAINT "approval_comments_approval_request_id_fkey"
FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_comments"
ADD CONSTRAINT "approval_comments_approval_revision_id_fkey"
FOREIGN KEY ("approval_revision_id") REFERENCES "approval_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_comments"
ADD CONSTRAINT "approval_comments_reviewer_id_fkey"
FOREIGN KEY ("reviewer_id") REFERENCES "approval_reviewers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_comments"
ADD CONSTRAINT "approval_comments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_comments"
ADD CONSTRAINT "approval_comments_parent_comment_id_fkey"
FOREIGN KEY ("parent_comment_id") REFERENCES "approval_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_reminders"
ADD CONSTRAINT "approval_reminders_approval_revision_id_fkey"
FOREIGN KEY ("approval_revision_id") REFERENCES "approval_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_reminders"
ADD CONSTRAINT "approval_reminders_reviewer_id_fkey"
FOREIGN KEY ("reviewer_id") REFERENCES "approval_reviewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
