-- Expand-only. Existing events default to CAD because organizations do not store a currency.
ALTER TABLE "events" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CAD';

-- Dedupe is per Showpass connection, not global across organizations.
ALTER TABLE "vendor_webhook_inbox" ADD COLUMN "connection_id" TEXT;

DROP INDEX IF EXISTS "vendor_webhook_inbox_provider_signed_invoice_id_event_type_key";

CREATE UNIQUE INDEX "vendor_webhook_inbox_connection_id_signed_invoice_id_event_type_key"
  ON "vendor_webhook_inbox"("connection_id", "signed_invoice_id", "event_type");

ALTER TABLE "vendor_webhook_inbox" ADD COLUMN "count_deltas" JSONB;

ALTER TABLE "vendor_connections" ADD COLUMN "webhook_route_token" TEXT;
UPDATE "vendor_connections"
  SET "webhook_route_token" = gen_random_uuid()::text
  WHERE "webhook_route_token" IS NULL;
ALTER TABLE "vendor_connections" ALTER COLUMN "webhook_route_token" SET NOT NULL;
CREATE UNIQUE INDEX "vendor_connections_webhook_route_token_key"
  ON "vendor_connections"("webhook_route_token");
