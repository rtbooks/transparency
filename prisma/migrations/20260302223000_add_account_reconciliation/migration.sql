-- CreateEnum
CREATE TYPE "AccountReconciliationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "account_reconciliations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "beginning_balance" DECIMAL(12,2) NOT NULL,
    "ending_balance" DECIMAL(12,2) NOT NULL,
    "status" "AccountReconciliationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_items" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "cleared" BOOLEAN NOT NULL DEFAULT true,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_recon_org_account" ON "account_reconciliations"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_recon_account_period" ON "account_reconciliations"("account_id", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "uq_recon_item_txn" ON "reconciliation_items"("reconciliation_id", "transaction_id");

-- CreateIndex
CREATE INDEX "idx_recon_item_recon" ON "reconciliation_items"("reconciliation_id");

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "account_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
