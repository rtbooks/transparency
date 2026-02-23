# Copilot Development Guidelines

This document contains critical information for GitHub Copilot and developers working on RadBooks.

## Critical: Prisma Client Import Path

**⚠️ ALWAYS use this import path for PrismaClient:**

```typescript
import { PrismaClient } from "@/generated/prisma/client";
```

**❌ DO NOT use these paths:**

```typescript
// WRONG - Will fail in Vercel builds
import { PrismaClient } from "@/generated/prisma";

// WRONG - Not the custom output path
import { PrismaClient } from "@prisma/client";
```

### Why This Matters

1. **Custom Output Path**: Our Prisma schema specifies a custom output directory:

   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../src/generated/prisma"
   }
   ```

2. **Module Structure**: The generated client is at `@/generated/prisma/client`, not just `@/generated/prisma`

3. **Vercel Builds**: Using the wrong path causes Vercel deployments to fail with TypeScript errors

### Verification Checklist

When adding or modifying Prisma imports:

- [ ] Import uses full path: `@/generated/prisma/client`
- [ ] Run `npm run type-check` to verify TypeScript compilation
- [ ] Run `npm run build` to verify Next.js build succeeds
- [ ] Check that similar imports in the codebase use the same pattern

### Related Imports

For Prisma types and enums, also use the full path:

```typescript
// Correct
import { Organization, Account, UserRole } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

// Also correct - importing from internal namespace
import type * as Prisma from "@/generated/prisma/internal/prismaNamespace";
```

### Using the Prisma Singleton

Always import the configured singleton from `@/lib/prisma`:

```typescript
import { prisma } from "@/lib/prisma";

// Use it in your code
const org = await prisma.organization.findUnique({
  where: { slug: "grit-hoops" },
});
```

**DO NOT** create new PrismaClient instances directly in application code (except in seed scripts).

---

## Common Import Patterns

### ✅ Correct Examples

```typescript
// API Routes
import { prisma } from "@/lib/prisma";
import { UserRole, OrganizationStatus } from "@/generated/prisma/client";

// Service Files
import { PrismaClient } from "@/generated/prisma/client";
import type { Organization, Account } from "@/generated/prisma/client";

// Type Imports
import type { Prisma } from "@/generated/prisma/client";
```

### ❌ Incorrect Examples (Will Break Builds)

```typescript
// WRONG - Missing /client
import { PrismaClient } from "@/generated/prisma";

// WRONG - Standard Prisma path (we use custom output)
import { PrismaClient } from "@prisma/client";

// WRONG - Creating new instances (use singleton)
const prisma = new PrismaClient();
```

---

## Branch Protection Workflow Reminder

**The `main` branch is PROTECTED. Always use feature branches:**

```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Make changes and commit
git add -A
git commit -m "feat: your change description"

# Push and create PR
git push origin feature/your-feature-name
# Then create PR via GitHub UI
```

---

## Before Every Commit

Run these checks to catch issues early:

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. Build test (catches most deployment issues)
npm run build
```

If any of these fail, fix the issues before committing.

---

## Temporal Data Pattern

When working with versioned entities (Organization, Account, OrganizationUser, PlannedPurchase):

```typescript
import { TemporalRepository } from "@/lib/temporal/temporal-repository";
import { prisma } from "@/lib/prisma";

// Use the temporal repository
const orgRepo = new TemporalRepository(prisma, "organization");

// Get current version
const current = await orgRepo.findCurrentById(id);

// Update (creates new version)
const updated = await orgRepo.update(id, { name: "New Name" }, userId);
```

See `TEMPORAL_SCHEMA_DESIGN.md` for complete patterns.

---

## Common Gotchas

1. **Prisma Generate**: After schema changes, always run `npx prisma generate`
2. **Migration Names**: Use descriptive names: `npx prisma migrate dev --name add_user_roles`
3. **Environment Variables**: Use `.env.local` for local dev (never commit this file)
4. **Route Organization**: All org routes use `/org/[slug]` prefix
5. **Temporal Queries**: Always check if entity is temporal before using standard CRUD

---

## File Naming Conventions

- **Components**: PascalCase (`TransactionCard.tsx`)
- **Utilities**: kebab-case (`format-currency.ts`)
- **API Routes**: kebab-case (`verify-balances/route.ts`)
- **Types**: PascalCase (`TransactionType`)
- **Constants**: UPPER_CASE in file (`MAX_DATE`)

---

## Documentation to Reference

Before implementing new features, check:

- `APPROACH.md` - System architecture
- `PROJECT_STRUCTURE.md` - File organization
- `TEMPORAL_SCHEMA_DESIGN.md` - Versioning patterns
- `CONTRIBUTING.md` - Code standards
- `IMPLEMENTATION_CHECKLIST.md` - Progress tracking

---

## When in Doubt

1. Search the codebase for similar patterns
2. Check existing API routes for consistency
3. Verify imports match project conventions
4. Test locally before pushing
5. Ask for clarification on ambiguous requirements

---

## Required Testing for Every Feature

**⚠️ Every new feature or model change MUST include tests. Do not consider a feature complete without them.**

Tests live in `src/__tests__/` mirroring the source structure. Run with `npx jest`.

### 1. API Contract Tests (`src/__tests__/api/`)

Define a Zod schema representing the exact response shape the UI component expects. This catches field omissions before they reach production.

```typescript
// Define what the UI needs — if the API stops returning a field, this fails
const BillDetailResponseSchema = z.object({
  id: z.string(),
  contact: z.object({ id: z.string(), name: z.string() }).nullable(), // nullable, NOT optional
  fundingAccountId: z.string().nullable(),
  // ... every field the UI reads
});

it('should validate response with all required fields', () => {
  const result = BillDetailResponseSchema.safeParse(mockResponse);
  expect(result.success).toBe(true);
});

it('should FAIL if contact field is missing', () => {
  const { contact, ...incomplete } = mockResponse;
  expect(BillDetailResponseSchema.safeParse(incomplete).success).toBe(false);
});
```

**For PATCH/PUT endpoints**, also validate the request schema accepts every field the form sends:

```typescript
it('should accept issueDate update', () => {
  expect(UpdateSchema.safeParse({ issueDate: '2026-03-01' }).success).toBe(true);
});

it('should accept null fundingAccountId to clear it', () => {
  expect(UpdateSchema.safeParse({ fundingAccountId: null }).success).toBe(true);
});
```

### 2. Service Field-Persistence Tests (`src/__tests__/services/`)

For every updatable field on a model, write a test that the update function actually persists it. This is the #1 way to catch "added field to schema but forgot to wire it into the update function."

```typescript
it('should persist issueDate changes', async () => {
  await updateBill('bill-1', 'org-1', { issueDate: new Date('2026-03-01') });

  expect(mockTx.bill.update).toHaveBeenCalledWith({
    where: { id: 'bill-1' },
    data: expect.objectContaining({ issueDate: expect.any(Date) }),
  });
});

it('should NOT include fields that were not provided', async () => {
  await updateBill('bill-1', 'org-1', { description: 'Only this' });
  const callData = mockTx.bill.update.mock.calls[0][0].data;
  expect(callData).not.toHaveProperty('issueDate');
  expect(callData).not.toHaveProperty('fundingAccountId');
});
```

### 3. Bitemporal Entity Resolution Tests

Any service function that returns data with related bitemporal entities (Contact, Account, Transaction) MUST have a test confirming the lookup works. The pattern:

```typescript
it('should resolve contact from bitemporal storage', async () => {
  (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
    id: 'contact-1', name: 'Acme Corp', email: 'test@acme.com',
  });

  const result = await getBill('bill-1', 'org-1');

  expect(result.contact).toEqual({ id: 'contact-1', name: 'Acme Corp', email: 'test@acme.com' });
  expect(prisma.contact.findFirst).toHaveBeenCalledWith({
    where: buildCurrentVersionWhere({ id: 'contact-1' }),
    select: { id: true, name: true, email: true },
  });
});
```

### 4. Active/Inactive Filtering

Any query that returns accounts for use in UI dropdowns or pickers MUST filter by `isActive: true`. The only exception is the Chart of Accounts page when the admin explicitly enables "Show inactive."

```typescript
// ✅ Correct: for form dropdowns, always filter active
where: buildCurrentVersionWhere({ organizationId, isActive: true })

// ✅ Correct: service function for dropdowns
export async function findActiveAccounts(orgId: string) {
  return prisma.account.findMany({
    where: buildCurrentVersionWhere({ organizationId: orgId, isActive: true }),
  });
}

// ❌ Wrong: using buildCurrentVersionWhere without isActive for a dropdown
where: buildCurrentVersionWhere({ organizationId })  // includes deactivated accounts!
```

### Checklist Before Completing a Feature

- [ ] **Service tests exist** for every new or modified service function
- [ ] **Every updatable field** has a persistence test in the service test file
- [ ] **API contract test** validates the response schema matches what the UI reads
- [ ] **PATCH/PUT schema test** confirms every field the edit form sends is accepted
- [ ] **Bitemporal lookups** for related entities are tested (contact, account, transaction)
- [ ] **All existing tests still pass** (`npx jest`)
- [ ] **TypeScript compiles** (`npm run type-check`)

### Existing Test Examples to Follow

| Test Type | Example File |
|-----------|-------------|
| Service unit tests | `src/__tests__/services/bill.service.test.ts` |
| API contract tests | `src/__tests__/api/bills-api-contract.test.ts` |
| Integration tests | `src/__tests__/integration/double-entry-integrity.test.ts` |
| Library unit tests | `src/__tests__/lib/temporal/temporal-utils.test.ts` |
| Component tests | `src/__tests__/components/dashboard/DashboardSummary.test.tsx` |

---

**Last Updated**: February 23, 2026

## Key Architecture Notes

- **Prisma client** imports from `@/generated/prisma/client` (not `@prisma/client`).
- After schema changes, run `npx prisma generate` and create a migration in `prisma/migrations/`.
- **ClerkProvider** is wrapped in `SafeClerkProvider` (client component) to avoid `useContext` null errors during static prerendering.
- **Double-entry bookkeeping**: every Transaction has `debitAccountId` + `creditAccountId`. Always update account balances atomically.
- **Bi-temporal versioning**: never reuse `id` on new versions (causes P2002). Let Prisma auto-generate UUIDs.
