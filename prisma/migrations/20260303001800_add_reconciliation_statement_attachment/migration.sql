-- Add bank statement attachment fields to account_reconciliations
ALTER TABLE "account_reconciliations" ADD COLUMN "statement_blob_url" TEXT;
ALTER TABLE "account_reconciliations" ADD COLUMN "statement_file_name" TEXT;
