-- Bank Reconciliation Models
-- Adds BankStatement, BankStatementLine, and csvColumnMapping to BankAccount

-- Add CSV column mapping to BankAccount
ALTER TABLE "bank_accounts" ADD COLUMN "csv_column_mapping" JSONB;

-- Reconciliation status enum
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Match confidence enum
CREATE TYPE "MatchConfidence" AS ENUM ('AUTO_EXACT', 'AUTO_FUZZY', 'MANUAL', 'UNMATCHED');

-- Statement line status enum
CREATE TYPE "StatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'CONFIRMED', 'SKIPPED');

-- BankStatement table
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "statement_date" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "file_name" TEXT NOT NULL,
    "blob_url" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- BankStatementLine table
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "bank_statement_id" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "post_date" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "reference_number" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT,
    "matched_transaction_id" TEXT,
    "match_confidence" "MatchConfidence" NOT NULL DEFAULT 'UNMATCHED',
    "status" "StatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_statement_org_bank" ON "bank_statements"("organization_id", "bank_account_id");
CREATE INDEX "idx_statement_line_statement" ON "bank_statement_lines"("bank_statement_id");
CREATE INDEX "idx_statement_line_matched_txn" ON "bank_statement_lines"("matched_transaction_id");

-- Foreign keys
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
