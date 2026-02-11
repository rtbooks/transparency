# Preview Deployments with Neon Branch Databases

This guide explains how to set up automatic preview deployments with isolated database branches for each pull request.

## Overview

When you push a feature branch and create a PR, Vercel automatically creates a preview deployment. With Neon's branching feature, each preview gets its own isolated database that's a copy of production.

**Benefits:**
- ✅ Test database migrations safely before merging
- ✅ Preview with realistic data (copy of production)
- ✅ Isolated changes don't affect production
- ✅ Automatic cleanup when PR closes
- ✅ No manual database management needed

## Quick Setup (5 minutes)

### Step 1: Install Neon's Vercel Integration

1. Go to [Vercel Integrations Marketplace](https://vercel.com/integrations/neon)
2. Click "Add Integration"
3. Select your Vercel project
4. Authorize the integration
5. Select your Neon project

**That's it!** The integration automatically:
- Creates database branches for preview deployments
- Injects correct `DATABASE_URL` and `DIRECT_DATABASE_URL`
- Deletes branches when PRs are closed

### Step 2: Verify Configuration

1. **Neon Dashboard** → Your Project → "Branches"
   - You should see your main branch
   
2. **Vercel Dashboard** → Your Project → Settings → Environment Variables
   - `DATABASE_URL` should show "Provided by Neon Integration"
   - `DIRECT_DATABASE_URL` should show "Provided by Neon Integration"

### Step 3: Test the Flow

```bash
# Create a test branch
git checkout -b test/neon-preview
git commit --allow-empty -m "test: neon preview deployment"
git push origin test/neon-preview
```

**Expected behavior:**
1. Vercel starts building preview deployment
2. Neon automatically creates database branch `test/neon-preview`
3. Preview deployment runs migrations against branch database
4. Preview is accessible with isolated data

Check the Neon dashboard "Branches" tab to see the new database branch!

## How It Works

### Automatic Branch Creation

```
Git Branch         →  Vercel Preview  →  Neon Database Branch
────────────────────────────────────────────────────────────
main               →  Production      →  main (production DB)
feature/export     →  Preview         →  feature/export (isolated copy)
fix/bug-123        →  Preview         →  fix/bug-123 (isolated copy)
```

### Environment Variables

The integration automatically provides different database URLs based on the deployment type:

**Production (main branch):**
```
DATABASE_URL=postgresql://...@ep-xxx-pooler.aws.neon.tech/neondb
DIRECT_DATABASE_URL=postgresql://...@ep-xxx.aws.neon.tech/neondb
```

**Preview (any other branch):**
```
DATABASE_URL=postgresql://...@ep-yyy-pooler.aws.neon.tech/neondb?options=branch%3Dfeature%2Fexport
DIRECT_DATABASE_URL=postgresql://...@ep-yyy.aws.neon.tech/neondb?options=branch%3Dfeature%2Fexport
```

### Data Inheritance

Database branches start as **point-in-time copies** of production:
- Same schema
- Same data
- Same configuration

Changes in preview branches **don't affect production**.

## Development Workflow

### Testing Database Migrations

```bash
# 1. Create feature branch
git checkout -b feature/add-new-field

# 2. Update schema
# Edit prisma/schema.prisma

# 3. Create migration
npx prisma migrate dev --name add_new_field

# 4. Commit and push
git add -A
git commit -m "feat: add new field to transactions"
git push origin feature/add-new-field

# 5. Create PR
# Vercel builds preview with Neon branch database
# Migration runs against isolated database
# Test in preview environment

# 6. If migration works, merge PR
# If migration fails, fix and push again (same branch database)
```

### Testing with Production Data

Since database branches copy production data, you can:
- Test queries against realistic data
- Verify performance with actual data volumes
- Test data migrations safely

**Security:** All environment variables (Clerk, Stripe, etc.) are still from your Vercel environment settings, so you're not affecting production services.

## Database Branch Lifecycle

### Creation
- **Trigger:** Vercel preview deployment starts
- **Data:** Point-in-time copy of production
- **Schema:** Same as production at branch creation time

### Usage
- Migrations run independently
- Changes isolated to this branch
- Multiple preview deployments can use same branch

### Cleanup
- **Automatic:** When PR is closed/merged
- **Manual:** Delete in Neon dashboard "Branches" tab
- **Stale:** Auto-delete after 7 days of inactivity (configurable)

## Resource Limits

### Free Tier
- **3 concurrent branch databases**
- 0.5 GB storage per branch
- Sufficient for most development

**Note:** If you hit the limit, delete old branches or merge PRs to free up slots.

### Pro Tier ($19/month)
- **Unlimited branch databases**
- More storage per branch
- Auto-suspend reduces costs

## Troubleshooting

### Preview Build Fails: "Cannot connect to database"

**Check:**
1. Neon integration is installed in Vercel
2. Database branch was created (Neon dashboard → Branches)
3. Environment variables are set by integration (not manually)

**Fix:** Retry deployment (Vercel deployments → Redeploy)

### Migration Fails in Preview

**Scenario:** Migration works locally but fails in preview.

**Common causes:**
1. Database branch created before migration was committed
2. Needs production schema update first

**Fix:**
- Reset database branch in Neon dashboard
- Retry deployment

### "Too many branches" Error

**Cause:** Free tier allows 3 concurrent branches.

**Fix:**
1. Delete unused branches in Neon dashboard
2. Close/merge old PRs
3. Upgrade to Pro tier

### Preview Shows Old Data

**Cause:** Database branch created before recent production changes.

**Fix:** 
- Reset branch to production in Neon dashboard
- Or, this is expected behavior - branches are point-in-time copies

## Best Practices

### Do's ✅
- Create PRs for all database changes
- Test migrations in preview before merging
- Keep feature branches short-lived
- Delete branches after merging

### Don'ts ❌
- Don't manually create database branches (let integration do it)
- Don't override `DATABASE_URL` in preview environments
- Don't test with production credentials in preview
- Don't leave branches open indefinitely

## Manual Branch Management (Advanced)

If needed, you can manually manage branches:

### Create Branch
```bash
npx neonctl branches create \
  --name preview-$(git branch --show-current) \
  --parent main
```

### List Branches
```bash
npx neonctl branches list
```

### Delete Branch
```bash
npx neonctl branches delete preview-my-feature
```

### Reset Branch
```bash
npx neonctl branches reset preview-my-feature --parent main
```

**Note:** The integration handles this automatically - manual management rarely needed.

## Cost Optimization

### Storage
- Branches share storage with parent
- Copy-on-write technology (efficient)
- Only changed data consumes additional space

### Compute
- Free tier: Shared compute
- Pro tier: Dedicated compute per branch
- Auto-suspend after inactivity

### Tips
- Merge PRs promptly (auto-deletes branches)
- Don't create unnecessary preview deployments
- Use draft PRs for work-in-progress (skip preview builds)

## GitHub Actions Integration (Optional)

If you need more control, use GitHub Actions:

```yaml
# .github/workflows/preview-db.yml
name: Manage Preview Database

on:
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  manage-db:
    runs-on: ubuntu-latest
    steps:
      - name: Create/Update Neon Branch
        if: github.event.action != 'closed'
        run: |
          npx neonctl branches create-or-update \
            --name pr-${{ github.event.pull_request.number }}
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
      
      - name: Delete Neon Branch
        if: github.event.action == 'closed'
        run: |
          npx neonctl branches delete \
            --name pr-${{ github.event.pull_request.number }}
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
```

**Note:** The Vercel integration is simpler and recommended for most use cases.

## Resources

- [Neon Branching Documentation](https://neon.tech/docs/guides/branching)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [Neon Vercel Integration](https://vercel.com/integrations/neon)
- [Neon Pricing](https://neon.tech/pricing)

## Support

**Issues with preview deployments?**
1. Check Vercel deployment logs
2. Check Neon dashboard for branch status
3. Verify integration is properly configured
4. See troubleshooting section above

**Still stuck?**
- Neon Support: [Neon Discord](https://discord.gg/neon)
- Vercel Support: [Vercel Support](https://vercel.com/support)
