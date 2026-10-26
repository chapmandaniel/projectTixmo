-- One Stripe refund id per row. payment_intent_id may repeat.
-- stripe_refund_id stays unique. Existing rows are not rewritten.
DROP INDEX "payment_refunds_payment_intent_id_key";

CREATE INDEX "payment_refunds_payment_intent_id_idx" ON "payment_refunds"("payment_intent_id");
