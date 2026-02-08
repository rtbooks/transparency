# Copilot Instructions - Financial Transparency Platform

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
npx prisma db push          # Push schema to database (dev)
npx prisma db seed          # Seed with sample data
npx prisma studio           # Open database GUI at localhost:5555
npx prisma migrate dev      # Create migration (production-ready)
```

### Running Tests
```bash
# Once project has tests configured:
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run type-check         # TypeScript type checking
npm run lint              # Run ESLint
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

- `schema.prisma` (workspace root) - Database schema, copied to `prisma/schema.prisma` during setup
- `src/lib/prisma.ts` - Prisma Client singleton (prevents multiple instances)
- `src/lib/accounting/` - Double-entry logic and calculations
- `src/middleware.ts` - Clerk auth middleware with public route configuration
- `.env.local` - Local environment variables (git-ignored, create from `.env.example`)

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
- **schema.prisma** - Database schema with relationships
- **CONTRIBUTING.md** - Coding standards and commit conventions

## Common Pitfalls

- **Don't** use `any` types - Prisma generates types, use them
- **Don't** forget to run `npx prisma generate` after schema changes
- **Don't** create single-sided transactions (always debit AND credit)
- **Don't** expose raw Prisma errors to API responses (sanitize for security)
- **Always** use Next.js Image component for optimization
- **Always** disable git pagers when running git commands via CLI: `git --no-pager`
