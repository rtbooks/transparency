# Vercel Automatic Migrations - Quick Fix Guide

## Current Problem
Your Vercel deployment doesn't have the verification fields in the database, causing login errors.

## Immediate Fix (Do This Now)

### Step 1: Add Missing Environment Variable

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New Variable**

Add this variable:
```
Name: DATABASE_URL_UNPOOLED
Value: <your-neon-direct-connection-string>
```

**Where to get the value:**
- Go to [console.neon.tech](https://console.neon.tech)
- Select your project
- Click **Connection Details**
- Copy the string **WITHOUT** `-pooler` in the hostname
- Example: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

5. Select: ✅ Production, ✅ Preview, ✅ Development
6. Click **Save**

### Step 2: Redeploy

Option A - Via Dashboard:
1. Go to **Deployments**
2. Find your latest deployment
3. Click **...** → **Redeploy**
4. Click **Redeploy** again to confirm

Option B - Via CLI:
```bash
cd /workspace
vercel --prod
```

### Step 3: Verify in Build Logs

Look for this in the deployment logs:
```
✓ Environment variables found
  DATABASE_URL: postgresql://...
  DATABASE_URL_UNPOOLED: postgresql://...

Running: npx prisma migrate deploy
----------------------------------
Applying migration `20260211205428_add_organization_verification`

✅ Migrations completed successfully!
```

## What We Fixed

### 1. Updated Migration Script (`scripts/deploy-migrations.sh`)
- ✅ Better error messages
- ✅ Checks for DATABASE_URL_UNPOOLED
- ✅ Shows what's happening during migration
- ✅ Fails fast if migration fails

### 2. Added Schema Verification (`scripts/verify-schema.sh`)
- ✅ Runs after build completes
- ✅ Verifies migrations were applied
- ✅ Catches migration issues before deployment goes live

### 3. Updated Build Command
Changed from:
```json
"vercel-build": "bash scripts/deploy-migrations.sh && prisma generate && next build"
```

To:
```json
"vercel-build": "bash scripts/deploy-migrations.sh && prisma generate && next build && bash scripts/verify-schema.sh"
```

## Why This Matters

**Before:**
- Migrations might fail silently
- Build succeeds even if migrations fail
- Users get errors when trying to use the app

**After:**
- Migration failures stop the build
- Clear error messages in build logs
- Can't deploy broken database schema

## How Migrations Work on Vercel

```
┌─────────────────────────────────────────────┐
│ 1. Vercel starts build                      │
│    - Installs dependencies                  │
│    - Sets environment variables             │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ 2. deploy-migrations.sh runs                │
│    - Checks for DATABASE_URL_UNPOOLED       │
│    - Runs: npx prisma migrate deploy        │
│    - Shows migration status                 │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ 3. Prisma generates client                  │
│    - Creates TypeScript types               │
│    - Generates query engine                 │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ 4. Next.js builds application               │
│    - Compiles TypeScript                    │
│    - Optimizes code                         │
│    - Creates production bundles             │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ 5. verify-schema.sh runs (NEW!)            │
│    - Confirms schema matches migrations     │
│    - Fails if out of sync                   │
└─────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│ 6. Deployment goes live                     │
└─────────────────────────────────────────────┘
```

## Future Deployments

From now on, migrations will run automatically when you:
- Push to main branch
- Merge a pull request
- Create a new branch (preview deployment)

**Requirements:**
- ✅ `DATABASE_URL_UNPOOLED` must be set in Vercel
- ✅ Migration files must exist in `prisma/migrations/`
- ✅ Database must be accessible during build

## Troubleshooting

### Build fails with "DATABASE_URL_UNPOOLED not set"
→ Add the environment variable in Vercel dashboard (see Step 1 above)

### Build fails with "Connection timeout"
→ Your database might be suspended. Wait a moment and try again.

### Build fails with "Migration conflict"
→ Check your migration files in `prisma/migrations/` for conflicts

### Migrations run but app still errors
→ Make sure to redeploy after adding environment variables

## Need More Help?

See these detailed guides:
- **VERCEL_ENV_SETUP.md** - Complete environment variable setup
- **DEPLOYMENT_SETUP.md** - Full deployment guide
- **PREVIEW_DEPLOYMENTS.md** - Preview environment setup
- **MIGRATION_HELP.md** - Manual migration instructions

## Testing Locally

To test the migration script locally:
```bash
cd /workspace
bash scripts/deploy-migrations.sh
```

Should output:
```
==================================
Database Migration Deployment
==================================

✓ Environment variables found
...
✅ Migrations completed successfully!
```
