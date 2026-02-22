-- Stable Entity ID Migration
-- Converts bitemporal models from per-version IDs to stable entity IDs.
-- versionId becomes the PK; id becomes the stable entity identifier shared across versions.

-- ============================================================
-- STEP 1: Add entity_id columns to all 6 bitemporal tables
-- ============================================================

ALTER TABLE "organizations" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "accounts" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "organization_users" ADD COLUMN "entity_id" TEXT;
ALTER TABLE "planned_purchases" ADD COLUMN "entity_id" TEXT;

-- ============================================================
-- STEP 2: Populate entity_id using recursive CTEs
-- For each version chain, the leaf (most recent) version's id
-- becomes the stable entity_id for the entire chain.
-- ============================================================

-- Organizations
WITH RECURSIVE chain AS (
  SELECT o.version_id, o.id, o.id AS entity_id, o.previous_version_id
  FROM organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM organizations o2 WHERE o2.previous_version_id = o.version_id
  )
  UNION ALL
  SELECT o.version_id, o.id, ch.entity_id, o.previous_version_id
  FROM organizations o
  JOIN chain ch ON ch.previous_version_id = o.version_id
)
UPDATE organizations SET entity_id = chain.entity_id
FROM chain WHERE organizations.version_id = chain.version_id;

-- Accounts
WITH RECURSIVE chain AS (
  SELECT a.version_id, a.id, a.id AS entity_id, a.previous_version_id
  FROM accounts a
  WHERE NOT EXISTS (
    SELECT 1 FROM accounts a2 WHERE a2.previous_version_id = a.version_id
  )
  UNION ALL
  SELECT a.version_id, a.id, ch.entity_id, a.previous_version_id
  FROM accounts a
  JOIN chain ch ON ch.previous_version_id = a.version_id
)
UPDATE accounts SET entity_id = chain.entity_id
FROM chain WHERE accounts.version_id = chain.version_id;

-- Transactions
WITH RECURSIVE chain AS (
  SELECT t.version_id, t.id, t.id AS entity_id, t.previous_version_id
  FROM transactions t
  WHERE NOT EXISTS (
    SELECT 1 FROM transactions t2 WHERE t2.previous_version_id = t.version_id
  )
  UNION ALL
  SELECT t.version_id, t.id, ch.entity_id, t.previous_version_id
  FROM transactions t
  JOIN chain ch ON ch.previous_version_id = t.version_id
)
UPDATE transactions SET entity_id = chain.entity_id
FROM chain WHERE transactions.version_id = chain.version_id;

-- Contacts
WITH RECURSIVE chain AS (
  SELECT c.version_id, c.id, c.id AS entity_id, c.previous_version_id
  FROM contacts c
  WHERE NOT EXISTS (
    SELECT 1 FROM contacts c2 WHERE c2.previous_version_id = c.version_id
  )
  UNION ALL
  SELECT c.version_id, c.id, ch.entity_id, c.previous_version_id
  FROM contacts c
  JOIN chain ch ON ch.previous_version_id = c.version_id
)
UPDATE contacts SET entity_id = chain.entity_id
FROM chain WHERE contacts.version_id = chain.version_id;

-- OrganizationUsers
WITH RECURSIVE chain AS (
  SELECT ou.version_id, ou.id, ou.id AS entity_id, ou.previous_version_id
  FROM organization_users ou
  WHERE NOT EXISTS (
    SELECT 1 FROM organization_users ou2 WHERE ou2.previous_version_id = ou.version_id
  )
  UNION ALL
  SELECT ou.version_id, ou.id, ch.entity_id, ou.previous_version_id
  FROM organization_users ou
  JOIN chain ch ON ch.previous_version_id = ou.version_id
)
UPDATE organization_users SET entity_id = chain.entity_id
FROM chain WHERE organization_users.version_id = chain.version_id;

-- PlannedPurchases
WITH RECURSIVE chain AS (
  SELECT pp.version_id, pp.id, pp.id AS entity_id, pp.previous_version_id
  FROM planned_purchases pp
  WHERE NOT EXISTS (
    SELECT 1 FROM planned_purchases pp2 WHERE pp2.previous_version_id = pp.version_id
  )
  UNION ALL
  SELECT pp.version_id, pp.id, ch.entity_id, pp.previous_version_id
  FROM planned_purchases pp
  JOIN chain ch ON ch.previous_version_id = pp.version_id
)
UPDATE planned_purchases SET entity_id = chain.entity_id
FROM chain WHERE planned_purchases.version_id = chain.version_id;

-- ============================================================
-- STEP 3: Handle orphan rows (safety fallback)
-- ============================================================

UPDATE organizations SET entity_id = id WHERE entity_id IS NULL;
UPDATE accounts SET entity_id = id WHERE entity_id IS NULL;
UPDATE transactions SET entity_id = id WHERE entity_id IS NULL;
UPDATE contacts SET entity_id = id WHERE entity_id IS NULL;
UPDATE organization_users SET entity_id = id WHERE entity_id IS NULL;
UPDATE planned_purchases SET entity_id = id WHERE entity_id IS NULL;

-- ============================================================
-- STEP 4: Build old_id → entity_id mapping tables for FK updates
-- ============================================================

CREATE TEMP TABLE org_id_map AS
  SELECT DISTINCT id AS old_id, entity_id FROM organizations WHERE id != entity_id;
CREATE TEMP TABLE acct_id_map AS
  SELECT DISTINCT id AS old_id, entity_id FROM accounts WHERE id != entity_id;
CREATE TEMP TABLE txn_id_map AS
  SELECT DISTINCT id AS old_id, entity_id FROM transactions WHERE id != entity_id;
CREATE TEMP TABLE contact_id_map AS
  SELECT DISTINCT id AS old_id, entity_id FROM contacts WHERE id != entity_id;

-- ============================================================
-- STEP 5: Drop all FK constraints referencing bitemporal entity PKs
-- ============================================================

-- From bitemporal → bitemporal
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_organization_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_debit_account_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_credit_account_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_contact_id_fkey";
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_organization_id_fkey";
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_parent_account_id_fkey";
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_organization_id_fkey";
ALTER TABLE "organization_users" DROP CONSTRAINT IF EXISTS "organization_users_organization_id_fkey";
ALTER TABLE "planned_purchases" DROP CONSTRAINT IF EXISTS "planned_purchases_organization_id_fkey";
ALTER TABLE "planned_purchases" DROP CONSTRAINT IF EXISTS "planned_purchases_actual_transaction_id_fkey";

-- From non-bitemporal → bitemporal
ALTER TABLE "bank_accounts" DROP CONSTRAINT IF EXISTS "bank_accounts_organization_id_fkey";
ALTER TABLE "bank_accounts" DROP CONSTRAINT IF EXISTS "bank_accounts_account_id_fkey";
ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_organization_id_fkey";
ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_contact_id_fkey";
ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_accrual_transaction_id_fkey";
ALTER TABLE "bill_payments" DROP CONSTRAINT IF EXISTS "bill_payments_transaction_id_fkey";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_organization_id_fkey";
ALTER TABLE "purchase_images" DROP CONSTRAINT IF EXISTS "purchase_images_planned_purchase_id_fkey";

-- ============================================================
-- STEP 6: Update FK references using id mapping tables
-- ============================================================

-- Organization references (when org was edited, old id → new entity_id)
UPDATE accounts SET organization_id = m.entity_id
  FROM org_id_map m WHERE accounts.organization_id = m.old_id;
UPDATE transactions SET organization_id = m.entity_id
  FROM org_id_map m WHERE transactions.organization_id = m.old_id;
UPDATE contacts SET organization_id = m.entity_id
  FROM org_id_map m WHERE contacts.organization_id = m.old_id;
UPDATE organization_users SET organization_id = m.entity_id
  FROM org_id_map m WHERE organization_users.organization_id = m.old_id;
UPDATE planned_purchases SET organization_id = m.entity_id
  FROM org_id_map m WHERE planned_purchases.organization_id = m.old_id;
UPDATE bank_accounts SET organization_id = m.entity_id
  FROM org_id_map m WHERE bank_accounts.organization_id = m.old_id;
UPDATE bills SET organization_id = m.entity_id
  FROM org_id_map m WHERE bills.organization_id = m.old_id;
UPDATE invitations SET organization_id = m.entity_id
  FROM org_id_map m WHERE invitations.organization_id = m.old_id;

-- Account references
UPDATE transactions SET debit_account_id = m.entity_id
  FROM acct_id_map m WHERE transactions.debit_account_id = m.old_id;
UPDATE transactions SET credit_account_id = m.entity_id
  FROM acct_id_map m WHERE transactions.credit_account_id = m.old_id;
UPDATE accounts SET parent_account_id = m.entity_id
  FROM acct_id_map m WHERE accounts.parent_account_id = m.old_id;
UPDATE bank_accounts SET account_id = m.entity_id
  FROM acct_id_map m WHERE bank_accounts.account_id = m.old_id;

-- Transaction references
UPDATE planned_purchases SET actual_transaction_id = m.entity_id
  FROM txn_id_map m WHERE planned_purchases.actual_transaction_id = m.old_id;
UPDATE bills SET accrual_transaction_id = m.entity_id
  FROM txn_id_map m WHERE bills.accrual_transaction_id = m.old_id;
UPDATE bill_payments SET transaction_id = m.entity_id
  FROM txn_id_map m WHERE bill_payments.transaction_id = m.old_id;

-- Contact references
UPDATE transactions SET contact_id = m.entity_id
  FROM contact_id_map m WHERE transactions.contact_id = m.old_id;
UPDATE bills SET contact_id = m.entity_id
  FROM contact_id_map m WHERE bills.contact_id = m.old_id;

-- Clean up temp tables
DROP TABLE org_id_map;
DROP TABLE acct_id_map;
DROP TABLE txn_id_map;
DROP TABLE contact_id_map;

-- ============================================================
-- STEP 7: Drop old unique constraints that will conflict
-- ============================================================

-- Drop old unique constraints on version_id (becoming PK)
-- Drop version_id unique indexes (Prisma creates as UNIQUE INDEX, not CONSTRAINT)
DROP INDEX IF EXISTS "organizations_version_id_key";
DROP INDEX IF EXISTS "accounts_version_id_key";
DROP INDEX IF EXISTS "transactions_version_id_key";
DROP INDEX IF EXISTS "contacts_version_id_key";
DROP INDEX IF EXISTS "organization_users_version_id_key";
DROP INDEX IF EXISTS "planned_purchases_version_id_key";

-- Drop unique indexes that conflict with multiple versions
-- (Prisma creates these as UNIQUE INDEX, not CONSTRAINT, so use DROP INDEX)
DROP INDEX IF EXISTS "organizations_slug_key";
DROP INDEX IF EXISTS "accounts_organization_id_code_key";
DROP INDEX IF EXISTS "organization_users_user_id_organization_id_key";
DROP INDEX IF EXISTS "transactions_bank_transaction_id_key";
DROP INDEX IF EXISTS "transactions_stripe_session_id_key";
DROP INDEX IF EXISTS "transactions_stripe_payment_id_key";
DROP INDEX IF EXISTS "planned_purchases_actual_transaction_id_key";

-- ============================================================
-- STEP 8: Swap PKs — drop old id column, rename entity_id → id
-- For each bitemporal table: drop PK on id, drop id, rename entity_id → id, add PK on version_id
-- ============================================================

-- Organizations
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_pkey";
ALTER TABLE "organizations" DROP COLUMN "id";
ALTER TABLE "organizations" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "organizations" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("version_id");

-- Accounts
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_pkey";
ALTER TABLE "accounts" DROP COLUMN "id";
ALTER TABLE "accounts" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "accounts" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("version_id");

-- Transactions
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_pkey";
ALTER TABLE "transactions" DROP COLUMN "id";
ALTER TABLE "transactions" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "transactions" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("version_id");

-- Contacts
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_pkey";
ALTER TABLE "contacts" DROP COLUMN "id";
ALTER TABLE "contacts" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "contacts" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("version_id");

-- OrganizationUsers
ALTER TABLE "organization_users" DROP CONSTRAINT "organization_users_pkey";
ALTER TABLE "organization_users" DROP COLUMN "id";
ALTER TABLE "organization_users" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "organization_users" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_pkey" PRIMARY KEY ("version_id");

-- PlannedPurchases
ALTER TABLE "planned_purchases" DROP CONSTRAINT "planned_purchases_pkey";
ALTER TABLE "planned_purchases" DROP COLUMN "id";
ALTER TABLE "planned_purchases" RENAME COLUMN "entity_id" TO "id";
ALTER TABLE "planned_purchases" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_pkey" PRIMARY KEY ("version_id");

-- ============================================================
-- STEP 9: Add composite unique constraints and indexes
-- ============================================================

-- Entity version uniqueness: one version per entity per validFrom
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_id_valid_from_key" UNIQUE ("id", "valid_from");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_id_valid_from_key" UNIQUE ("id", "valid_from");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_id_valid_from_key" UNIQUE ("id", "valid_from");
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_valid_from_key" UNIQUE ("id", "valid_from");
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_id_valid_from_key" UNIQUE ("id", "valid_from");
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_id_valid_from_key" UNIQUE ("id", "valid_from");

-- ============================================================
-- STEP 10: Add partial unique indexes for business uniqueness
-- (only enforced on current versions where valid_to = MAX_DATE)
-- ============================================================

CREATE UNIQUE INDEX "organizations_slug_current_unique"
  ON "organizations" ("slug")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX "accounts_org_code_current_unique"
  ON "accounts" ("organization_id", "code")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX "org_users_user_org_current_unique"
  ON "organization_users" ("user_id", "organization_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z';

CREATE UNIQUE INDEX "transactions_bank_txn_current_unique"
  ON "transactions" ("bank_transaction_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "bank_transaction_id" IS NOT NULL;

CREATE UNIQUE INDEX "transactions_stripe_session_current_unique"
  ON "transactions" ("stripe_session_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "stripe_session_id" IS NOT NULL;

CREATE UNIQUE INDEX "transactions_stripe_payment_current_unique"
  ON "transactions" ("stripe_payment_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "stripe_payment_id" IS NOT NULL;

CREATE UNIQUE INDEX "planned_purchases_actual_txn_current_unique"
  ON "planned_purchases" ("actual_transaction_id")
  WHERE "valid_to" = '9999-12-31T23:59:59.999Z' AND "actual_transaction_id" IS NOT NULL;
