-- AlterEnum
-- Additive only. PostgreSQL 12+ accepts ADD VALUE inside Prisma's migration
-- transaction, but the new label cannot be used until that transaction commits.
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
