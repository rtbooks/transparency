# Temporal API endpoints

This is a short index of temporal endpoints found in the application. Route handlers are
the source of truth for request validation, response shapes, and authorization. This
reference intentionally makes no claims about rate limits or caching.

| Method and path | Purpose | Implementation |
|---|---|---|
| `GET /api/organizations/{slug}/history` | Retrieve organization versions | [`history/route.ts`](../../src/app/api/organizations/%5Bslug%5D/history/route.ts) |
| `GET /api/organizations/{slug}/as-of/{date}` | Retrieve organization, accounts, and program spending as of a date | [`as-of/[date]/route.ts`](../../src/app/api/organizations/%5Bslug%5D/as-of/%5Bdate%5D/route.ts) |
| `GET /api/organizations/{slug}/changes?from={date}&to={date}` | Retrieve organization and account changes in a date range | [`changes/route.ts`](../../src/app/api/organizations/%5Bslug%5D/changes/route.ts) |
| `GET /api/organizations/{slug}/accounts/{id}/history` | Retrieve an account's version history | [`accounts/[id]/history/route.ts`](../../src/app/api/organizations/%5Bslug%5D/accounts/%5Bid%5D/history/route.ts) |
| `GET /api/organizations/{slug}/reports/balance-sheet` | Generate a balance sheet with historical date parameters | [`reports/balance-sheet/route.ts`](../../src/app/api/organizations/%5Bslug%5D/reports/balance-sheet/route.ts) |
| `GET /api/organizations/{slug}/reports/income-statement` | Generate an income statement for a period | [`reports/income-statement/route.ts`](../../src/app/api/organizations/%5Bslug%5D/reports/income-statement/route.ts) |
| `GET /api/organizations/{slug}/reports/cash-flow` | Generate a cash-flow report for a period | [`reports/cash-flow/route.ts`](../../src/app/api/organizations/%5Bslug%5D/reports/cash-flow/route.ts) |
| `GET /api/organizations/{slug}/reports/analytics/membership` | Retrieve membership-change analytics | [`analytics/membership/route.ts`](../../src/app/api/organizations/%5Bslug%5D/reports/analytics/membership/route.ts) |

The listed endpoints require an authenticated Clerk user. Most handlers call Clerk
`auth()` but do not call `withOrgAuth()` to check organization membership; account
history does use `withOrgAuth()` and verifies organization access. Authentication is not
the same as organization authorization. Review the linked route and middleware before
changing exposure or relying on an endpoint in an integration.

For the underlying data model and temporal terminology, see
[Bi-temporal versioning](../architecture/bitemporal-versioning.md).
