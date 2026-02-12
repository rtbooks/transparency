# GitHub Branch Protection Setup Guide

This guide explains how to configure GitHub branch protection rules to require all tests pass before merging PRs.

## What We've Set Up

A GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every PR to `main`. It:

1. **Runs all 247 tests** with a PostgreSQL service container
2. **Runs type checking** (`npm run type-check`)
3. **Runs linting** (`npm run lint`)
4. **Verifies the build** succeeds (`npm run build`)

The workflow will create a status check called **"Run Tests"** and **"Build Check"** on every PR.

## Enable Branch Protection (Required)

To **enforce** that tests must pass before merging, you need to configure branch protection rules in GitHub:

### Step-by-Step Instructions

1. **Go to your repository on GitHub**
   - Navigate to: `https://github.com/rtbooks/transparency`

2. **Open Settings → Branches**
   - Click **Settings** (top menu)
   - Click **Branches** (left sidebar)

3. **Add Branch Protection Rule**
   - Click **Add rule** (or edit existing rule for `main`)
   - **Branch name pattern**: `main`

4. **Configure Required Settings** ✅

   Check these boxes:

   - ☑️ **Require a pull request before merging**
     - ☑️ Require approvals (recommended: at least 1)
     - ☑️ Dismiss stale pull request approvals when new commits are pushed

   - ☑️ **Require status checks to pass before merging**
     - ☑️ Require branches to be up to date before merging
     - Search and select these status checks:
       - ✅ `test` (Run Tests)
       - ✅ `build` (Build Check)

   - ☑️ **Do not allow bypassing the above settings** (recommended)

5. **Save Changes**
   - Click **Create** (or **Save changes**)

## What This Enforces

Once configured, GitHub will:

- ❌ **Block merging** if any tests fail
- ❌ **Block merging** if type checking fails
- ❌ **Block merging** if linting fails
- ❌ **Block merging** if the build fails
- ❌ **Block merging** if the branch is not up to date with `main`
- ✅ **Allow merging** only when all checks pass (green)

## Testing the Setup

1. **Create a test PR** (like the current `feature/financial-testing` branch)
2. **Wait for CI to run** (usually 3-5 minutes)
3. **Check the PR page** - you should see:
   - ✅ **Run Tests** - passed
   - ✅ **Build Check** - passed
   - Green "Merge" button enabled

4. **Try breaking a test** (optional):
   ```bash
   # Edit a test to fail
   git add .
   git commit -m "test: intentionally break a test"
   git push
   ```
   - CI will run and fail
   - ❌ Merge button will be disabled
   - PR will show "Some checks were not successful"

## Additional Recommendations

### Code Owners (Optional)
Create `.github/CODEOWNERS` to require specific people to review certain files:

```
# Financial logic requires review from platform admins
/src/lib/accounting/** @rtbooks
/prisma/schema.prisma @rtbooks

# Tests can be reviewed by anyone
/src/__tests__/** @rtbooks
```

### Required Reviewers
In branch protection settings, you can also:
- Require specific number of approving reviews (recommend: 1+)
- Require review from Code Owners
- Restrict who can push to `main` (only admins)

## CI Workflow Details

The workflow runs in two jobs:

**Job 1: test** (~3-4 minutes)
- Spins up PostgreSQL database
- Installs dependencies
- Generates Prisma Client
- Runs migrations
- Executes all 247 tests with coverage
- Runs type checking
- Runs linting

**Job 2: build** (~2-3 minutes)
- Installs dependencies
- Generates Prisma Client
- Builds Next.js production bundle

Total runtime: ~5-7 minutes per PR

## Troubleshooting

**Q: Status checks don't appear in branch protection settings**
- A: You need to run the workflow at least once. Push a commit to any branch or open a PR.

**Q: CI is failing on my PR**
- A: Check the Actions tab for detailed logs. Common issues:
  - Database connection failures
  - Missing environment variables
  - Failing tests
  - Type errors

**Q: How do I run CI locally?**
- A: Use the devcontainer, which has the same setup:
  ```bash
  npm test
  npm run type-check
  npm run lint
  npm run build
  ```

**Q: Can I skip CI for urgent fixes?**
- A: Not recommended, but admins can bypass branch protection if enabled. Better to fix the tests.

## Current Status

- ✅ CI workflow created and committed
- ✅ Workflow pushed to repository
- ⏳ **ACTION REQUIRED**: Enable branch protection rules (see steps above)
- ⏳ Wait for first CI run on PR to verify setup

Once branch protection is enabled, **all future PRs will require passing tests before merge**.

---

**File Location**: `.github/workflows/ci.yml`  
**Last Updated**: 2026-02-12
