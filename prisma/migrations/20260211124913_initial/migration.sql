-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'ORG_ADMIN', 'DONOR', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'VENMO', 'CHECK', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchasePriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ein" TEXT,
    "mission" TEXT,
    "logo_url" TEXT,
    "fiscal_year_start" TIMESTAMP(3) NOT NULL DEFAULT '2024-01-01 00:00:00 +00:00',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "auth_id" TEXT NOT NULL,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "total_donated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_users" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "anonymous_donor" BOOLEAN NOT NULL DEFAULT false,
    "show_in_highlights" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "description" TEXT,
    "parent_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "debit_account_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_number" TEXT,
    "donor_user_id" TEXT,
    "donor_name" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "receipt_url" TEXT,
    "notes" TEXT,
    "bank_transaction_id" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMP(3),
    "stripe_session_id" TEXT,
    "stripe_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_purchases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_amount" DECIMAL(12,2) NOT NULL,
    "target_date" TIMESTAMP(3),
    "category" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "PurchasePriority" NOT NULL DEFAULT 'MEDIUM',
    "actual_transaction_id" TEXT,
    "actual_amount" DECIMAL(12,2),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "planned_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_images" (
    "id" TEXT NOT NULL,
    "planned_purchase_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number_last4" TEXT NOT NULL,
    "account_type" TEXT,
    "plaid_access_token" TEXT,
    "plaid_item_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "token" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_users_user_id_organization_id_key" ON "organization_users"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organization_id_code_key" ON "accounts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_bank_transaction_id_key" ON "transactions"("bank_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_session_id_key" ON "transactions"("stripe_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_payment_id_key" ON "transactions"("stripe_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "planned_purchases_actual_transaction_id_key" ON "planned_purchases"("actual_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_account_id_key" ON "bank_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_organization_id_email_key" ON "invitations"("organization_id", "email");

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_donor_user_id_fkey" FOREIGN KEY ("donor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_actual_transaction_id_fkey" FOREIGN KEY ("actual_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_images" ADD CONSTRAINT "purchase_images_planned_purchase_id_fkey" FOREIGN KEY ("planned_purchase_id") REFERENCES "planned_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
