-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "deleted_at" TIMESTAMP(3);
