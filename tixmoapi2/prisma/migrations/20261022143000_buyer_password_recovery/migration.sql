CREATE TABLE "buyer_password_resets" (
  "user_id" TEXT NOT NULL PRIMARY KEY,
  "token_hash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "session_version" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "buyer_password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "buyer_password_resets_token_hash_key" ON "buyer_password_resets"("token_hash");
