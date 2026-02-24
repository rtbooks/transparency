-- Rename UserRole enum value DONOR → SUPPORTER

-- Step 1: Drop defaults that reference the enum
ALTER TABLE "organization_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;

-- Step 2: Convert role columns to text
ALTER TABLE "organization_users" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
ALTER TABLE "invitations" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);

-- Step 3: Update the values
UPDATE "organization_users" SET "role" = 'SUPPORTER' WHERE "role" = 'DONOR';
UPDATE "invitations" SET "role" = 'SUPPORTER' WHERE "role" = 'DONOR';

-- Step 4: Create new enum with renamed value
CREATE TYPE "UserRole_new" AS ENUM ('PLATFORM_ADMIN', 'ORG_ADMIN', 'SUPPORTER', 'PUBLIC');

-- Step 5: Convert text columns to new enum
ALTER TABLE "organization_users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::"UserRole_new");
ALTER TABLE "invitations" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::"UserRole_new");

-- Step 6: Drop old enum and rename
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 7: Restore defaults
ALTER TABLE "organization_users" ALTER COLUMN "role" SET DEFAULT 'SUPPORTER'::"UserRole";
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'SUPPORTER'::"UserRole";
