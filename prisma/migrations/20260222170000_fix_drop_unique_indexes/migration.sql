-- Fix: Drop unique indexes that were not dropped by the stable_entity_ids migration.
-- The previous migration used DROP CONSTRAINT which silently failed because
-- Prisma creates these as UNIQUE INDEX, not SQL CONSTRAINT.

-- Drop non-partial unique indexes (these block multiple bitemporal versions)
DROP INDEX IF EXISTS "organizations_slug_key";
DROP INDEX IF EXISTS "accounts_organization_id_code_key";
DROP INDEX IF EXISTS "organization_users_user_id_organization_id_key";
DROP INDEX IF EXISTS "transactions_bank_transaction_id_key";
DROP INDEX IF EXISTS "transactions_stripe_session_id_key";
DROP INDEX IF EXISTS "transactions_stripe_payment_id_key";
DROP INDEX IF EXISTS "planned_purchases_actual_transaction_id_key";

-- Drop version_id unique indexes (version_id is now the PK, so a separate unique index is redundant)
DROP INDEX IF EXISTS "organizations_version_id_key";
DROP INDEX IF EXISTS "accounts_version_id_key";
DROP INDEX IF EXISTS "transactions_version_id_key";
DROP INDEX IF EXISTS "contacts_version_id_key";
DROP INDEX IF EXISTS "organization_users_version_id_key";
DROP INDEX IF EXISTS "planned_purchases_version_id_key";

-- Re-create partial unique indexes (idempotent — IF NOT EXISTS)
-- These enforce uniqueness only on current versions (valid_to = MAX_DATE)
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_current_unique"
  ON "organizations" ("slug")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_org_code_current_unique"
  ON "accounts" ("organization_id", "code")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX IF NOT EXISTS "org_users_user_org_current_unique"
  ON "organization_users" ("user_id", "organization_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_bank_txn_current_unique"
  ON "transactions" ("bank_transaction_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "bank_transaction_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_stripe_session_current_unique"
  ON "transactions" ("stripe_session_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "stripe_session_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_stripe_payment_current_unique"
  ON "transactions" ("stripe_payment_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "stripe_payment_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "planned_purchases_actual_txn_current_unique"
  ON "planned_purchases" ("actual_transaction_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "actual_transaction_id" IS NOT NULL;
