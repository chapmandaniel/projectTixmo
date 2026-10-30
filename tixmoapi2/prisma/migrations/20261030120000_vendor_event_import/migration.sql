-- Vendor event import: external ticketing mode, optional task event, Showpass connection.

CREATE TYPE "TicketingMode" AS ENUM ('TIXMO', 'EXTERNAL');
CREATE TYPE "VendorProvider" AS ENUM ('SHOWPASS');
CREATE TYPE "VendorConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'REVOKED');
CREATE TYPE "VendorWebhookStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "VendorSoldCountSource" AS ENUM ('WEBHOOK', 'SYNC');

ALTER TABLE "events"
  ADD COLUMN "ticketing_mode" "TicketingMode" NOT NULL DEFAULT 'TIXMO',
  ADD COLUMN "external_purchase_url" TEXT;

ALTER TABLE "tasks"
  ADD COLUMN "event_id" TEXT;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_organization_id_event_id_idx" ON "tasks"("organization_id", "event_id");

CREATE TABLE "vendor_connections" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "provider" "VendorProvider" NOT NULL,
  "status" "VendorConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "key_ciphertext" TEXT NOT NULL,
  "key_last4" TEXT NOT NULL,
  "webhook_secret_ciphertext" TEXT,
  "last_sync_at" TIMESTAMP(3),
  "last_error" TEXT,
  "last_error_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_connections_organization_id_provider_key"
  ON "vendor_connections"("organization_id", "provider");

ALTER TABLE "vendor_connections"
  ADD CONSTRAINT "vendor_connections_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_festival_configs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "provider" "VendorProvider" NOT NULL,
  "vendor_venue_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "timezone" TEXT,
  "sync_interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "next_sync_at" TIMESTAMP(3),
  "ticket_type_mappings" JSONB NOT NULL DEFAULT '[]',
  "vendor_owned_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sync_lease_token" TEXT,
  "sync_started_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_festival_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_festival_configs_organization_id_provider_vendor_venue_id_key"
  ON "vendor_festival_configs"("organization_id", "provider", "vendor_venue_id");

ALTER TABLE "vendor_festival_configs"
  ADD CONSTRAINT "vendor_festival_configs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendor_festival_configs"
  ADD CONSTRAINT "vendor_festival_configs_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "vendor_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_event_links" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "provider" "VendorProvider" NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_item_id" TEXT NOT NULL,
  "external_slug" TEXT NOT NULL,
  "content_fingerprint" TEXT NOT NULL,
  "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_event_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_event_links_event_id_key" ON "vendor_event_links"("event_id");
CREATE UNIQUE INDEX "vendor_event_links_organization_id_provider_external_item_id_key"
  ON "vendor_event_links"("organization_id", "provider", "external_item_id");
CREATE INDEX "vendor_event_links_external_item_id_idx" ON "vendor_event_links"("external_item_id");

ALTER TABLE "vendor_event_links"
  ADD CONSTRAINT "vendor_event_links_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_sold_count_snapshots" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "provider" "VendorProvider" NOT NULL,
  "external_item_id" TEXT NOT NULL,
  "external_ticket_type_id" TEXT NOT NULL,
  "sold_count" INTEGER NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "VendorSoldCountSource" NOT NULL,
  CONSTRAINT "vendor_sold_count_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_sold_count_snapshots_event_id_external_ticket_type_id_key"
  ON "vendor_sold_count_snapshots"("event_id", "external_ticket_type_id");
CREATE INDEX "vendor_sold_count_snapshots_organization_id_external_item_id_idx"
  ON "vendor_sold_count_snapshots"("organization_id", "external_item_id");

ALTER TABLE "vendor_sold_count_snapshots"
  ADD CONSTRAINT "vendor_sold_count_snapshots_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vendor_webhook_inbox" (
  "id" TEXT NOT NULL,
  "provider" "VendorProvider" NOT NULL,
  "organization_id" TEXT,
  "status" "VendorWebhookStatus" NOT NULL DEFAULT 'PROCESSING',
  "lease_token" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "processing_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_webhook_inbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_webhook_inbox_status_processing_started_at_idx"
  ON "vendor_webhook_inbox"("status", "processing_started_at");
