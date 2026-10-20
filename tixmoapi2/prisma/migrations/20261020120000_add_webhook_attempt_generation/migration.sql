-- Retain legacy rows and timestamps; admission will increment this under CAS.
ALTER TABLE "payment_webhook_events" ADD COLUMN "attempt_generation" BIGINT NOT NULL DEFAULT 0;
