CREATE TYPE "ApprovalReminderDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN');

ALTER TABLE "approval_reminders"
  ALTER COLUMN "sent_at" DROP NOT NULL,
  ADD COLUMN "status" "ApprovalReminderDeliveryStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN "lease_token" TEXT,
  ADD COLUMN "claimed_at" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" TIMESTAMP(3),
  ADD COLUMN "provider_message_id" TEXT,
  ADD COLUMN "last_error" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "approval_reminders" SET "created_at" = "sent_at", "updated_at" = "sent_at" WHERE "sent_at" IS NOT NULL;
CREATE INDEX "approval_reminders_status_claimed_at_idx" ON "approval_reminders"("status", "claimed_at");
