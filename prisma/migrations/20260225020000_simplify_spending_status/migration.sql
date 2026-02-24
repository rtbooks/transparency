-- Remove priority column
ALTER TABLE "program_spending" DROP COLUMN IF EXISTS "priority";

-- Step 1: Convert status column to text temporarily
ALTER TABLE "program_spending" ALTER COLUMN "status" TYPE TEXT;

-- Step 2: Migrate existing status values to new simplified workflow
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'IN_PROGRESS';
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'COMPLETED';

-- Step 3: Create new enum
CREATE TYPE "SpendingStatus_new" AS ENUM ('PLANNED', 'PURCHASED', 'CANCELLED');

-- Step 4: Convert text column to new enum
ALTER TABLE "program_spending" ALTER COLUMN "status" TYPE "SpendingStatus_new" USING ("status"::"SpendingStatus_new");

-- Step 5: Drop old enum and rename new one
DROP TYPE "SpendingStatus";
ALTER TYPE "SpendingStatus_new" RENAME TO "SpendingStatus";

-- Drop SpendingPriority enum
DROP TYPE IF EXISTS "SpendingPriority";
