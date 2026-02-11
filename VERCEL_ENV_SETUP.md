# Vercel Environment Variables Setup

## Required Environment Variables for Migrations

To ensure migrations run automatically on Vercel deployment, you **must** configure these environment variables:

### 1. Database URLs (Critical for Migrations)

**For Neon (Recommended):**

If you're using Vercel's Neon integration:
- `DATABASE_URL` - Pooled connection (automatically set by integration)
- `DATABASE_URL_UNPOOLED` - Direct connection for migrations ⚠️ **ADD THIS MANUALLY**

If you're manually configuring Neon:
- `DATABASE_URL` - Pooled connection (`-pooler` in hostname)
- `DIRECT_DATABASE_URL` - Direct connection (no `-pooler`)

**Why you need both:**
- **Pooled** (`DATABASE_URL`): Fast for serverless function connections
- **Direct/Unpooled** (`DATABASE_URL_UNPOOLED` or `DIRECT_DATABASE_URL`): Required for migrations and DDL operations

### 2. Example Neon URLs

```bash
# Pooled connection (for application)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Direct connection (for migrations) - notice NO "-pooler"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

The difference is just `-pooler` in the hostname!

### 3. Other Required Variables

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/register"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# Stripe (if using donations)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Node Environment
NODE_ENV="production"
```

## How to Add Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** → **Environment Variables**
4. For each variable:
   - Click **Add New**
   - Enter **Key** (e.g., `DATABASE_URL_UNPOOLED`)
   - Enter **Value** (the connection string)
   - Select environments: ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**

**Critical:** Make sure to add `DATABASE_URL_UNPOOLED` if using Vercel's Neon integration!

### Method 2: Vercel CLI

```bash
# Add a production-only variable
vercel env add DATABASE_URL_UNPOOLED production

# Add to all environments
vercel env add DATABASE_URL_UNPOOLED production preview development

# List all variables
vercel env ls
```

### Method 3: Neon Integration (Automatic for most variables)

If you connected Neon via Vercel's integration:
1. Go to **Settings** → **Integrations**
2. Find **Neon**
3. It automatically sets `DATABASE_URL`
4. ⚠️ **But you must manually add `DATABASE_URL_UNPOOLED`!**

## Getting the Unpooled URL from Neon

1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project
3. Click **Dashboard** → **Connection Details**
4. Find the connection string **WITHOUT** `-pooler`
5. Copy this as `DATABASE_URL_UNPOOLED`

## Verifying Migration Setup

After adding the environment variables:

### 1. Trigger a Redeploy

```bash
# Via CLI
vercel --prod

# Or in Vercel Dashboard:
# Deployments → Latest → ... → Redeploy
```

### 2. Check Build Logs

Look for this output in the deployment logs:

```
✓ Environment variables found
  DATABASE_URL: postgresql://...
  DATABASE_URL_UNPOOLED: postgresql://...

Running: npx prisma migrate deploy
----------------------------------
Applying migration `20260211124913_initial`
Applying migration `20260211205428_add_organization_verification`

✅ Migrations completed successfully!
```

### 3. If You See Warnings

```
⚠️ WARNING: Using pooled connection for migrations (not recommended)
   Add DATABASE_URL_UNPOOLED to Vercel environment variables
```

This means migrations might fail. Add `DATABASE_URL_UNPOOLED` immediately!

## Troubleshooting

### Migration Fails with "P2022: Column does not exist"

**Cause:** Migration didn't run during deployment.

**Fix:**
1. Add `DATABASE_URL_UNPOOLED` to Vercel
2. Redeploy

### Migration Fails with "Connection timeout"

**Cause:** Using pooled connection for migrations.

**Fix:**
1. Add `DATABASE_URL_UNPOOLED` (direct connection)
2. Redeploy

### How to Manually Run Migration Once

```bash
# Get production env vars
vercel env pull .env.vercel

# Source them
source .env.vercel

# Run migration
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

## Environment Variable Checklist

Before deploying, verify you have:

- [ ] `DATABASE_URL` (pooled connection)
- [ ] `DATABASE_URL_UNPOOLED` or `DIRECT_DATABASE_URL` (direct connection)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] All Clerk redirect URLs
- [ ] Stripe keys (if using donations)
- [ ] `NODE_ENV=production`

## Preview Deployments

For automatic preview environments with database branches, see **PREVIEW_DEPLOYMENTS.md**.

Preview deployments should also have:
- Branch-specific `DATABASE_URL`
- Branch-specific `DATABASE_URL_UNPOOLED`

The Neon integration can automatically create database branches for PRs!
