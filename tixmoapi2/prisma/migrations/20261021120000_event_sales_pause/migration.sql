-- SOURCE ONLY. Existing rows receive false; deployment review/execution separate.
ALTER TABLE "events" ADD COLUMN "sales_paused" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "event_sales_controls" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "before_paused" BOOLEAN NOT NULL,
  "after_paused" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_sales_controls_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_sales_controls_event_id_request_id_key" ON "event_sales_controls"("event_id", "request_id");
CREATE INDEX "event_sales_controls_event_id_created_at_idx" ON "event_sales_controls"("event_id", "created_at");
