-- Signed webhook identity and fixture-runtime controls.
-- Dedup is the signed invoice id plus event type, not a replayed webhook uuid.

ALTER TABLE "vendor_webhook_inbox"
  ADD COLUMN "signed_invoice_id" TEXT,
  ADD COLUMN "event_type" TEXT,
  ADD COLUMN "payload_fingerprint" TEXT,
  ADD COLUMN "webhook_event_uuid" TEXT;

CREATE UNIQUE INDEX "vendor_webhook_inbox_provider_signed_invoice_id_event_type_key"
  ON "vendor_webhook_inbox"("provider", "signed_invoice_id", "event_type");

CREATE TABLE "vendor_fixture_runtime" (
  "id" TEXT NOT NULL,
  "revision" TEXT NOT NULL DEFAULT 'baseline',
  "revoked_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "shift_days" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_fixture_runtime_pkey" PRIMARY KEY ("id")
);
