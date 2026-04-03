CREATE TYPE "ApprovalReviewerAssociation" AS ENUM (
    'ARTIST',
    'AGENT',
    'MANAGEMENT',
    'OTHER'
);

ALTER TABLE "approval_reviewers"
ADD COLUMN "association" "ApprovalReviewerAssociation";
