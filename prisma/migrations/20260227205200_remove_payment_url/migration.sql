-- AlterTable: Remove payment_url column from OrganizationPaymentMethod
-- Deep links are now generated dynamically from the handle field
ALTER TABLE "organization_payment_methods" DROP COLUMN IF EXISTS "payment_url";
