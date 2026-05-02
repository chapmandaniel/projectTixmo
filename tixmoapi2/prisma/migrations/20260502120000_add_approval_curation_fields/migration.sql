ALTER TABLE "approval_requests"
ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "approval_assets"
ADD COLUMN "approved_for_library_at" TIMESTAMP(3),
ADD COLUMN "approved_for_library_by_id" TEXT;

ALTER TABLE "approval_assets"
ADD CONSTRAINT "approval_assets_approved_for_library_by_id_fkey"
FOREIGN KEY ("approved_for_library_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
