CREATE TABLE "asset_library_folders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "event_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "usage_type" TEXT NOT NULL DEFAULT 'BRAND',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_library_folders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_library_assets"
ADD COLUMN "folder_id" TEXT;

CREATE INDEX "asset_library_folders_organization_id_parent_id_idx" ON "asset_library_folders"("organization_id", "parent_id");
CREATE INDEX "asset_library_folders_event_id_idx" ON "asset_library_folders"("event_id");
CREATE INDEX "asset_library_assets_folder_id_idx" ON "asset_library_assets"("folder_id");

ALTER TABLE "asset_library_folders"
ADD CONSTRAINT "asset_library_folders_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_folders"
ADD CONSTRAINT "asset_library_folders_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "asset_library_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_folders"
ADD CONSTRAINT "asset_library_folders_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_library_folders"
ADD CONSTRAINT "asset_library_folders_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_library_assets"
ADD CONSTRAINT "asset_library_assets_folder_id_fkey"
FOREIGN KEY ("folder_id") REFERENCES "asset_library_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
