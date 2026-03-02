-- CreateEnum
CREATE TYPE "StripePaymentStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'DISPUTED');

-- CreateTable: stripe_payments
CREATE TABLE "stripe_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "stripe_payment_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "stripe_fee_amount" DECIMAL(12,2),
    "status" "StripePaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "transaction_id" TEXT NOT NULL,
    "donation_id" TEXT,
    "bill_payment_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for stripe_payments
CREATE UNIQUE INDEX "stripe_payments_stripe_session_id_key" ON "stripe_payments"("stripe_session_id");
CREATE INDEX "idx_stripe_payment_org" ON "stripe_payments"("organization_id");
CREATE INDEX "idx_stripe_payment_transaction" ON "stripe_payments"("transaction_id");
CREATE INDEX "idx_stripe_payment_donation" ON "stripe_payments"("donation_id");
CREATE INDEX "idx_stripe_payment_bill_payment" ON "stripe_payments"("bill_payment_id");

-- AddColumn: payment_method to bill_payments
ALTER TABLE "bill_payments" ADD COLUMN "payment_method" "PaymentMethod";

-- AddColumn: payment_method to donations
ALTER TABLE "donations" ADD COLUMN "payment_method" "PaymentMethod";

-- DataMigration: Create StripePayment records from existing transactions with stripe_session_id
INSERT INTO "stripe_payments" ("id", "organization_id", "stripe_session_id", "stripe_payment_id", "amount", "status", "transaction_id", "donation_id", "bill_payment_id", "created_at")
SELECT
    gen_random_uuid(),
    t."organization_id",
    t."stripe_session_id",
    t."stripe_payment_id",
    t."amount",
    'COMPLETED'::"StripePaymentStatus",
    t."id",
    d."id",
    bp."id",
    t."created_at"
FROM "transactions" t
LEFT JOIN "donations" d ON d."transaction_id" = t."id"
LEFT JOIN "bill_payments" bp ON bp."transaction_id" = t."id"
WHERE t."stripe_session_id" IS NOT NULL
  AND t."valid_to" = '9999-12-31T23:59:59.999Z';

-- DataMigration: Copy paymentMethod from Transaction to BillPayment where linked
UPDATE "bill_payments" bp
SET "payment_method" = t."payment_method"
FROM "transactions" t
WHERE bp."transaction_id" = t."id"
  AND t."valid_to" = '9999-12-31T23:59:59.999Z'
  AND t."payment_method" IS NOT NULL;

-- DataMigration: Copy paymentMethod from Transaction to Donation for one-time donations
UPDATE "donations" d
SET "payment_method" = t."payment_method"
FROM "transactions" t
WHERE d."transaction_id" = t."id"
  AND t."valid_to" = '9999-12-31T23:59:59.999Z'
  AND t."payment_method" IS NOT NULL
  AND d."type" = 'ONE_TIME';

-- AlterColumn: Make payment_method nullable on transactions
ALTER TABLE "transactions" ALTER COLUMN "payment_method" DROP NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "payment_method" DROP DEFAULT;

-- DropColumns: Remove stripe fields from transactions
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "stripe_session_id";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "stripe_payment_id";
