-- Remove priority column
ALTER TABLE "program_spending" DROP COLUMN IF EXISTS "priority";

-- Migrate existing status values to new simplified workflow
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'IN_PROGRESS';
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'COMPLETED';

-- Recreate SpendingStatus enum with new values
-- Step 1: Create new enum
CREATE TYPE "SpendingStatus_new" AS ENUM ('PLANNED', 'PURCHASED', 'CANCELLED');

-- Step 2: Alter column to use new enum
ALTER TABLE "program_spending" ALTER COLUMN "status" TYPE "SpendingStatus_new" USING ("status"::text::"SpendingStatus_new");

-- Step 3: Drop old enum and rename
DROP TYPE "SpendingStatus";
ALTER TYPE "SpendingStatus_new" RENAME TO "SpendingStatus";

-- Drop SpendingPriority enum
DROP TYPE IF EXISTS "SpendingPriority";
