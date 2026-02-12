-- Add Temporal Versioning to Financial Entities
-- This migration adds bi-temporal versioning fields to Organization, Account, OrganizationUser, and PlannedPurchase

-- ============================================
-- ORGANIZATIONS: Add temporal fields
-- ============================================

-- Add temporal columns
ALTER TABLE "organizations" ADD COLUMN "version_id" UUID;
ALTER TABLE "organizations" ADD COLUMN "previous_version_id" UUID;
ALTER TABLE "organizations" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "organizations" ADD COLUMN "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "organizations" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "organizations" ADD COLUMN "changed_by" TEXT;

-- Backfill with initial versions
UPDATE "organizations" 
SET 
  "version_id" = gen_random_uuid(),
  "valid_from" = "created_at",
  "system_from" = "created_at"
WHERE "version_id" IS NULL;

-- Make version_id required and unique
ALTER TABLE "organizations" ALTER COLUMN "version_id" SET NOT NULL;
CREATE UNIQUE INDEX "organizations_version_id_key" ON "organizations"("version_id");

-- Create temporal indexes
CREATE INDEX "idx_org_current" ON "organizations"("id", "valid_to");
CREATE INDEX "idx_org_valid_time" ON "organizations"("id", "valid_from", "valid_to");
CREATE INDEX "idx_org_system_time" ON "organizations"("system_from", "system_to");
CREATE INDEX "idx_org_deleted" ON "organizations"("is_deleted");

-- Add constraints
ALTER TABLE "organizations" ADD CONSTRAINT "chk_org_valid_time" CHECK ("valid_from" < "valid_to");
ALTER TABLE "organizations" ADD CONSTRAINT "chk_org_system_time" CHECK ("system_from" < "system_to");
ALTER TABLE "organizations" ADD CONSTRAINT "chk_org_deleted" 
  CHECK (("is_deleted" = true AND "deleted_at" IS NOT NULL) OR ("is_deleted" = false AND "deleted_at" IS NULL));

-- ============================================
-- ACCOUNTS: Add temporal fields
-- ============================================

-- Add temporal columns
ALTER TABLE "accounts" ADD COLUMN "version_id" UUID;
ALTER TABLE "accounts" ADD COLUMN "previous_version_id" UUID;
ALTER TABLE "accounts" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "accounts" ADD COLUMN "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "accounts" ADD COLUMN "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "accounts" ADD COLUMN "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "accounts" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "accounts" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "accounts" ADD COLUMN "changed_by" TEXT;

-- Backfill with initial versions
UPDATE "accounts" 
SET 
  "version_id" = gen_random_uuid(),
  "valid_from" = "created_at",
  "system_from" = "created_at"
WHERE "version_id" IS NULL;

-- Make version_id required and unique
ALTER TABLE "accounts" ALTER COLUMN "version_id" SET NOT NULL;
CREATE UNIQUE INDEX "accounts_version_id_key" ON "accounts"("version_id");

-- Create temporal indexes
CREATE INDEX "idx_account_current" ON "accounts"("id", "valid_to");
CREATE INDEX "idx_account_valid_time" ON "accounts"("id", "valid_from", "valid_to");
CREATE INDEX "idx_account_system_time" ON "accounts"("system_from", "system_to");
CREATE INDEX "idx_account_deleted" ON "accounts"("is_deleted");

-- Add constraints
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_valid_time" CHECK ("valid_from" < "valid_to");
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_system_time" CHECK ("system_from" < "system_to");
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_deleted" 
  CHECK (("is_deleted" = true AND "deleted_at" IS NOT NULL) OR ("is_deleted" = false AND "deleted_at" IS NULL));

-- ============================================
-- ORGANIZATION_USERS: Add temporal fields
-- ============================================

-- Add temporal columns
ALTER TABLE "organization_users" ADD COLUMN "version_id" UUID;
ALTER TABLE "organization_users" ADD COLUMN "previous_version_id" UUID;
ALTER TABLE "organization_users" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_users" ADD COLUMN "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "organization_users" ADD COLUMN "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_users" ADD COLUMN "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "organization_users" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization_users" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "organization_users" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "organization_users" ADD COLUMN "changed_by" TEXT;
ALTER TABLE "organization_users" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill with initial versions
UPDATE "organization_users" 
SET 
  "version_id" = gen_random_uuid(),
  "valid_from" = "joined_at",
  "system_from" = "joined_at",
  "created_at" = "joined_at",
  "updated_at" = "joined_at"
WHERE "version_id" IS NULL;

-- Make version_id required and unique
ALTER TABLE "organization_users" ALTER COLUMN "version_id" SET NOT NULL;
CREATE UNIQUE INDEX "organization_users_version_id_key" ON "organization_users"("version_id");

-- Create temporal indexes
CREATE INDEX "idx_orguser_current" ON "organization_users"("id", "valid_to");
CREATE INDEX "idx_orguser_valid_time" ON "organization_users"("id", "valid_from", "valid_to");
CREATE INDEX "idx_orguser_system_time" ON "organization_users"("system_from", "system_to");
CREATE INDEX "idx_orguser_deleted" ON "organization_users"("is_deleted");

-- Add constraints
ALTER TABLE "organization_users" ADD CONSTRAINT "chk_orguser_valid_time" CHECK ("valid_from" < "valid_to");
ALTER TABLE "organization_users" ADD CONSTRAINT "chk_orguser_system_time" CHECK ("system_from" < "system_to");
ALTER TABLE "organization_users" ADD CONSTRAINT "chk_orguser_deleted" 
  CHECK (("is_deleted" = true AND "deleted_at" IS NOT NULL) OR ("is_deleted" = false AND "deleted_at" IS NULL));

-- ============================================
-- PLANNED_PURCHASES: Add temporal fields
-- ============================================

-- Add temporal columns
ALTER TABLE "planned_purchases" ADD COLUMN "version_id" UUID;
ALTER TABLE "planned_purchases" ADD COLUMN "previous_version_id" UUID;
ALTER TABLE "planned_purchases" ADD COLUMN "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "planned_purchases" ADD COLUMN "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "planned_purchases" ADD COLUMN "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "planned_purchases" ADD COLUMN "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp;
ALTER TABLE "planned_purchases" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "planned_purchases" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "planned_purchases" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "planned_purchases" ADD COLUMN "changed_by" TEXT;

-- Backfill with initial versions
UPDATE "planned_purchases" 
SET 
  "version_id" = gen_random_uuid(),
  "valid_from" = "created_at",
  "system_from" = "created_at"
WHERE "version_id" IS NULL;

-- Make version_id required and unique
ALTER TABLE "planned_purchases" ALTER COLUMN "version_id" SET NOT NULL;
CREATE UNIQUE INDEX "planned_purchases_version_id_key" ON "planned_purchases"("version_id");

-- Create temporal indexes
CREATE INDEX "idx_purchase_current" ON "planned_purchases"("id", "valid_to");
CREATE INDEX "idx_purchase_valid_time" ON "planned_purchases"("id", "valid_from", "valid_to");
CREATE INDEX "idx_purchase_system_time" ON "planned_purchases"("system_from", "system_to");
CREATE INDEX "idx_purchase_deleted" ON "planned_purchases"("is_deleted");

-- Add constraints
ALTER TABLE "planned_purchases" ADD CONSTRAINT "chk_purchase_valid_time" CHECK ("valid_from" < "valid_to");
ALTER TABLE "planned_purchases" ADD CONSTRAINT "chk_purchase_system_time" CHECK ("system_from" < "system_to");
ALTER TABLE "planned_purchases" ADD CONSTRAINT "chk_purchase_deleted" 
  CHECK (("is_deleted" = true AND "deleted_at" IS NOT NULL) OR ("is_deleted" = false AND "deleted_at" IS NULL));
