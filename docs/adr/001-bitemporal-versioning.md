# ADR-001: Bi-Temporal Data Versioning

**Status:** Accepted

**Date:** 2026-02-18

## Context

RadBooks provides radical financial transparency for 501(c)(3) organizations. Financial data must be auditable — stakeholders need to see not just the current state but the complete history of changes, including what the data looked like at any point in time and when changes were made.

Traditional soft-delete or simple versioning approaches don't capture the full picture. We needed to answer two distinct temporal questions:

1. **Valid time**: "What was the state of this entity on a given business date?" (e.g., what was the account balance on March 15?)
2. **System time**: "What did we believe the state was at a given wall-clock time?" (e.g., what did our records show last Tuesday before a correction was made?)

## Decision

We adopted a **bi-temporal versioning pattern** for all core financial entities (Organization, Account, OrganizationUser, Contact, Transaction, PlannedPurchase/ProgramSpending). Each versioned row includes:

- `id` — stable entity identifier (same across all versions)
- `versionId` — unique per-row identifier (UUID, auto-generated)
- `validFrom` / `validTo` — the business time range during which this version is valid
- `systemFrom` / `systemTo` — the wall-clock time range recording when this version was known to the system
- `isDeleted` — soft-delete flag

**Current version queries** use `buildCurrentVersionWhere()` which filters on `validTo = MAX_DATE AND systemTo = MAX_DATE AND isDeleted = false`.

**Updates** close the old version (setting `validTo` and `systemTo` to `now()`) and create a new row with the updated data (new `versionId`, `validFrom = now`, `validTo = MAX_DATE`).

**Deletes** close the current version and create a final version with `isDeleted = true`.

## Consequences

### Positive
- Full audit trail of every change to every financial entity
- "As of" queries supported natively (time-machine feature)
- No data is ever physically deleted — complete accountability
- Enables regulatory compliance and donor transparency

### Negative
- Every query must include temporal filters (mitigated by `buildCurrentVersionWhere()`)
- Table sizes grow faster (each update adds a row instead of modifying in place)
- Unique constraints must use `versionId` not `id` (since `id` is shared across versions)
- More complex migration and data import logic
- Developers must understand the temporal model to write correct queries
