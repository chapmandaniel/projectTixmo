CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payment_intent_id" TEXT,
    "order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error_message" TEXT,
    "processing_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_webhook_events_payment_intent_id_idx" ON "payment_webhook_events"("payment_intent_id");
CREATE INDEX "payment_webhook_events_order_id_idx" ON "payment_webhook_events"("order_id");
