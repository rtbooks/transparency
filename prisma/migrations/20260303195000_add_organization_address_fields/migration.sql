-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "address_line1" TEXT,
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "country" TEXT DEFAULT 'US';
