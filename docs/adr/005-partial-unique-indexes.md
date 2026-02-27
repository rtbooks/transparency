# ADR-005: Partial Unique Indexes for Soft Constraints

**Status:** Accepted

**Date:** 2026-02-27

## Context

Several models in RadBooks need uniqueness constraints that only apply in certain states. For example:

- **Access Requests**: A user should only have one *pending* request per organization, but we want to preserve historical approved/denied requests for audit purposes.
- **Bi-temporal entities**: The same `id` appears in multiple rows (versions), so standard unique constraints on `id` alone don't work.

A blanket `@@unique([organizationId, userId])` on AccessRequest prevented users from re-requesting access after being removed from an organization, because the old resolved request blocked the new one. Deleting old records loses audit history.

## Decision

We use **PostgreSQL partial unique indexes** — unique constraints that only apply to rows matching a `WHERE` condition.

For AccessRequest:
```sql
CREATE UNIQUE INDEX access_requests_org_user_pending_unique
  ON access_requests(organization_id, user_id)
  WHERE status = 'PENDING';
```

This is implemented via a raw SQL migration since Prisma doesn't natively support partial unique indexes. The Prisma schema has a regular `@@index` for query performance, while the partial unique index is managed in the migration.

The application layer also checks for existing pending requests before creating new ones (belt-and-suspenders approach).

## Consequences

### Positive
- Full audit history preserved — all access request records retained
- Business rule enforced at the database level (one pending request per user per org)
- Allows multiple resolved records for the same user/org combination
- Pattern reusable for other soft constraints (e.g., one active membership per user per org)

### Negative
- Partial unique indexes are PostgreSQL-specific (not portable to other databases)
- Not representable in Prisma schema — must be managed via raw SQL migrations
- Developers must understand that the constraint is in the migration, not the schema
- Application-level checks still needed for good error messages (DB error is opaque)
