# Copilot Instructions - Financial Transparency Platform

## 🔒 CRITICAL: Branch Protection Workflow

**The `main` branch is PROTECTED. Direct commits are NOT allowed.**

### REQUIRED WORKFLOW - ALWAYS FOLLOW

1. ✅ **Create a feature branch** before making ANY changes
2. ✅ **Make all changes on the feature branch**
3. ✅ **Commit and push the feature branch**
4. ✅ **Create a Pull Request** targeting `main`
5. ⏳ Wait for review and approval
6. ✅ Maintainer merges after approval

### Branch Naming Convention

```bash
feature/<description>  # New features
fix/<description>      # Bug fixes
docs/<description>     # Documentation updates
refactor/<description> # Code refactoring
test/<description>     # Test changes
chore/<description>    # Maintenance tasks
```

### Example Workflow

```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/add-export-feature

# Make changes and commit
git add -A
git commit -m "feat: add transaction export to CSV"

# Push branch and create PR
git push origin feature/add-export-feature
# Then create PR via GitHub web interface
```

### ❌ NEVER Do This

```bash
# DON'T commit directly to main
git checkout main
git commit -m "some change"
git push origin main  # ❌ This will be REJECTED
```

---

## Project Overview

A Next.js 14 SaaS platform providing radical financial transparency for 501(c)(3) charitable organizations. Built with TypeScript, Prisma, PostgreSQL, and Shadcn/ui.

**First Partner**: GRIT Hoops Westwood Basketball, Inc.

## Development Setup

### Using Devcontainer (Recommended)
```bash
# Open in VS Code and click "Reopen in Container"
# Everything auto-configures (~5-10 mins first time)
# Next.js app will be created in workspace root if not exists
npm run dev  # Start after container builds
```

### Database Commands
```bash
npx prisma generate          # Generate Prisma Client after schema changes
npx prisma migrate dev --name description  # Create migration (production-ready)
npx prisma migrate deploy    # Apply migrations (production)
npx prisma db seed          # Seed with sample data (dev only)
npx prisma studio           # Open database GUI at localhost:5555
```

### Running Tests
```bash
# Once project has tests configured:
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run type-check         # TypeScript type checking
npm run lint              # Run ESLint
npm run build             # Build for production
```

### Environment Setup
Database URL is pre-configured in devcontainer to `postgresql://transparency:devpassword@db:5432/transparency_dev`.

For Clerk and Stripe, add keys to `.env.local` (create if not exists):
- Clerk: https://clerk.com (auth)
- Stripe: https://dashboard.stripe.com/test/apikeys (donations)

## Architecture Patterns

### Multi-Tenant Organization Routing
Organizations use slug-based routing: `/:slug` for public dashboard, `/:slug/dashboard` for admin.

```typescript
// Public route: app/(organization)/[slug]/page.tsx
// Admin route: app/(organization)/[slug]/dashboard/page.tsx
// Route groups control layouts without affecting URLs
```

### Double-Entry Bookkeeping
Every transaction affects exactly two accounts. Balance calculation rules:
- **Asset/Expense accounts**: Debits increase, credits decrease
- **Liability/Equity/Revenue accounts**: Credits increase, debits decrease

```typescript
// Example: $100 donation
{
  debitAccountId: checkingAccount.id,    // Asset increases
  creditAccountId: donationRevenue.id,   // Revenue increases
  amount: 100
}
```

### Database Schema Hierarchy
- Organization → Accounts (Chart of Accounts with parent/child relationships)
- Organization → Transactions (double-entry records)
- Organization → PlannedPurchases
- User → OrganizationUser (many-to-many with roles)

**Key Enum**: `UserRole` defines access levels (DONOR, ORG_ADMIN, PLATFORM_ADMIN)

### API Route Patterns
```typescript
// Use Zod for validation
import { z } from 'zod';

const schema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1)
});

// Return consistent error formats
try {
  const data = schema.parse(body);
  // Process...
  return NextResponse.json(result);
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Invalid input', details: error.errors },
      { status: 400 }
    );
  }
  // Handle other errors...
}
```

## Component Organization

### UI Components (src/components/ui/)
Shadcn/ui base components. Install new ones with:
```bash
npx shadcn-ui@latest add [component-name]
```

### Business Components Structure
- `components/org/` - Organization-specific (TransactionList, AccountTree, DonorHighlights)
- `components/dashboard/` - Charts and visualizations (RevenueChart, ExpenseChart)
- `components/forms/` - Form components with validation
- `components/layout/` - Headers, sidebars, navigation
- `components/shared/` - Reusable utilities (LoadingSpinner, ErrorMessage)

## Naming Conventions

- **Components**: PascalCase (`TransactionCard.tsx`)
- **Utilities**: kebab-case (`format-currency.ts`)
- **Variables**: camelCase (`totalAmount`)
- **Constants**: UPPER_CASE (`MAX_TRANSACTIONS`)
- **Types/Interfaces**: PascalCase (`TransactionType`)

## Key Files & Locations

- `prisma/schema.prisma` - Database schema (single source of truth)
- `prisma.config.mjs` - Prisma configuration (at project root)
- `src/lib/prisma.ts` - Prisma Client singleton (prevents multiple instances)
- `src/lib/accounting/` - Double-entry logic and calculations
- `src/middleware.ts` - Clerk auth middleware with public route configuration
- `.env.local` - Local environment variables (git-ignored, create from `.env.example`)

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(transactions): add bulk CSV import functionality

Allows users to import multiple transactions from CSV files.
Validates against chart of accounts and provides error feedback.

Closes #123
```

```
fix(migrations): handle existing ENUMs in deploy script

Updates migration deployment script to detect and skip
existing database objects when rerunning failed migrations.

Fixes #456
```

## Testing Approach

Write tests for:
- Double-entry bookkeeping calculations (critical financial logic)
- Balance calculation functions
- Account hierarchy operations
- Donation flow and Stripe webhooks

Use descriptive test names that explain the scenario being tested.

## Security Requirements

- Never commit secrets to `.env.local` (git-ignored)
- Validate ALL user inputs with Zod schemas
- Use Prisma parameterized queries (built-in, don't use raw SQL)
- Implement rate limiting on donation endpoints
- Anonymous donor names must NEVER be exposed in public routes

## Stripe Integration

Donations flow: User → Stripe Checkout → Webhook → Record Transaction

```typescript
// Webhook handler must verify signature
const signature = headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

// On successful payment, create Transaction with donor link
```

## Financial Reporting

Fiscal year starts are organization-specific (stored in `Organization.fiscalYearStart`). Always filter by fiscal year when generating reports.

## Documentation References

- **APPROACH.md** - Complete technical architecture and business model
- **PROJECT_STRUCTURE.md** - Folder structure and routing patterns
- **QUICKSTART.md** - Step-by-step setup from scratch
- **DEPLOYMENT_SETUP.md** - Production deployment guide
- **CONTRIBUTING.md** - Coding standards and commit conventions
- **IMPLEMENTATION_CHECKLIST.md** - Development progress tracking

## Progress Tracking

**CRITICAL**: Keep IMPLEMENTATION_CHECKLIST.md up to date:
- **After completing any task**, update the corresponding checkbox in `IMPLEMENTATION_CHECKLIST.md`
- Mark items with `[x]` when completed
- Update the "Progress Tracking" section with current phase and completion percentage
- Update the "Last Updated" date
- When a milestone is reached, update the milestone status (⏳ → ✅)

**When to update**:
- After implementing new features or components
- After completing setup/configuration tasks
- After completing testing or deployment steps
- When moving between phases

## Deployment

Deployments happen automatically when PRs are merged to `main`:
1. PR merged → triggers Vercel deployment
2. Migrations run automatically via `scripts/deploy-migrations.sh`
3. Prisma Client generated
4. Next.js app builds
5. Deployment goes live

**No manual deployment needed!**

## Common Pitfalls

- **Don't** use `any` types - Prisma generates types, use them
- **Don't** forget to run `npx prisma generate` after schema changes
- **Don't** create single-sided transactions (always debit AND credit)
- **Don't** expose raw Prisma errors to API responses (sanitize for security)
- **Don't** forget to update IMPLEMENTATION_CHECKLIST.md after completing tasks
- **Don't** commit directly to main (use feature branches)
- **Always** use Next.js Image component for optimization
- **Always** disable git pagers when running git commands via CLI: `git --no-pager`

## Quick Reference Commands

**Start new work:**
```bash
git checkout main && git pull && git checkout -b feature/my-feature
```

**After making changes:**
```bash
git add -A
git commit -m "feat: description of changes"
git push origin feature/my-feature
# Then create PR via GitHub
```

**Update branch with latest main:**
```bash
git checkout main && git pull
git checkout feature/my-feature
git rebase main  # or: git merge main
```

**Database workflow:**
```bash
# After schema changes
npx prisma generate
npx prisma migrate dev --name description
# Test locally, then commit migration files
```

---

**Remember: ALWAYS work on a feature branch. NEVER push directly to `main`.**

