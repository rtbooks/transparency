-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH_APP';
ALTER TYPE "PaymentMethod" ADD VALUE 'ZELLE';

-- CreateTable
CREATE TABLE "organization_payment_methods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "PaymentMethod" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "instructions" TEXT,
    "stripe_account_id" TEXT,
    "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "handle" TEXT,
    "payment_url" TEXT,
    "payable_to" TEXT,
    "mailing_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_org_payment_method_enabled" ON "organization_payment_methods"("organization_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "organization_payment_methods_organization_id_type_key" ON "organization_payment_methods"("organization_id", "type");
