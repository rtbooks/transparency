-- DropIndex
DROP INDEX "campaigns_organization_id_account_id_key";

-- AlterTable
ALTER TABLE "program_spending" RENAME CONSTRAINT "planned_purchases_pkey" TO "program_spending_pkey";

-- RenameIndex
ALTER INDEX "planned_purchases_id_valid_from_key" RENAME TO "program_spending_id_valid_from_key";

-- RenameIndex
ALTER INDEX "program_spending_transactions_program_spending_id_transaction_k" RENAME TO "program_spending_transactions_program_spending_id_transacti_key";
