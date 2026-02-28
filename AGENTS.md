# Copilot Development Guidelines

This document contains critical information for GitHub Copilot and developers working on RadBooks.

## MUST DO : Git development process

**The `main` branch is PROTECTED. New work must be committed to a branch. When substantial work is completed, the commits should be pushed**

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

## File Naming Conventions

- **Components**: PascalCase (`TransactionCard.tsx`)
- **Utilities**: kebab-case (`format-currency.ts`)
- **API Routes**: kebab-case (`verify-balances/route.ts`)
- **Types**: PascalCase (`TransactionType`)
- **Constants**: UPPER_CASE in file (`MAX_DATE`)

---

## Documentation to Reference

Before implementing new features, check:

- `PROJECT_STRUCTURE.md` - File organization

---

## When in Doubt

1. Search the codebase for similar patterns
2. Check existing API routes for consistency
3. Verify imports match project conventions
4. Test locally before pushing
5. Ask for clarification on ambiguous requirements
