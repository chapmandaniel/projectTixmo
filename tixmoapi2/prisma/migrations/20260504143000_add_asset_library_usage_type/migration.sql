ALTER TABLE "asset_library_assets"
ADD COLUMN "usage_type" TEXT NOT NULL DEFAULT 'BRAND';

UPDATE "asset_library_assets"
SET "usage_type" = 'EVENT'
WHERE "event_id" IS NOT NULL;

CREATE INDEX "asset_library_assets_organization_id_usage_type_idx"
ON "asset_library_assets"("organization_id", "usage_type");
