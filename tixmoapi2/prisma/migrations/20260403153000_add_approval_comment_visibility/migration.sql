CREATE TYPE "ApprovalCommentVisibility" AS ENUM (
    'INTERNAL',
    'GLOBAL'
);

ALTER TABLE "approval_comments"
ADD COLUMN "visibility" "ApprovalCommentVisibility" NOT NULL DEFAULT 'GLOBAL';
