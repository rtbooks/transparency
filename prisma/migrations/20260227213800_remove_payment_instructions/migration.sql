-- AlterTable: Remove payment_instructions column from organizations
-- Payment methods are now managed via the OrganizationPaymentMethod table
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "payment_instructions";
