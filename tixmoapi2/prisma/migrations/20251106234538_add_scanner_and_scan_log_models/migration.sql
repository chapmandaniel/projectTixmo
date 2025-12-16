-- CreateEnum
CREATE TYPE "ScannerStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');

-- CreateTable
CREATE TABLE "scanners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_id" TEXT,
    "api_key" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT,
    "created_by" TEXT NOT NULL,
    "status" "ScannerStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scanners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_logs" (
    "id" TEXT NOT NULL,
    "scanner_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "scan_type" TEXT NOT NULL DEFAULT 'ENTRY',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scanners_api_key_key" ON "scanners"("api_key");

-- AddForeignKey
ALTER TABLE "scanners" ADD CONSTRAINT "scanners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanners" ADD CONSTRAINT "scanners_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_scanner_id_fkey" FOREIGN KEY ("scanner_id") REFERENCES "scanners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
