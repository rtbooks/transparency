# Deployment Setup Guide

Complete step-by-step instructions for deploying the Financial Transparency Platform to production.

## Overview

This guide will deploy:
- **Next.js application** → Vercel (serverless, auto-hibernates)
- **PostgreSQL database** → Neon (serverless, auto-suspends after 5 min idle)
- **Authentication** → Clerk
- **Payment processing** → Stripe
- **Preview environments** → Automatic with Neon branch databases (see PREVIEW_DEPLOYMENTS.md)

**Cost when idle:** $0/month  
**Cost under light use:** $0-5/month

---

## Related Documentation

- **PREVIEW_DEPLOYMENTS.md** - Set up automatic preview environments for PRs
- **CONTRIBUTING.md** - Development workflow and branch protection
- **QUICKSTART.md** - Local development setup

---

## Prerequisites

Before starting, create accounts for:
- [ ] [GitHub](https://github.com) (to host your code)
- [ ] [Vercel](https://vercel.com) (deployment platform)
- [ ] [Neon](https://neon.tech) (PostgreSQL database)
- [ ] [Clerk](https://clerk.com) (authentication)
- [ ] [Stripe](https://stripe.com) (payment processing)

You'll also need:
- Git installed locally
- Node.js 20+ installed
- This repository cloned locally

---

## Step 1: Push Code to GitHub

If you haven't already pushed this repository to GitHub:

```bash
# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - ready for deployment"

# Create a new repository on GitHub (via web interface)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2: Provision Neon Database

### 2.1 Create Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click **"New Project"**
3. Configure:
   - **Project name:** `transparency-platform` (or your choice)
   - **Region:** Choose closest to your users (e.g., `US East (Ohio)`)
   - **PostgreSQL version:** 16 (recommended)
4. Click **"Create Project"**

### 2.2 Get Connection Strings

After project creation, you'll see the connection details. Click **"Connection Details"** and copy **both** URLs:

**Pooled connection** (for application runtime):
```
postgresql://user:password@ep-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Direct connection** (for migrations):
```
postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Important:** The pooled URL has `-pooler` in the hostname. Save both.

### 2.3 Verify Auto-Suspend is Enabled

1. In Neon dashboard, go to **Settings → Compute**
2. Confirm **"Auto-suspend compute after inactivity"** is enabled (default: 5 minutes)
3. This ensures your database hibernates when idle to save costs

---

## Step 3: Configure Clerk Authentication

### 3.1 Create Clerk Application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Click **"Add application"**
3. Configure:
   - **Application name:** `Transparency Platform` (or your choice)
   - **Sign-in options:** Enable **Email** (required)
   - Optionally enable social providers (Google, GitHub, etc.)
4. Click **"Create Application"**

### 3.2 Get API Keys

After creation, go to **API Keys** in the sidebar:
- Copy **Publishable Key** (starts with `pk_live_...`)
- Copy **Secret Key** (starts with `sk_live_...`)

### 3.3 Configure Allowed Domains (after Vercel deployment)

You'll return to this step after deploying to Vercel to add your production domain.

---

## Step 4: Configure Stripe Payment Processing

### 4.1 Create Stripe Account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up for a new account
3. Complete business verification (can use test mode initially)

### 4.2 Get API Keys

In the Stripe Dashboard:
1. Click **Developers → API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_...` or `pk_live_...`)
3. Copy your **Secret Key** (starts with `sk_test_...` or `sk_live_...`)

**Recommendation:** Start with test keys, switch to live keys when ready for production.

### 4.3 Configure Webhook (after Vercel deployment)

You'll return to this step after deploying to Vercel to set up the webhook endpoint.

---

## Step 5: Deploy to Vercel

### 5.1 Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Sign in with your GitHub account
3. Import the repository you pushed in Step 1
4. Vercel will auto-detect Next.js settings

### 5.2 Configure Build Settings

Vercel should auto-detect these, but verify:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (project root)
- **Build Command:** `npm run vercel-build` (auto-detected from package.json)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm install` (auto-detected)

### 5.3 Add Environment Variables

Before deploying, click **"Environment Variables"** and add all of the following:

#### Platform Administration
```
PLATFORM_ADMIN_EMAILS=<your email address>
```
**Important:** Set this to your email address. When you register with this email, you'll automatically become a platform administrator with full system access.

You can add multiple emails separated by commas: `admin@example.com,owner@example.com`

#### Database
```
DATABASE_URL=<paste Neon POOLED connection string>
DIRECT_DATABASE_URL=<paste Neon DIRECT connection string>
```

#### Clerk Authentication
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<paste Clerk publishable key>
CLERK_SECRET_KEY=<paste Clerk secret key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/profile
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/profile
```

#### Stripe
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<paste Stripe publishable key>
STRIPE_SECRET_KEY=<paste Stripe secret key>
STRIPE_WEBHOOK_SECRET=<leave blank for now, will add after webhook setup>
```

#### Application Config
```
NEXT_PUBLIC_APP_URL=<will be https://your-app.vercel.app>
NEXT_PUBLIC_APP_NAME=Financial Transparency Platform
NODE_ENV=production
```

**Note:** For `NEXT_PUBLIC_APP_URL`, you can use the Vercel preview URL for now. You'll update this after deployment.

### 5.4 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Once deployed, note your production URL: `https://your-app-name.vercel.app`

---

## Step 6: Deploy and Verify

### 6.1 Monitor Deployment

1. Vercel will automatically deploy from your latest commit
2. Watch the build logs for any errors
3. The deployment process will:
   - Install dependencies (`npm install`)
   - Run database migrations (`prisma migrate deploy`)
   - Generate Prisma Client (`prisma generate`)
   - Build the Next.js app (`next build`)

**Database migrations are automatic!** Vercel runs `prisma migrate deploy` during each deployment, which:
- Applies any pending migrations from `prisma/migrations/`
- Ensures your database schema matches your code
- Tracks migration history in the `_prisma_migrations` table
- Is safe to run multiple times (idempotent)

### 6.2 Verify Deployment Success

After deployment completes:
1. Visit your production URL: `https://your-app-name.vercel.app`
2. You should see the homepage
3. The database schema is now deployed and ready

**Note:** The database starts empty - no seed data is created in production. Organizations and users are created through the application UI.

---

## Step 7: Complete Clerk Configuration

Now that you have a production URL, return to Clerk to add allowed domains.

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your application
3. Go to **Settings → Domains**
4. Add your Vercel production URL: `https://your-app-name.vercel.app`
5. If using a custom domain, add that too

---

## Step 8: Complete Stripe Webhook Setup

### 8.1 Create Webhook Endpoint

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Configure:
   - **Endpoint URL:** `https://your-app-name.vercel.app/api/webhooks/stripe`
   - **Events to send:** Select these events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
4. Click **"Add endpoint"**

### 8.2 Get Webhook Signing Secret

After creating the endpoint:
1. Click on the newly created webhook
2. Click **"Reveal"** under **Signing secret**
3. Copy the secret (starts with `whsec_...`)

### 8.3 Add to Vercel Environment Variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add a new variable:
   - **Key:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `<paste webhook signing secret>`
   - **Environment:** Production
5. Click **"Save"**

### 8.4 Redeploy

After adding the webhook secret, trigger a redeployment:
1. Go to **Deployments** tab in Vercel
2. Click **"Redeploy"** on the latest deployment
3. Wait for completion

---

## Step 9: Create Your First Organization

### 9.1 Register Platform Admin Account

1. Visit your production URL: `https://your-app-name.vercel.app`
2. Click **"Register"** and create an account **using the email you set in `PLATFORM_ADMIN_EMAILS`**
3. Verify your email (via Clerk)
4. Complete profile setup

**Important:** You'll automatically be granted platform admin privileges because your email matches the `PLATFORM_ADMIN_EMAILS` environment variable.

### 9.2 Verify Admin Access

After registration, you should have access to:
- `/admin/dashboard` - Platform administration
- `/admin/organizations` - Manage all organizations
- `/admin/users` - View all users

If you don't see these admin routes, verify:
1. Your email in Clerk matches exactly what's in `PLATFORM_ADMIN_EMAILS`
2. The environment variable is set in Vercel (check Settings → Environment Variables)
3. You registered a new account (existing users won't be auto-promoted)

### 9.3 Create Organization

1. After login, you'll be redirected to create an organization
2. Fill in organization details:
   - **Name:** Your nonprofit name
   - **EIN:** Tax ID number
   - **Mission statement**
   - **Fiscal year start date**
3. Click **"Create Organization"**

### 9.3 Set Up Chart of Accounts

1. Go to **Accounts** tab
2. Click **"Apply Template"** to use the nonprofit starter template
3. Or click **"Add Account"** to create accounts manually

### 9.4 Record First Transaction

1. Click **"Record Transaction"**
2. Fill in transaction details
3. Submit to verify everything works

---

## Step 10: Optional - Custom Domain

If you want to use a custom domain instead of `your-app.vercel.app`:

### 10.1 Add Domain in Vercel

1. Go to your Vercel project
2. Click **Settings → Domains**
3. Add your domain (e.g., `transparency.yournonprofit.org`)
4. Vercel will provide DNS records to add

### 10.2 Configure DNS

1. Go to your domain registrar's DNS settings
2. Add the CNAME or A record provided by Vercel
3. Wait for DNS propagation (up to 48 hours, usually <1 hour)

### 10.3 Update Environment Variables

1. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to your custom domain
2. Add custom domain to Clerk allowed domains
3. Update Stripe webhook URL to use custom domain
4. Redeploy

---

## Step 11: Verification Checklist

After completing all steps, verify:

- [ ] Can access production URL
- [ ] Can sign up for a new account
- [ ] Receive Clerk email verification
- [ ] Can create an organization
- [ ] Can view organization dashboard
- [ ] Can add accounts to chart of accounts
- [ ] Can record a transaction
- [ ] Can view transactions in the list
- [ ] Site hibernates after 5 min idle (check Neon dashboard "Active time")
- [ ] Site wakes up when accessed after idle (expect 1-3s first load)
- [ ] Stripe test donation flow works (optional)

---

## Monitoring & Maintenance

### Monitor Usage

**Vercel:**
- Go to project → Analytics to see traffic
- Go to Settings → Usage to see function invocations, bandwidth

**Neon:**
- Go to project → Monitoring to see active compute time
- Verify auto-suspend is working (compute should show 0 when idle)

**Clerk:**
- Go to Users to see registered accounts
- Free tier: up to 10,000 monthly active users

**Stripe:**
- Go to Dashboard to see payments
- Test mode is free, live mode charges standard processing fees

### Stay Within Free Tiers

**Vercel Hobby:**
- 1M function invocations/month
- 100GB bandwidth/month
- If you exceed, upgrade to Pro ($20/mo)

**Neon Free:**
- 0.5GB storage (for multiple orgs, upgrade to Launch at $19/mo)
- 100 compute hours/month (auto-suspend helps stay within limit)

**Clerk Free:**
- 10,000 monthly active users
- If exceeded, upgrade to Pro ($25/mo)

**Stripe:**
- No monthly fee, only 2.9% + $0.30 per transaction

---

## Troubleshooting

### Build Fails

**Error:** `DATABASE_URL is not set`
- **Fix:** Ensure all environment variables are added in Vercel settings

**Error:** `Prisma schema validation failed`
- **Fix:** Run `npx prisma generate` locally first to verify schema is valid

**Error:** `Module not found`
- **Fix:** Clear Vercel build cache: Settings → General → Clear Build Cache

### Database Connection Issues

**Error:** `Can't reach database server`
- **Fix:** Verify `DATABASE_URL` is the **pooled** connection string (has `-pooler` in hostname)
- **Fix:** Check Neon project is not paused (unpause in Neon dashboard)

**Error:** `Too many connections`
- **Fix:** Ensure you're using the pooled connection string, not the direct one, for `DATABASE_URL`

### Authentication Issues

**Error:** `Invalid publishable key`
- **Fix:** Verify you copied the production key, not test/development key
- **Fix:** Check the key starts with `pk_live_` (not `pk_test_`)

**Error:** `This origin is not allowed`
- **Fix:** Add your Vercel domain to Clerk allowed domains

### Stripe Webhook Issues

**Error:** Donations complete but not recorded in database
- **Fix:** Verify webhook endpoint URL is correct
- **Fix:** Check `STRIPE_WEBHOOK_SECRET` is set in Vercel
- **Fix:** View Stripe webhook logs to see if events are being delivered

### Cold Start Delays

**Issue:** First request after idle takes 3-5 seconds
- **Expected behavior** with free tier scale-to-zero
- **Optional fix:** Keep the cron job in `vercel.json` to ping `/api/health` every 30 min (keeps app warm, uses more resources)
- **Upgrade fix:** Vercel Pro includes cold start prevention

---

## Scaling Up

When your organization grows beyond free tiers:

### Neon Launch ($19/mo)
- 10GB storage
- 300 compute hours/month
- Upgrade when storage exceeds 0.5GB

### Vercel Pro ($20/mo)
- 10M function invocations/month
- 1TB bandwidth/month
- Cold start prevention
- Upgrade when traffic exceeds free limits

### Clerk Pro ($25/mo)
- 100,000 monthly active users
- Advanced features (organizations, SAML SSO)
- Upgrade when users exceed 10,000

**Total monthly cost at scale:** ~$64/mo for a growing organization with multiple active users.

---

## Database Schema Changes

When you need to make changes to your database schema in the future:

### Development Workflow

1. **Update the Prisma schema** (`prisma/schema.prisma`):
   ```prisma
   model Organization {
     // Add new field
     description String?
   }
   ```

2. **Create a migration**:
   ```bash
   npx prisma migrate dev --name add_organization_description
   ```

   This will:
   - Generate a new migration file in `prisma/migrations/`
   - Apply the migration to your local database
   - Regenerate the Prisma Client

3. **Test locally** to ensure everything works

4. **Commit and push**:
   ```bash
   git add prisma/
   git commit -m "Add organization description field"
   git push
   ```

5. **Vercel automatically applies the migration** on deployment!

### Migration Best Practices

- **Always test migrations locally first**
- **Make small, incremental changes** (easier to rollback if needed)
- **Never edit existing migration files** (create new ones instead)
- **Commit migrations with your code changes** (they're part of your app)
- **Use descriptive migration names**: `add_user_preferences`, not `migration_1`

### Troubleshooting Migrations

**Migration fails on Vercel:**
- Check build logs for the specific error
- Verify `DIRECT_DATABASE_URL` is set in Vercel env vars
- Test the migration locally with the same database state

**Need to rollback a migration:**
```bash
# Locally, mark the migration as rolled back
npx prisma migrate resolve --rolled-back 20260211_migration_name

# Create a new migration that reverts the changes
npx prisma migrate dev --name revert_previous_change
```

---

## Preview Deployments & Database Branches

**Want to test changes before merging to production?**

Vercel automatically creates preview deployments for every branch you push. With Neon's branching feature, each preview can have its own isolated database!

### Quick Setup

1. **Install Neon's Vercel Integration**
   - Go to [Vercel Integrations → Neon](https://vercel.com/integrations/neon)
   - Click "Add Integration"
   - Select your Vercel project and Neon database
   - That's it!

2. **How it works:**
   ```
   Push feature branch → Vercel creates preview → Neon creates database branch
   ```
   - Database branches are copies of production
   - Changes are isolated (don't affect production)
   - Auto-deleted when PR is closed

3. **Benefits:**
   - ✅ Test database migrations safely in preview
   - ✅ Preview with realistic production data
   - ✅ Catch issues before merging to main
   - ✅ No manual database management

### Example Workflow

```bash
# Create feature branch
git checkout -b feature/add-export

# Make changes, create migration
npx prisma migrate dev --name add_export_feature

# Push branch
git push origin feature/add-export
# → Vercel creates preview with isolated Neon database branch
# → Migrations run against preview database only
# → Test in preview environment

# If everything works, merge PR
# → Preview database automatically deleted
```

**For complete setup instructions and troubleshooting, see: [PREVIEW_DEPLOYMENTS.md](./PREVIEW_DEPLOYMENTS.md)**

---

## Security Checklist

Before going live with real financial data:

- [ ] Use live Stripe keys (not test keys)
- [ ] Enable Clerk MFA/2FA for admin accounts
- [ ] Review Vercel deployment protection settings
- [ ] Set up error monitoring (optional: Sentry)
- [ ] Set up uptime monitoring (optional: UptimeRobot, Pingdom)
- [ ] Backup database regularly (Neon provides point-in-time recovery)
- [ ] Review Clerk session timeout settings
- [ ] Ensure all secrets are in environment variables (not hardcoded)

---

## Getting Help

If you encounter issues:

1. **Check logs:**
   - Vercel: Project → Deployments → (click deployment) → Function Logs
   - Neon: Project → Monitoring → Query Performance
   - Stripe: Developers → Webhooks → (endpoint) → Attempts

2. **Review documentation:**
   - [Vercel Docs](https://vercel.com/docs)
   - [Neon Docs](https://neon.tech/docs)
   - [Clerk Docs](https://clerk.com/docs)
   - [Stripe Docs](https://stripe.com/docs)
   - [Prisma Docs](https://www.prisma.io/docs)

3. **Common resources:**
   - This project's `README.md` for local development
   - `APPROACH.md` for architecture overview
   - `PROJECT_STRUCTURE.md` for codebase structure

---

## Next Steps

After successful deployment:

1. Invite organization admins via Users tab
2. Set up recurring donation tiers (Stripe Products)
3. Configure organization branding (logo, colors)
4. Share public dashboard URL with donors
5. Export transaction reports for accounting
6. Set up regular database backups (Neon branching)

---

**Deployment complete!** 🎉

Your platform is now live, hibernating when idle, and costing $0/month until actively used.
