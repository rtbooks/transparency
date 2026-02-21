-- CreateEnum: ContactType
CREATE TYPE "ContactType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum: ContactRole
CREATE TYPE "ContactRole" AS ENUM ('DONOR', 'VENDOR');

-- CreateEnum: BillDirection
CREATE TYPE "BillDirection" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum: BillStatus
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable: contacts
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'INDIVIDUAL',
    "roles" "ContactRole"[],
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_id" TEXT NOT NULL,
    "previous_version_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp,
    "system_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "system_to" TIMESTAMP(3) NOT NULL DEFAULT '9999-12-31 23:59:59.999'::timestamp,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bills
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "bill_number" TEXT,
    "direction" "BillDirection" NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "paid_in_full_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bill_payments
CREATE TABLE "bill_payments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add contact_id to transactions
ALTER TABLE "transactions" ADD COLUMN "contact_id" TEXT;

-- CreateIndex: contacts
CREATE UNIQUE INDEX "contacts_version_id_key" ON "contacts"("version_id");
CREATE INDEX "idx_contact_org_user" ON "contacts"("organization_id", "user_id");
CREATE INDEX "idx_contact_current" ON "contacts"("id", "valid_to");
CREATE INDEX "idx_contact_valid_time" ON "contacts"("id", "valid_from", "valid_to");
CREATE INDEX "idx_contact_system_time" ON "contacts"("system_from", "system_to");
CREATE INDEX "idx_contact_deleted" ON "contacts"("is_deleted");
CREATE INDEX "idx_contact_org_active" ON "contacts"("organization_id", "is_active");

-- CreateIndex: bills
CREATE INDEX "idx_bill_org_status" ON "bills"("organization_id", "status");
CREATE INDEX "idx_bill_org_direction" ON "bills"("organization_id", "direction");
CREATE INDEX "idx_bill_contact" ON "bills"("contact_id");
CREATE INDEX "idx_bill_due_date" ON "bills"("due_date");

-- CreateIndex: bill_payments
CREATE INDEX "idx_billpayment_bill" ON "bill_payments"("bill_id");
CREATE INDEX "idx_billpayment_transaction" ON "bill_payments"("transaction_id");

-- AddForeignKey: contacts
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: bills
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bill_payments
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: transactions.contact_id
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
