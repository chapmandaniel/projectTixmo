-- Additive. One stored POST /orders response per buyer and Idempotency-Key.
-- Existing orders are unchanged. A missing header does not write a row.
CREATE TABLE "order_idempotency_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "request_hash" TEXT NOT NULL,
  "order_id" TEXT,
  "response_status" INTEGER,
  "response_body" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_idempotency_user_key" ON "order_idempotency_keys"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "order_idempotency_keys_order_id_key" ON "order_idempotency_keys"("order_id");

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
