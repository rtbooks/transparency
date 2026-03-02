-- Remove deprecated fields from transactions table
-- These fields are unused: donor info lives on Contact/Donation models, receiptUrl is never set

-- Drop the foreign key constraint first
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_donor_user_id_fkey";

-- Drop the columns
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "donor_user_id";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "donor_name";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "is_anonymous";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receipt_url";
