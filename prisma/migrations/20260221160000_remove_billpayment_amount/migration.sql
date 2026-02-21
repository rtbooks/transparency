-- Remove redundant amount from bill_payments
-- The payment amount is always derived from the linked transaction
ALTER TABLE "bill_payments" DROP COLUMN IF EXISTS "amount";
