-- Add accrual_transaction_id to bills table
ALTER TABLE "bills" ADD COLUMN "accrual_transaction_id" TEXT;

-- Add unique constraint (one bill per accrual transaction)
ALTER TABLE "bills" ADD CONSTRAINT "bills_accrual_transaction_id_key" UNIQUE ("accrual_transaction_id");

-- Add foreign key to transactions
ALTER TABLE "bills" ADD CONSTRAINT "bills_accrual_transaction_id_fkey"
  FOREIGN KEY ("accrual_transaction_id") REFERENCES "transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
