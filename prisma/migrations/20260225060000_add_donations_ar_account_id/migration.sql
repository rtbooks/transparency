-- Add donations_ar_account_id to organizations for configurable A/R account
ALTER TABLE "organizations" ADD COLUMN "donations_ar_account_id" TEXT;
