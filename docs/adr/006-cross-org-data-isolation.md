# ADR-006: Cross-Organization Data Isolation (IDOR Prevention)

**Status:** Proposed

**Date:** 2026-03-03

## Context

RadBooks is a multi-tenant platform where each organization's financial data must be strictly isolated. API routes are nested under `/api/organizations/[slug]/` and protected by RBAC via `withOrgAuth()`, which verifies the authenticated user has membership (and optionally a required role) in the organization identified by the URL slug.

However, many routes also accept record IDs as path parameters (e.g., `/api/organizations/[slug]/accounts/[id]`). Even with valid RBAC, a malicious user in Org A could substitute a record ID belonging to Org B. If the query fetches by ID alone without filtering by `organizationId`, the user gains unauthorized access to another organization's data. This is the **Insecure Direct Object Reference (IDOR)** vulnerability.

### Audit Findings (March 2026)

- **23 of 24** ID-based routes correctly scope queries by `organizationId`
- **1 route** (`accounts/[id]/history`) was vulnerable — fixed immediately
- Org scoping is enforced via ad-hoc patterns: some routes filter in the WHERE clause, others validate post-fetch, others delegate to service-layer functions
- **No database-level enforcement** exists (no RLS policies, no Prisma middleware)
- **No systematic mechanism** prevents a developer from forgetting to add org scoping to a new route

### Tables With `organizationId`

Account, Transaction, Bill, Contact, Campaign, Donation, BankAccount, BankStatement, AccountReconciliation, StripePayment, ProgramSpending, Attachment, FiscalPeriod, OrganizationPaymentMethod, AuditLog, AccessRequest, Invitation, OrganizationUser

### Tables Without `organizationId` (scoped via FK relations)

BankStatementLine (→ BankStatement), BillPayment (→ Bill), ReconciliationItem (→ AccountReconciliation), BankStatementLineMatch (→ BankStatementLine), CampaignTier (→ Campaign), ProgramSpendingTransaction (→ ProgramSpending)

## Options Considered

### Option A: Postgres Row-Level Security (RLS)

Set a session variable (`SET app.current_org_id = '...'`) at the start of each request, and define RLS policies on all organization-scoped tables that filter rows by `organizationId = current_setting('app.current_org_id')`.

**Pros:**
- Defense-in-depth — enforcement at the database engine level
- Transparent to application code — no per-query changes needed
- Impossible to forget — policies are always active

**Cons:**
- Prisma v7 with `@prisma/adapter-pg` has no native RLS support; requires raw `SET` commands per request
- Every query incurs policy evaluation overhead
- Migration complexity: policies needed on ~15 tables, platform admin bypass logic, child tables without `organizationId` need policy chains through FK relations
- Integration tests must set session variables; unit tests with mocked Prisma bypass RLS entirely
- Bi-temporal queries already have complex WHERE clauses; RLS adds another filter layer
- Policy management becomes an ongoing maintenance burden as schema evolves

### Option B: Prisma Client Extension with AsyncLocalStorage

Use Prisma `$extends` to intercept all queries and auto-inject `organizationId` into WHERE clauses. Use Node.js `AsyncLocalStorage` to carry org context from the route handler into the query layer without explicit parameter passing.

**Pros:**
- Automatic org scoping — developers can't forget
- Testable at the application level
- Works with existing Prisma query patterns

**Cons:**
- Must handle all query types (find, update, delete, aggregate) — complex extension code
- `$queryRaw` calls bypass extensions entirely
- AsyncLocalStorage requires middleware setup in Next.js App Router — adds infrastructure complexity
- Prisma v7 extension API for type-safe cross-model interception is verbose
- Still application-level — a bug in the extension is a vulnerability
- No existing AsyncLocalStorage infrastructure in the codebase

### Option C: Scoped Prisma Client Factory

Create a factory function `scopedPrisma(orgId)` that returns a wrapper around the Prisma client. The wrapper automatically injects `organizationId` into WHERE clauses for all org-scoped models. Route handlers obtain the scoped client alongside auth context.

```typescript
const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });
const db = scopedPrisma(ctx.orgId);

// organizationId filter is automatically injected:
const account = await db.account.findUnique({ where: { id } });
const bills = await db.bill.findMany({ where: { status: 'PENDING' } });
```

**Pros:**
- No new infrastructure (no AsyncLocalStorage, no DB policies)
- Integrates naturally with existing `withOrgAuth` pattern
- Incremental adoption — migrate routes one at a time
- Explicit scoping — easy to understand and debug
- Type-safe and unit-testable

**Cons:**
- Application-level only — no DB safety net
- Requires touching each route to adopt
- Doesn't protect raw SQL queries
- Developers could still import bare `prisma` instead of using the scoped client

### Option D: Hybrid (Scoped Client + RLS Safety Net)

Implement Option C for primary enforcement, then add Postgres RLS policies as a defense-in-depth backstop. The scoped client handles normal operation; RLS catches any gaps from bugs or forgotten scoping.

**Pros:**
- Maximum security — two independent enforcement layers
- If application code has a bug, RLS prevents data leakage
- Can be implemented in phases: scoped client first, RLS later

**Cons:**
- Highest implementation and maintenance complexity
- Double filtering (minimal performance impact but cognitive overhead)
- RLS policies must be kept in sync with schema changes

## Decision

**Option C: Scoped Prisma Client Factory** — with Option D (adding RLS) as a future phase if the risk profile demands it.

### Rationale

1. **Fits the existing architecture**: The `withOrgAuth` pattern already returns `orgId` in every route handler. A scoped client is a natural extension — one additional line per handler.

2. **Incremental adoption**: Unlike RLS (all-or-nothing migration), the scoped client can be adopted route-by-route while existing org-scoped queries continue to work.

3. **No infrastructure changes**: No AsyncLocalStorage middleware, no database policy management, no Prisma compatibility risks.

4. **Pragmatic risk assessment**: 23 of 24 routes were already correctly scoped. The primary risk is a developer forgetting to add `organizationId` to a new route — the scoped client makes this the default rather than opt-in.

5. **Testability**: The scoped client can be unit-tested to verify it injects the correct filter. An integration test can verify that cross-org access is blocked.

6. **RLS remains an option**: If the application grows to include raw SQL queries, third-party integrations, or other data access paths that bypass Prisma, RLS can be added as Phase 2 without conflicting with the scoped client.

## Implementation Plan

### Phase 1: Immediate Fix ✅
- Fixed the 1 IDOR vulnerability (`accounts/[id]/history`) by adding `withOrgAuth` and org ownership validation.

### Phase 2: Build Scoped Prisma Client
- Create `src/lib/prisma-scoped.ts` with `scopedPrisma(orgId)` factory
- Wrap core operations (findUnique, findFirst, findMany, update, delete) to auto-inject `organizationId`
- Handle child tables (no `organizationId`) — either pass through unscoped or scope via relation
- Handle platform admin bypass if needed
- Unit tests for the scoped client

### Phase 3: Migrate Routes
- Migrate high-risk routes first (those accepting `[id]` params)
- Optionally extend `withOrgAuth` to return `{ ...ctx, db: scopedPrisma(ctx.orgId) }`
- Migrate remaining routes over time

### Phase 4: Guardrails
- Add an integration test verifying cross-org access is blocked on all ID-based routes
- Consider an ESLint rule or code review checklist item to prevent bare `prisma.` imports in route handlers

## Consequences

- **Positive**: Systematic IDOR prevention with minimal architectural disruption
- **Positive**: New routes get org-scoping by default when using the scoped client
- **Positive**: Clear migration path to RLS if defense-in-depth becomes necessary
- **Negative**: Developers must remember to use `scopedPrisma` instead of bare `prisma` — mitigated by lint rules and code review
- **Negative**: Raw SQL queries are not covered — mitigated by the fact that the codebase uses zero raw SQL queries today

## References

- [OWASP: Insecure Direct Object References](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
- [Prisma Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- ADR-001: Bi-Temporal Data Versioning (relevant for query complexity considerations)
