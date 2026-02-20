-- Add Temporal Versioning and Void Support to Transactions
-- This migration adds bi-temporal versioning fields and void tracking to the Transaction model

-- ============================================
-- TRANSACTIONS: Add temporal fields
-- ============================================

-- Add temporal columns
ALTER TABLE "transactions" ADD COLUMN "version_id" UUID;
ALTER TABLE "transactions" ADD COLUMN "previous_version_id" UUID;
ALTER TABLE "transactions" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transactions" ADD COLUMN "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "transactions" ADD COLUMN "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transactions" ADD COLUMN "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "transactions" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "transactions" ADD COLUMN "changed_by" TEXT;

-- Add void-specific columns
ALTER TABLE "transactions" ADD COLUMN "is_voided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "voided_by" TEXT;
ALTER TABLE "transactions" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "transactions" ADD COLUMN "change_reason" TEXT;

-- Backfill existing transactions with initial version data
UPDATE "transactions"
SET
  "version_id" = gen_random_uuid(),
  "valid_from" = "created_at",
  "system_from" = "created_at"
WHERE "version_id" IS NULL;

-- Make version_id required and unique
ALTER TABLE "transactions" ALTER COLUMN "version_id" SET NOT NULL;
CREATE UNIQUE INDEX "transactions_version_id_key" ON "transactions"("version_id");

-- Create temporal indexes
CREATE INDEX "idx_transaction_current" ON "transactions"("id", "valid_to");
CREATE INDEX "idx_transaction_valid_time" ON "transactions"("id", "valid_from", "valid_to");
CREATE INDEX "idx_transaction_system_time" ON "transactions"("system_from", "system_to");
CREATE INDEX "idx_transaction_voided" ON "transactions"("is_voided");
CREATE INDEX "idx_transaction_deleted" ON "transactions"("is_deleted");

-- Add constraints
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transaction_valid_time" CHECK ("valid_from" < "valid_to");
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transaction_system_time" CHECK ("system_from" < "system_to");
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transaction_deleted"
  CHECK (("is_deleted" = true AND "deleted_at" IS NOT NULL) OR ("is_deleted" = false AND "deleted_at" IS NULL));
ALTER TABLE "transactions" ADD CONSTRAINT "chk_transaction_voided"
  CHECK (("is_voided" = true AND "voided_at" IS NOT NULL) OR ("is_voided" = false AND "voided_at" IS NULL));
