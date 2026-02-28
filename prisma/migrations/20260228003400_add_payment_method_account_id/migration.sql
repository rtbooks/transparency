-- AlterTable: Add account_id to OrganizationPaymentMethod
-- Links each payment method to a specific accounting (asset) account
-- e.g. Stripe → "Stripe Clearing" account for proper double-entry
ALTER TABLE "organization_payment_methods" ADD COLUMN "account_id" TEXT;
