# AGENTS.md — Instructions for AI Coding Agents

## Mandatory Build Verification

**After ALL changes to source code, a full production build MUST be run to verify no errors are introduced.**

```bash
npm run build
```

This catches prerender failures, TypeScript errors, and other issues that only surface during the full Next.js build (not during `tsc --noEmit` alone). Do NOT consider a change complete until `npm run build` succeeds.

## Pre-Commit Checklist

Before every commit, run these checks in order:

```bash
# 1. TypeScript type check
npx tsc --noEmit

# 2. Run all tests
npx jest --no-cache

# 3. Full production build (REQUIRED — catches prerender and SSR issues)
npm run build
```

If any step fails, fix the issue before committing. Do not skip the build step.

## Branch Workflow

- **Never commit directly to `main`** — it is branch-protected.
- Always work on a feature branch (`feature/`, `fix/`, `refactor/`, etc.).
- Push the branch and create a Pull Request.

## Key Architecture Notes

- **Prisma client** imports from `@/generated/prisma/client` (not `@prisma/client`).
- After schema changes, run `npx prisma generate` and create a migration in `prisma/migrations/`.
- **ClerkProvider** is wrapped in `SafeClerkProvider` (client component) to avoid `useContext` null errors during static prerendering.
- **Double-entry bookkeeping**: every Transaction has `debitAccountId` + `creditAccountId`. Always update account balances atomically.
- **Bi-temporal versioning**: never reuse `id` on new versions (causes P2002). Let Prisma auto-generate UUIDs.
