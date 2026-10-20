CREATE TABLE "ticket_inventory_reconciliations" (
  "id" TEXT NOT NULL,
  "ticket_type_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "snapshot_fingerprint" TEXT NOT NULL,
  "plan_fingerprint" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_inventory_reconciliations_pkey" PRIMARY KEY ("id")
);

-- Preserve historical evidence independently of account/type deletion.
CREATE INDEX "ticket_inventory_reconciliations_ticket_type_id_created_at_idx"
  ON "ticket_inventory_reconciliations"("ticket_type_id", "created_at");
