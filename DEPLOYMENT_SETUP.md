# Deployment Setup Guide

Complete step-by-step instructions for deploying your own RadBooks instance to
production. These steps configure infrastructure and credentials for that deployment;
they do not configure the hosted RadBooks service at radbooks.org.

## Overview

This guide will deploy:
- **Next.js application** → Vercel (runtime behavior depends on project configuration and plan)
- **PostgreSQL database** → Neon (configure compute and autosuspend behavior for your plan)
- **Authentication** → Clerk
- **Payment processing** → Stripe
- **Optional preview environments** → Configure and verify separately (see [Preview deployments](./docs/operations/preview-deployments.md))
- **Optional custom domain** → a domain you control

Hosting, database, authentication, and payment-provider costs depend on current plans,
usage, region, and configuration. Check each provider's current pricing before deploying.

---

## Related Documentation

- **[Preview deployments](./docs/operations/preview-deployments.md)** - Configure and verify preview environments
- **CONTRIBUTING.md** - Development workflow and branch protection
- **[DEV_SETUP.md](./DEV_SETUP.md)** - Local development setup

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

## Step 1: Put your instance in a GitHub repository

For your own RadBooks instance, deploy from a repository that you control (for example,
a fork or a separately created repository). Do not push directly to this project's
protected `main` branch. If creating a new repository, use GitHub's current instructions
to create it and push the branch you intend to deploy. Preserve the repository's branch
and pull-request protections.

If the repository is already on GitHub, skip this step.

---

## Step 2: Provision Neon Database

### 2.1 Create Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click **"New Project"**
3. Configure:
   - **Project name:** `transparency-platform` (or your choice)
   - **Region:** Choose a region supported by your account and appropriate for your users
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

### 2.3 Review compute settings

1. In the Neon dashboard, review the project's compute, autosuspend, and retention settings.
2. Check current plan limits, pricing, and expected availability/cold-start behavior.

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

Verify the project uses the settings required by this repository:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (project root)
- **Build Command:** `npm run vercel-build` (applies migrations, generates Prisma Client, then builds)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm install` (auto-detected)

### 5.3 Add Environment Variables

Before deploying, click **"Environment Variables"** and add all of the following:

Use test-mode credentials in Preview and live credentials only in Production after
verification. Assign secrets to the intended environment in Vercel; never reuse
production secrets for previews or commit secret values to the repository.

#### Platform Administration
```
PLATFORM_ADMIN_EMAILS=<your email address>
```
**Important:** Set this to your email address. When you register with this email, you'll automatically become a platform administrator with full system access.

You can add multiple emails separated by commas: `admin@example.com,owner@example.com`

#### Database
```
DATABASE_URL=<paste Neon POOLED connection string>
DATABASE_URL_UNPOOLED=<paste Neon DIRECT connection string, if provided>
```

The Neon Vercel integration may provide these values when configured for the project.
Verify the Preview and Production environment assignments in Vercel. For manual setup,
set `DATABASE_URL` to the pooled runtime connection and `DIRECT_DATABASE_URL` to the
direct connection used by Prisma migrations. `prisma.config.mjs` falls back to
`DATABASE_URL` for local development.

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
STRIPE_CLIENT_ID=<Stripe Connect client ID, if using Connect onboarding>
```

#### File attachments

Create a Vercel Blob store and connect it to this project/environment so
`BLOB_READ_WRITE_TOKEN` is available. Use a separate development or preview store/token
where appropriate; do not copy production credentials into previews.

#### Application Config
```
NEXT_PUBLIC_APP_URL=<will be https://your-app.vercel.app>
NEXT_PUBLIC_APP_NAME=RadBooks
```

Do not set Vercel-managed variables such as `NODE_ENV` manually unless the platform
documentation for your setup specifically requires it. Set `NEXT_PUBLIC_APP_URL` to
the URL appropriate for each deployment environment.

#### Email (optional)

Set `RESEND_API_KEY` if this instance will send invitation or donation-receipt emails.
Configure the sender/domain in Resend according to its current verification process.

### 5.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete; duration varies by project and platform conditions.
3. Once deployed, note your production URL: `https://your-app-name.vercel.app`

---

## Step 6: Deploy and Verify

### 6.1 Monitor Deployment

1. Vercel deploys when triggered by the configured Git integration and branch rules.
2. Watch the build logs for any errors
3. Confirm that the configured build command ran migrations against the intended database.
4. Confirm Blob storage is connected and available in the intended environment if the
   deployment will use attachments.

This repository's `vercel-build` script runs `prisma migrate deploy`, `prisma generate`,
and `next build` in sequence. Migrations run only if the deployment invokes this script
and has a valid direct database URL. Verify the build command and migration logs for
your project; do not assume every Vercel deployment configuration applies migrations.

### 6.2 Verify Deployment Success

After deployment completes:
1. Visit your production URL: `https://your-app-name.vercel.app`
2. You should see the homepage
3. The database schema is now deployed and ready

Do not assume a new production database is seeded. This repository currently has no
general-purpose `prisma/seed.ts` script; create the first organization through the
application after configuring its initial administrator. Never run E2E seed/reset
commands against production.

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
   - **Events to send:** Enable `checkout.session.completed` and `account.updated` for
     the Stripe/Connect endpoint mode used by this instance. These are the event types
     handled by the current webhook route.
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
   - **Value:** `<paste this endpoint's signing secret>`
   - **Environment:** Production
5. Click **"Save"**. Configure separate signing secrets for separate webhook endpoints
   and environments. Donation processing will not work until the correct secret is set.

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
- [ ] Stripe test donation flow works (optional)
- [ ] Preview and production environment variables point to the intended services

---

## Monitoring & Maintenance

### Monitor Usage

**Vercel:**
- Go to project → Analytics to see traffic
- Go to Settings → Usage to see function invocations, bandwidth

**Neon:**
- Go to project → Monitoring to see active compute time
- Review compute, storage, and backup/restore options available on your plan

**Clerk:**
- Go to Users to see registered accounts

**Stripe:**
- Go to Dashboard to see payments

### Review provider limits and costs

Plan features, quotas, and pricing change. Review your account's current Vercel, Neon,
Clerk, and Stripe plans and estimate costs from each provider's billing dashboard before
launching. Payment processing fees depend on payment method, region, and your Stripe
agreement.

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

**Issue:** First request after an idle period is slower than expected.

Startup behavior depends on the Vercel runtime, database compute settings, region, and
current provider plan. Measure the delay in your deployment and review provider logs and
settings; do not assume a scheduled health check keeps either service warm or that a
particular plan removes cold starts.

---

## Scaling Up

Review usage and billing in each provider dashboard as the instance grows. Choose plans
based on current quotas, support needs, data residency, and availability requirements;
do not rely on fixed prices or limits in this guide.

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

5. Deploy using a build command that runs migrations (this repository's
   `npm run vercel-build` does). Verify the deployment log and target database.

### Migration Best Practices

- **Always test migrations locally first**
- **Make small, incremental changes** and prepare a corrective forward migration for
  changes that need to be undone
- **Never edit existing migration files** (create new ones instead)
- **Commit migrations with your code changes** (they're part of your app)
- **Use descriptive migration names**: `add_user_preferences`, not `migration_1`

### Troubleshooting Migrations

**Migration fails on Vercel:**
- Check build logs for the specific error
- Verify `DATABASE_URL_UNPOOLED` is set in Vercel env vars (or `DIRECT_DATABASE_URL` for manual setup)
- Test the migration locally with the same database state

**Need to recover from a migration problem?** `prisma migrate resolve --rolled-back`
changes Prisma's migration bookkeeping; it does not undo SQL or restore data. Use it
only as part of a reviewed recovery procedure for a failed migration, after inspecting
the database state. For a successfully applied migration, normally create a new forward
migration that corrects the schema/data. Back up important data before recovery work.

---

## Preview deployments

Vercel preview deployments and Neon database branching require provider-side project and
environment configuration. Do not assume a preview has an isolated database, sanitized
data, or test credentials until verified. Follow
[Preview deployments](./docs/operations/preview-deployments.md) to configure and check
your instance.

---

## Security Checklist

Before going live with real financial data:

- [ ] Use live Stripe keys (not test keys)
- [ ] Enable Clerk MFA/2FA for admin accounts
- [ ] Review Vercel deployment protection settings
- [ ] Set up error monitoring (optional: Sentry)
- [ ] Set up uptime monitoring (optional: UptimeRobot, Pingdom)
- [ ] Configure backups/point-in-time recovery according to the selected provider plan
- [ ] Test database restoration procedures; database branching is not a backup by itself
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
   - `docs/adr/` for recorded architecture decisions

---

## Next Steps

After successful deployment:

1. Invite organization admins via Users tab
2. Configure supported donation and Stripe Connect settings, then test payment flows in test mode
3. Configure organization branding (logo, colors)
4. Share public dashboard URL with donors
5. Export transaction reports for accounting
6. Configure and test database backups/restoration for the selected provider and plan

---

**Deployment steps complete.** Verify the production URL, provider configuration,
monitoring, and backup/restore plan for your instance.
