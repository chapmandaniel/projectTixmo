-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('MEDIA', 'SOCIAL');

-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "content" JSONB,
ADD COLUMN     "type" "ApprovalType" NOT NULL DEFAULT 'MEDIA';
