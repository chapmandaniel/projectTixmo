CREATE TABLE "asset_library_folder_shares" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "recipient_label" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_library_folder_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_library_folder_shares_token_hash_key" ON "asset_library_folder_shares"("token_hash");
CREATE INDEX "asset_library_folder_shares_folder_id_revoked_at_expires_at_idx" ON "asset_library_folder_shares"("folder_id", "revoked_at", "expires_at");
CREATE INDEX "asset_library_folder_shares_organization_id_created_at_idx" ON "asset_library_folder_shares"("organization_id", "created_at");

ALTER TABLE "asset_library_folder_shares"
ADD CONSTRAINT "asset_library_folder_shares_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_folder_shares"
ADD CONSTRAINT "asset_library_folder_shares_folder_id_fkey"
FOREIGN KEY ("folder_id") REFERENCES "asset_library_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_folder_shares"
ADD CONSTRAINT "asset_library_folder_shares_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
