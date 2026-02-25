-- Many-to-many reconciliation matching
-- Allows one bank statement line to match multiple ledger transactions (split deposit)
-- and multiple bank statement lines to match one ledger transaction (combined entries)

-- Create the join table
CREATE TABLE "bank_statement_line_matches" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "confidence" "MatchConfidence" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_line_matches_pkey" PRIMARY KEY ("id")
);

-- Migrate existing matched data to the join table
INSERT INTO "bank_statement_line_matches" ("id", "line_id", "transaction_id", "amount", "confidence", "created_at")
SELECT
    gen_random_uuid()::text,
    "id",
    "matched_transaction_id",
    ABS("amount"),
    "match_confidence",
    "created_at"
FROM "bank_statement_lines"
WHERE "matched_transaction_id" IS NOT NULL;

-- Drop the old column and index
DROP INDEX IF EXISTS "idx_statement_line_matched_txn";
ALTER TABLE "bank_statement_lines" DROP COLUMN "matched_transaction_id";

-- Create indexes on the join table
CREATE INDEX "idx_line_match_line" ON "bank_statement_line_matches"("line_id");
CREATE INDEX "idx_line_match_txn" ON "bank_statement_line_matches"("transaction_id");

-- Add foreign key
ALTER TABLE "bank_statement_line_matches" ADD CONSTRAINT "bank_statement_line_matches_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "bank_statement_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
