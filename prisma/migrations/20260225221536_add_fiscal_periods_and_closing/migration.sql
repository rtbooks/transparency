-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'CLOSING';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "fund_balance_account_id" TEXT;

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopened_by" TEXT,
    "closing_transaction_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fiscal_period_org_status" ON "fiscal_periods"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_organization_id_start_date_key" ON "fiscal_periods"("organization_id", "start_date");
