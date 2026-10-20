-- CreateEnum
CREATE TYPE "TicketInventoryState" AS ENUM ('HELD', 'SOLD', 'RELEASED', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "scan_logs" DROP CONSTRAINT "scan_logs_ticket_id_fkey";

-- AlterTable
ALTER TABLE "ticket_tiers" ADD COLUMN     "quantity_held" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ticket_types" ADD COLUMN "tier_inventory_status" TEXT NOT NULL DEFAULT 'READY';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN     "promo_reservation" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "receipt_sent_at" TIMESTAMP(3),
ADD COLUMN     "receipt_status" TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
ADD COLUMN     "receipt_lease_token" TEXT,
ADD COLUMN     "receipt_started_at" TIMESTAMP(3),
ADD COLUMN     "payment_closed_at" TIMESTAMP(3),
ADD COLUMN     "refund_status" TEXT NOT NULL DEFAULT 'NONE';

-- Historical receipt delivery is unknown. Do not send the whole historical
-- paid-order population again when the recovery worker starts.
ALTER TABLE orders ALTER COLUMN receipt_status SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "payment_webhook_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lease_token" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "inventory_state" "TicketInventoryState" NOT NULL DEFAULT 'HELD',
ADD COLUMN     "tier_id" TEXT;

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "uses_held" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "scan_logs" ALTER COLUMN "ticket_id" DROP NOT NULL,
ALTER COLUMN "event_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "stripe_refund_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_order_id_key" ON "payment_attempts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_payment_intent_id_key" ON "payment_attempts"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_payment_intent_id_key" ON "payment_refunds"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_stripe_refund_id_key" ON "payment_refunds"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "payment_refunds_status_updated_at_idx" ON "payment_refunds"("status", "updated_at");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticket_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep historical accounting; cancelled paid tickets on cancelled events are ambiguous.
UPDATE tickets t SET inventory_state = CASE
 WHEN o.status = 'PENDING' THEN 'HELD'::"TicketInventoryState"
 WHEN o.status IN ('CANCELLED', 'REFUNDED') THEN 'RELEASED'::"TicketInventoryState"
 WHEN t.status = 'CANCELLED' AND e.status = 'CANCELLED' THEN 'UNKNOWN'::"TicketInventoryState"
 WHEN t.status = 'CANCELLED' THEN 'RELEASED'::"TicketInventoryState"
 WHEN o.status = 'PAID' THEN 'SOLD'::"TicketInventoryState"
 ELSE 'UNKNOWN'::"TicketInventoryState" END
FROM orders o, events e WHERE t.order_id = o.id AND t.event_id = e.id;

-- Baseline transfer did not revoke the sender's saved credential. Reissue all
-- historical transfers, invalidate cached QR images, and publish a sync delta.
UPDATE tickets SET barcode = 'TIX-' || upper(replace(gen_random_uuid()::text, '-', '')),
  qr_code_url = NULL, updated_at = now(),
  status = CASE WHEN status = 'TRANSFERRED' THEN 'VALID'::"TicketStatus" ELSE status END
WHERE transferred_at IS NOT NULL OR status = 'TRANSFERRED';

-- Only attribute historical tickets when exactly one existing tier matches
-- the stored price and sale window. Otherwise hold the schedule for explicit
-- reconciliation; a zero counter must never reopen previously allocated stock.
WITH candidates AS (
  SELECT t.id, min(tt.id) AS tier_id
  FROM tickets t JOIN ticket_tiers tt ON tt.ticket_type_id = t.ticket_type_id
  WHERE t.inventory_state IN ('HELD', 'SOLD') AND t.price_paid = tt.price
    AND t.created_at >= tt.created_at
    AND (tt.starts_at IS NULL OR t.created_at >= tt.starts_at)
    AND (tt.ends_at IS NULL OR t.created_at < tt.ends_at)
  GROUP BY t.id HAVING count(*) = 1
)
UPDATE tickets t SET tier_id = c.tier_id FROM candidates c WHERE t.id = c.id;

UPDATE ticket_types ty SET tier_inventory_status = 'REQUIRES_RECONCILIATION'
WHERE EXISTS (SELECT 1 FROM ticket_tiers tt WHERE tt.ticket_type_id = ty.id)
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.ticket_type_id = ty.id
    AND (t.inventory_state = 'UNKNOWN' OR (t.inventory_state IN ('HELD', 'SOLD') AND t.tier_id IS NULL)));

WITH counts AS (
  SELECT tt.id, count(t.id) FILTER (WHERE t.inventory_state = 'HELD')::int AS held,
    count(t.id) FILTER (WHERE t.inventory_state = 'SOLD')::int AS sold
  FROM ticket_tiers tt LEFT JOIN tickets t ON t.tier_id = tt.id GROUP BY tt.id
)
UPDATE ticket_tiers tt SET quantity_held = c.held,
  quantity_sold = greatest(tt.quantity_sold, c.sold) FROM counts c WHERE tt.id = c.id;

-- Inconsistent pre-existing tier counters also need an operator decision.
UPDATE ticket_types ty SET tier_inventory_status = 'REQUIRES_RECONCILIATION'
WHERE EXISTS (SELECT 1 FROM ticket_tiers tt WHERE tt.ticket_type_id = ty.id AND (
  tt.quantity_sold <> (SELECT count(*) FROM tickets t WHERE t.tier_id = tt.id AND t.inventory_state = 'SOLD')
  OR (tt.quantity_limit IS NOT NULL AND tt.quantity_sold + tt.quantity_held > tt.quantity_limit)));
-- Old pending carts already consumed uses_count. Treat that as historical usage,
-- rather than inventing held reservations or subtracting a completed purchase.
UPDATE orders SET promo_reservation = 'USED' WHERE promo_code_id IS NOT NULL;


INSERT INTO payment_attempts (id, order_id, amount, currency, payment_intent_id, updated_at)
SELECT gen_random_uuid()::text, id, round(total_amount * 100)::int, currency, payment_intent_id, now()
FROM orders WHERE payment_intent_id IS NOT NULL;
