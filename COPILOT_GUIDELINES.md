# Copilot Development Guidelines

This document contains critical information for GitHub Copilot and developers working on the Financial Transparency Platform.

## Critical: Prisma Client Import Path

**⚠️ ALWAYS use this import path for PrismaClient:**

```typescript
import { PrismaClient } from '@/generated/prisma/client';
```

**❌ DO NOT use these paths:**
```typescript
// WRONG - Will fail in Vercel builds
import { PrismaClient } from '@/generated/prisma';

// WRONG - Not the custom output path
import { PrismaClient } from '@prisma/client';
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
import { Organization, Account, UserRole } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';

// Also correct - importing from internal namespace
import type * as Prisma from '@/generated/prisma/internal/prismaNamespace';
```

### Using the Prisma Singleton

Always import the configured singleton from `@/lib/prisma`:

```typescript
import { prisma } from '@/lib/prisma';

// Use it in your code
const org = await prisma.organization.findUnique({
  where: { slug: 'grit-hoops' }
});
```

**DO NOT** create new PrismaClient instances directly in application code (except in seed scripts).

---

## Common Import Patterns

### ✅ Correct Examples

```typescript
// API Routes
import { prisma } from '@/lib/prisma';
import { UserRole, OrganizationStatus } from '@/generated/prisma/client';

// Service Files
import { PrismaClient } from '@/generated/prisma/client';
import type { Organization, Account } from '@/generated/prisma/client';

// Type Imports
import type { Prisma } from '@/generated/prisma/client';
```

### ❌ Incorrect Examples (Will Break Builds)

```typescript
// WRONG - Missing /client
import { PrismaClient } from '@/generated/prisma';

// WRONG - Standard Prisma path (we use custom output)
import { PrismaClient } from '@prisma/client';

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
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { prisma } from '@/lib/prisma';

// Use the temporal repository
const orgRepo = new TemporalRepository(prisma, 'organization');

// Get current version
const current = await orgRepo.findCurrentById(id);

// Update (creates new version)
const updated = await orgRepo.update(id, { name: 'New Name' }, userId);
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

**Last Updated**: February 12, 2026
