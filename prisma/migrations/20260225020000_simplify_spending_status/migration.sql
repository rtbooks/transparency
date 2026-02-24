-- Remove priority column
ALTER TABLE "program_spending" DROP COLUMN IF EXISTS "priority";

-- Step 1: Drop the default so the type change is clean
ALTER TABLE "program_spending" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Convert status column to text (USING clause required for enum->text)
ALTER TABLE "program_spending" ALTER COLUMN "status" TYPE TEXT USING ("status"::text);

-- Step 3: Migrate existing status values to new simplified workflow
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'IN_PROGRESS';
UPDATE "program_spending" SET "status" = 'PURCHASED' WHERE "status" = 'COMPLETED';

-- Step 4: Create new enum
CREATE TYPE "SpendingStatus_new" AS ENUM ('PLANNED', 'PURCHASED', 'CANCELLED');

-- Step 5: Convert text column to new enum
ALTER TABLE "program_spending" ALTER COLUMN "status" TYPE "SpendingStatus_new" USING ("status"::"SpendingStatus_new");

-- Step 6: Drop old enum and rename
DROP TYPE "SpendingStatus";
ALTER TYPE "SpendingStatus_new" RENAME TO "SpendingStatus";

-- Step 7: Restore default
ALTER TABLE "program_spending" ALTER COLUMN "status" SET DEFAULT 'PLANNED'::"SpendingStatus";

-- Drop SpendingPriority enum
DROP TYPE IF EXISTS "SpendingPriority";
