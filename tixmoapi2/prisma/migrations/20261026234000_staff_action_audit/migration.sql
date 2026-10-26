-- Staff revoke, event edit, cancel, and status evidence.
-- Sequenced after 20261026180000_payment_status_refunded (#36) and
-- 20261026230000_payment_refund_per_stripe_refund. The dispute PR adds no migration.
CREATE TABLE "staff_action_audits" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_action_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_action_audits_organization_id_created_at_idx"
  ON "staff_action_audits"("organization_id", "created_at");

CREATE INDEX "staff_action_audits_subject_type_subject_id_created_at_idx"
  ON "staff_action_audits"("subject_type", "subject_id", "created_at");
