ALTER TABLE "users" ADD COLUMN "disabled_at" TIMESTAMP(3),
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- Existing unscoped administrators require an explicit operator review/grant.
-- Do not infer platform identity from possibly orphaned membership.

-- Keep historical anonymized accounts disabled after the upgrade.
UPDATE "users" SET "disabled_at" = CURRENT_TIMESTAMP, "role" = 'CUSTOMER',
  "organization_id" = NULL, "session_version" = 1
WHERE "email" LIKE 'deleted\_%@deleted.com' ESCAPE '\';

-- Disable legacy bootstrap identities until an operator explicitly rotates their credentials.
-- Removing the seed command alone cannot revoke an already stored default password.
UPDATE "users" SET "disabled_at" = CURRENT_TIMESTAMP,
  "session_version" = "session_version" + 1, "is_platform_admin" = false
WHERE "role" = 'ADMIN' AND lower("email") IN ('admin@tixmo.com');

CREATE TABLE "staff_invitations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "issuer_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "session_version" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_invitations_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_invitations_token_hash_key" ON "staff_invitations"("token_hash");
CREATE INDEX "staff_invitations_user_id_idx" ON "staff_invitations"("user_id");
