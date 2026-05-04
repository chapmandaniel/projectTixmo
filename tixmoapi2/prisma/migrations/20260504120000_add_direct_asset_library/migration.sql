CREATE TABLE "asset_library_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_url" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_library_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_library_assets_organization_id_created_at_idx" ON "asset_library_assets"("organization_id", "created_at");
CREATE INDEX "asset_library_assets_event_id_idx" ON "asset_library_assets"("event_id");

ALTER TABLE "asset_library_assets"
ADD CONSTRAINT "asset_library_assets_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_assets"
ADD CONSTRAINT "asset_library_assets_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_library_assets"
ADD CONSTRAINT "asset_library_assets_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
