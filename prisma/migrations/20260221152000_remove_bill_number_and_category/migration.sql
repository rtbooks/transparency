-- Remove billNumber and category columns from bills table
ALTER TABLE "bills" DROP COLUMN IF EXISTS "bill_number";
ALTER TABLE "bills" DROP COLUMN IF EXISTS "category";
