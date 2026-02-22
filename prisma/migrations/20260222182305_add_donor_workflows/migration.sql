-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "DonorAccessMode" AS ENUM ('AUTO_APPROVE', 'REQUIRE_APPROVAL');

-- AlterTable: Add donor settings to organizations
ALTER TABLE "organizations"
ADD COLUMN "donor_access_mode" "DonorAccessMode" NOT NULL DEFAULT 'REQUIRE_APPROVAL',
ADD COLUMN "payment_instructions" TEXT;

-- AlterTable: Fix version_id types to match schema (TEXT)
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_pkey",
ALTER COLUMN "version_id" SET DATA TYPE TEXT,
ALTER COLUMN "previous_version_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("version_id");

ALTER TABLE "organization_users" DROP CONSTRAINT "organization_users_pkey",
ALTER COLUMN "version_id" SET DATA TYPE TEXT,
ALTER COLUMN "previous_version_id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "organization_users_pkey" PRIMARY KEY ("version_id");

ALTER TABLE "organizations" DROP CONSTRAINT "organizations_pkey",
ALTER COLUMN "version_id" SET DATA TYPE TEXT,
ALTER COLUMN "previous_version_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("version_id");

ALTER TABLE "planned_purchases" DROP CONSTRAINT "planned_purchases_pkey",
ALTER COLUMN "version_id" SET DATA TYPE TEXT,
ALTER COLUMN "previous_version_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "planned_purchases_pkey" PRIMARY KEY ("version_id");

ALTER TABLE "transactions" DROP CONSTRAINT "transactions_pkey",
ALTER COLUMN "version_id" SET DATA TYPE TEXT,
ALTER COLUMN "previous_version_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("version_id");

-- Recreate indexes that depend on changed column types
CREATE INDEX IF NOT EXISTS "idx_account_current" ON "accounts"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_account_valid_time" ON "accounts"("id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_contact_current" ON "contacts"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_contact_valid_time" ON "contacts"("id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_orguser_current" ON "organization_users"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_orguser_valid_time" ON "organization_users"("id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_org_current" ON "organizations"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_org_valid_time" ON "organizations"("id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_purchase_current" ON "planned_purchases"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_purchase_valid_time" ON "planned_purchases"("id", "valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_transaction_current" ON "transactions"("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_transaction_valid_time" ON "transactions"("id", "valid_from", "valid_to");

-- CreateTable: Access Requests
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_access_request_org_status" ON "access_requests"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_organization_id_user_id_key" ON "access_requests"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
