-- CreateEnum: DonationType
CREATE TYPE "DonationType" AS ENUM ('ONE_TIME', 'PLEDGE');

-- CreateEnum: DonationStatus
CREATE TYPE "DonationStatus" AS ENUM ('PLEDGED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateTable: donations
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "type" "DonationType" NOT NULL DEFAULT 'ONE_TIME',
    "status" "DonationStatus" NOT NULL DEFAULT 'PLEDGED',
    "amount" DECIMAL(12,2) NOT NULL,
    "amount_received" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "donor_message" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "is_tax_deductible" BOOLEAN NOT NULL DEFAULT true,
    "donation_date" TIMESTAMP(3) NOT NULL,
    "received_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "campaign_id" TEXT,
    "transaction_id" TEXT,
    "bill_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donations_transaction_id_key" ON "donations"("transaction_id");
CREATE UNIQUE INDEX "donations_bill_id_key" ON "donations"("bill_id");
CREATE INDEX "idx_donation_org_status" ON "donations"("organization_id", "status");
CREATE INDEX "idx_donation_org_campaign" ON "donations"("organization_id", "campaign_id");
CREATE INDEX "idx_donation_contact" ON "donations"("contact_id");
CREATE INDEX "idx_donation_bill" ON "donations"("bill_id");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Create Donation records from existing RECEIVABLE Bills
-- Maps Bill status → Donation status:
--   DRAFT/PENDING → PLEDGED
--   PARTIAL → PARTIAL
--   PAID → RECEIVED
--   OVERDUE → PLEDGED (still outstanding)
--   CANCELLED → CANCELLED
INSERT INTO "donations" (
    "id",
    "organization_id",
    "contact_id",
    "type",
    "status",
    "amount",
    "amount_received",
    "description",
    "donation_date",
    "due_date",
    "campaign_id",
    "transaction_id",
    "bill_id",
    "created_by",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    b."organization_id",
    b."contact_id",
    'PLEDGE'::"DonationType",
    CASE b."status"
        WHEN 'DRAFT' THEN 'PLEDGED'::"DonationStatus"
        WHEN 'PENDING' THEN 'PLEDGED'::"DonationStatus"
        WHEN 'PARTIAL' THEN 'PARTIAL'::"DonationStatus"
        WHEN 'PAID' THEN 'RECEIVED'::"DonationStatus"
        WHEN 'OVERDUE' THEN 'PLEDGED'::"DonationStatus"
        WHEN 'CANCELLED' THEN 'CANCELLED'::"DonationStatus"
        ELSE 'PLEDGED'::"DonationStatus"
    END,
    b."amount",
    b."amount_paid",
    b."description",
    b."issue_date",
    b."due_date",
    c."id",
    b."accrual_transaction_id",
    b."id",
    b."created_by",
    b."created_at",
    b."updated_at"
FROM "bills" b
LEFT JOIN LATERAL (
    -- Resolve campaign: bill → accrual transaction → creditAccountId → campaign
    SELECT cam."id"
    FROM "transactions" t
    JOIN "campaigns" cam ON cam."account_id" = t."credit_account_id"
        AND cam."organization_id" = b."organization_id"
    WHERE t."id" = b."accrual_transaction_id"
        AND t."valid_to" = '9999-12-31T23:59:59.999Z'
        AND t."system_to" = '9999-12-31T23:59:59.999Z'
        AND t."is_deleted" = false
    LIMIT 1
) c ON true
WHERE b."direction" = 'RECEIVABLE'
AND NOT EXISTS (
    SELECT 1 FROM "donations" d WHERE d."bill_id" = b."id"
);
