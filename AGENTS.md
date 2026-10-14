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

## Development Environment

This project runs in a **devcontainer** with the following services always available:

- **PostgreSQL** is available at `localhost:5432`. The `DATABASE_URL` environment variable is pre-set (e.g., `postgresql://transparency:devpassword@localhost:5432/transparency_dev`). Do not attempt to install or start PostgreSQL — it is already running.
- **Playwright Chromium** must be installed before running E2E tests: `npx playwright install chromium`

---

## When in Doubt

1. Search the codebase for similar patterns
2. Check existing API routes for consistency
3. Verify imports match project conventions
4. Test locally before pushing
5. Ask for clarification on ambiguous requirements

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
