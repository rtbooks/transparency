# Running Database Migration on Vercel

## Issue
The new organization verification migration (`20260211205428_add_organization_verification`) hasn't been applied to your Vercel/production database, causing errors when users try to log in.

## Solution: Manual Migration

### Option 1: Run Migration Locally Against Production DB (Recommended)

1. **Get your production database URL from Vercel:**
   ```bash
   # In Vercel dashboard, go to your project → Settings → Environment Variables
   # Copy the DATABASE_URL value
   ```

2. **Run migration locally against production:**
   ```bash
   # Temporarily set production DB URL
   export DATABASE_URL="your-vercel-production-db-url"
   
   # Run migration
   npx prisma migrate deploy
   
   # Verify it worked
   npx prisma db push --accept-data-loss=false
   ```

### Option 2: Use Vercel CLI

1. **Install Vercel CLI (if not already installed):**
   ```bash
   npm i -g vercel
   ```

2. **Link to your project:**
   ```bash
   vercel link
   ```

3. **Pull environment variables:**
   ```bash
   vercel env pull .env.production
   ```

4. **Run migration:**
   ```bash
   DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-) npx prisma migrate deploy
   ```

### Option 3: Trigger Redeploy in Vercel

Sometimes the migration script runs but doesn't show in logs. Try:

1. Go to your Vercel dashboard
2. Find the deployment for `feature/organization-verification`
3. Click "..." → "Redeploy"
4. Check deployment logs to see if migration runs successfully

### Option 4: Use Prisma Studio to Manually Add Columns (Last Resort)

If migrations keep failing, you can manually add the columns:

```sql
-- Add these columns to the Organization table
ALTER TABLE "Organization" 
ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
ADD COLUMN "ein_verified_at" TIMESTAMP(3),
ADD COLUMN "verified_at" TIMESTAMP(3),
ADD COLUMN "verified_by" TEXT,
ADD COLUMN "verification_notes" TEXT,
ADD COLUMN "official_website" TEXT,
ADD COLUMN "determination_letter_url" TEXT;

-- Create the enum type if it doesn't exist
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'VERIFICATION_FAILED', 'SUSPENDED');

-- Update the column to use the enum
ALTER TABLE "Organization" ALTER COLUMN "verification_status" TYPE "VerificationStatus" USING "verification_status"::"VerificationStatus";
```

## Verifying the Fix

After running the migration, test by:
1. Visiting your Vercel deployment URL
2. Trying to log in
3. Creating a new organization
4. Checking that the verification fields appear

## Prevention: Update Deploy Script

The migration should run automatically on deploy. If it's not working, we may need to debug the `scripts/deploy-migrations.sh` script.

Check Vercel build logs for any migration errors during deployment.

## Need Help?

If you're still getting errors, share:
1. The full Vercel build log
2. Any migration error messages
3. Your database provider (Neon, Supabase, etc.)
