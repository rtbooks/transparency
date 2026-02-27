-- AlterTable: add stripe fee configuration columns
ALTER TABLE "organization_payment_methods" ADD COLUMN "stripe_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 2.2;
ALTER TABLE "organization_payment_methods" ADD COLUMN "stripe_fee_fixed" DOUBLE PRECISION NOT NULL DEFAULT 0.30;
