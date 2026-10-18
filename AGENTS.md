# Repository Instructions for Coding Agents

Use these repository-wide instructions with the more detailed
[development guide](docs/development/README.md). Treat the current code and configuration
as authoritative when documentation and implementation differ.

## Work safely in the current checkout

Before editing, inspect `git status --short` and the current branch. Preserve unrelated
changes and follow the branch or worktree supplied by the harness. If the checkout is on
`main` and clean, create a task branch before making changes. Do not automatically switch
to `main`, pull, reset, clean, or overwrite existing work. `main` is protected; changes
should go through a pull request.

Do not commit or push unrelated changes. Follow the user's and repository's requested
review/commit workflow when the task is complete.

## Validation before commit

Run the relevant tests for the change. Before committing, run:

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. Build test (catches most deployment issues)
npm run build
```

If a check fails, report the failure and whether it is related to the change.

---

## File Naming Conventions

- **Components**: PascalCase (`TransactionCard.tsx`)
- **Utilities**: kebab-case (`format-currency.ts`)
- **API Routes**: kebab-case (`verify-balances/route.ts`)
- **Types**: PascalCase (`TransactionType`)
- **Constants**: UPPER_CASE in file (`MAX_DATE`)

---

## Project guidance

- Follow [the development guide](docs/development/README.md) for code layout, authorization,
  financial invariants, and test selection.
- For Prisma schema or migration work, read `.github/skills/prisma/SKILL.md` before editing.
- For new or changed tests, read `.github/skills/testing/SKILL.md` and follow the matching
  test patterns.
- Consult relevant records in `docs/adr/`; use route handlers and services as the source
  of truth for current API behavior.

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
