# Development guide for coding agents

This guide helps developers and coding agents make changes that fit RadBooks. Keep the
existing implementation as the source of truth; when behavior is unclear, inspect a
nearby route, service, and test before introducing a new pattern.

## Where code lives

| Area | Location | Role |
|---|---|---|
| Web pages and route handlers | `src/app/` | Next.js App Router UI and API routes (`src/app/api/`) |
| Reusable UI | `src/components/` | Shared and feature-specific components |
| Domain operations | `src/services/` | Transactional business workflows for ledger, bills, donations, contacts, and related features |
| Shared server utilities | `src/lib/` | Authentication, accounting, temporal queries, reporting, and integrations |
| Database | `prisma/schema.prisma`, `prisma/migrations/` | Prisma schema and committed database migrations |
| Tests | `src/__tests__/`, `e2e/` | Jest unit/API/component/integration tests and Playwright browser tests |
| Architecture decisions | `docs/adr/` | Accepted decisions and rationale |

## Change workflow

1. Inspect the current branch and working tree. Preserve existing changes; do not assume
   the checkout is clean or switch branches automatically.
2. Find a comparable feature and read its route, service, and tests. Read the relevant
   ADRs before changing established architecture.
3. Keep API handlers focused on HTTP parsing, authentication/authorization, validation,
   and response mapping; put reusable business workflows in services.
4. Add or update tests at the layer that owns the behavior. Do not weaken or skip tests
   to make a change pass.
5. Run the narrow test suite first, then the broader checks appropriate to the change.

## Authorization and tenant boundaries

- Do not rely on hidden UI controls for security. Enforce authorization in server-side
  routes and workflows.
- Organization-scoped routes commonly use
  `withOrgAuth(slug, { requiredRole })` from `src/lib/auth/with-org-auth.ts`. It resolves
  the current organization and membership and can enforce a minimum role. Use
  `withPlatformAuth` only for authenticated flows that intentionally do not require
  organization membership (for example, a user's own donation history). Despite its
  name, it does **not** by itself require the user to be a platform administrator.
- Platform-admin-only routes must check the internal user's `isPlatformAdmin` flag or
  follow the specific established admin-route helper/pattern. Inspect that helper and
  its tests; do not infer privilege from authentication or a helper's name.
- Use the organization ID returned by the authorization context to scope database
  reads/writes. Validate that referenced accounts, contacts, and other entities belong
  to that same organization.
- Public routes and webhooks have distinct access patterns. Follow the specific route's
  established authentication/signature checks; do not apply member authorization
  blindly or assume an endpoint is safe because its URL is public.

## Financial and temporal invariants

- Transactions use double-entry bookkeeping: each entry has debit and credit accounts
  for the same amount. Asset/expense balances increase with debits; liability/equity/
  revenue balances increase with credits. See
  `src/lib/accounting/balance-calculator.ts` and its tests.
- Route transaction creation through `createTransaction()` for manual entries or
  `createTransactionRecord()` for service-to-service flows. The latter must be called
  inside the caller's Prisma `$transaction`; it creates the ledger record and updates
  both account balances atomically. Do not write a transaction or cached balance
  directly around these workflows. See `src/services/transaction.service.ts`.
- Editing and voiding transactions must preserve audit history and reverse/reapply
  balances using the existing service workflows. Respect closed fiscal periods.
- Versioned entities use temporal helpers and service/repository patterns. Do not
  overwrite historical versions with ordinary CRUD. For schema changes, read
  `.github/skills/prisma/SKILL.md` and
  `docs/architecture/bitemporal-versioning.md`; the Prisma schema and current services
  define the exact fields and behavior.
- For test changes, read `.github/skills/testing/SKILL.md`; verify examples against
  current tests and schema before reusing them.

## Choosing checks

| Change | Useful checks |
|---|---|
| Service or shared library logic | `npm test -- --runInBand src/__tests__/services` or the specific matching test file |
| API contract or role enforcement | Matching tests under `src/__tests__/api/` |
| Database integration behavior | `npm run test:integration` or a focused test under `src/__tests__/integration/` |
| UI behavior | Matching tests under `src/__tests__/components/` |
| End-to-end user flow | `npx playwright install chromium` if needed, then `npm run test:e2e` |
| Type/API surface or broad change | `npm run type-check`, `npm run lint`, and `npm run build` |

`npm test` runs the standard Jest suite. Integration tests have a separate Jest config.
Playwright uses port 3001 and requires its configured test environment and credentials;
check the E2E setup before running it. Never run database reset/seed commands against a
non-test database.

Before committing, run `npm run type-check`, `npm run lint`, and `npm run build` as
described in `AGENTS.md`. Report checks that could not be run and why.
