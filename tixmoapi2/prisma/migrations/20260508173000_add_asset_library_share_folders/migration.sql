CREATE TABLE "asset_library_folder_share_folders" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_library_folder_share_folders_pkey" PRIMARY KEY ("id")
);

INSERT INTO "asset_library_folder_share_folders" ("id", "share_id", "folder_id")
SELECT md5(random()::TEXT || clock_timestamp()::TEXT || "id"), "id", "folder_id"
FROM "asset_library_folder_shares";

CREATE UNIQUE INDEX "asset_library_folder_share_folders_share_id_folder_id_key"
ON "asset_library_folder_share_folders"("share_id", "folder_id");

CREATE INDEX "asset_library_folder_share_folders_folder_id_idx"
ON "asset_library_folder_share_folders"("folder_id");

ALTER TABLE "asset_library_folder_share_folders"
ADD CONSTRAINT "asset_library_folder_share_folders_share_id_fkey"
FOREIGN KEY ("share_id") REFERENCES "asset_library_folder_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_library_folder_share_folders"
ADD CONSTRAINT "asset_library_folder_share_folders_folder_id_fkey"
FOREIGN KEY ("folder_id") REFERENCES "asset_library_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
