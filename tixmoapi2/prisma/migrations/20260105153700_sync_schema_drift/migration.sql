-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'OWNER';
ALTER TYPE "UserRole" ADD VALUE 'TEAM_MEMBER';

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_venue_id_fkey";

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "venue_id" DROP NOT NULL,
ALTER COLUMN "start_datetime" DROP NOT NULL,
ALTER COLUMN "end_datetime" DROP NOT NULL,
ALTER COLUMN "capacity" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
