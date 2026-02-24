-- Rename enums
ALTER TYPE "PurchaseStatus" RENAME TO "SpendingStatus";
ALTER TYPE "PurchasePriority" RENAME TO "SpendingPriority";

-- Drop old indexes on planned_purchases
DROP INDEX IF EXISTS "idx_purchase_current";
DROP INDEX IF EXISTS "idx_purchase_valid_time";
DROP INDEX IF EXISTS "idx_purchase_system_time";
DROP INDEX IF EXISTS "idx_purchase_deleted";

-- Remove columns no longer needed
ALTER TABLE "planned_purchases" DROP COLUMN IF EXISTS "category";
ALTER TABLE "planned_purchases" DROP COLUMN IF EXISTS "actual_transaction_id";
ALTER TABLE "planned_purchases" DROP COLUMN IF EXISTS "actual_amount";

-- Rename table
ALTER TABLE "planned_purchases" RENAME TO "program_spending";

-- Recreate indexes with new names
CREATE INDEX "idx_spending_current" ON "program_spending"("id", "valid_to");
CREATE INDEX "idx_spending_valid_time" ON "program_spending"("id", "valid_from", "valid_to");
CREATE INDEX "idx_spending_system_time" ON "program_spending"("system_from", "system_to");
CREATE INDEX "idx_spending_deleted" ON "program_spending"("is_deleted");

-- Drop PurchaseImage table
DROP TABLE IF EXISTS "purchase_images";

-- Create junction table for linking transactions
CREATE TABLE "program_spending_transactions" (
    "id" TEXT NOT NULL,
    "program_spending_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT,

    CONSTRAINT "program_spending_transactions_pkey" PRIMARY KEY ("id")
);

-- Create indexes on junction table
CREATE UNIQUE INDEX "program_spending_transactions_program_spending_id_transaction_key" ON "program_spending_transactions"("program_spending_id", "transaction_id");
CREATE INDEX "program_spending_transactions_program_spending_id_idx" ON "program_spending_transactions"("program_spending_id");
CREATE INDEX "program_spending_transactions_transaction_id_idx" ON "program_spending_transactions"("transaction_id");
