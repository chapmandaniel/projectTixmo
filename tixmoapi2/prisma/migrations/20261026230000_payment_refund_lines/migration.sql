-- One Stripe refund id per line. payment_refunds.payment_intent_id stays
-- unique so the previous image can still upsert and findUnique that row.
-- Existing payment_refunds rows are not rewritten.

CREATE TABLE "payment_refund_lines" (
    "id" TEXT NOT NULL,
    "payment_refund_id" TEXT,
    "order_id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "stripe_refund_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'ORDER_REFUND',
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refund_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_refund_lines_stripe_refund_id_key" ON "payment_refund_lines"("stripe_refund_id");

CREATE INDEX "payment_refund_lines_payment_intent_id_idx" ON "payment_refund_lines"("payment_intent_id");

CREATE INDEX "payment_refund_lines_order_id_idx" ON "payment_refund_lines"("order_id");

ALTER TABLE "payment_refund_lines" ADD CONSTRAINT "payment_refund_lines_payment_refund_id_fkey" FOREIGN KEY ("payment_refund_id") REFERENCES "payment_refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
