# Temporal Schema Design

## Overview

This document describes the bi-temporal versioning pattern used in RadBooks. Treat the
current Prisma schema and service implementations as authoritative for exact fields and
behavior; examples here explain concepts, are not guaranteed to be executable, and may
not cover every entity.

## Temporal Pattern

### Bi-temporal Tracking

Every versioned entity tracks two time dimensions:

1. **Valid Time (Business Time)**: When the data was valid in the real world
   - `validFrom`: Start of validity period
   - `validTo`: End of validity period (exclusive)

2. **Transaction Time (System Time)**: When the data was recorded in the database
   - `systemFrom`: When this version was recorded
   - `systemTo`: When this version was superseded

### Version Tracking

- `versionId`: Unique identifier for each version (UUID)
- `previousVersionId`: Links to the previous version (null for first version)
- `id`: Logical entity identifier (shared across all versions)

### Soft Deletion

- `isDeleted`: Boolean flag for soft deletes
- `deletedAt`: Timestamp when deleted
- `deletedBy`: User ID who performed deletion

## Standard Temporal Fields

The following is a conceptual shape, not a copy-paste Prisma model. In the current
schema `versionId` is the row primary key and `id` is the stable logical identifier.
Temporal fields vary by model; check `prisma/schema.prisma` before adding or changing
fields.

```prisma
// Core identity
versionId           String   @id @default(uuid())
id                  String   @default(uuid())
previousVersionId   String?  @map("previous_version_id")

// Valid time (business time)
validFrom           DateTime @default(now()) @map("valid_from")
validTo             DateTime @default("9999-12-31T23:59:59.999Z") @map("valid_to")

// Transaction time (system time)
systemFrom          DateTime @default(now()) @map("system_from")
systemTo            DateTime @default("9999-12-31T23:59:59.999Z") @map("system_to")

// Soft deletion
isDeleted           Boolean  @default(false) @map("is_deleted")
deletedAt           DateTime? @map("deleted_at")
deletedBy           String?  @map("deleted_by")

// Change tracking
changedBy           String?  @map("changed_by") // User ID who made the change

// ... entity-specific fields ...

// Temporal indexes
@@index([id, validTo], name: "idx_current_version")
@@index([id, validFrom, validTo], name: "idx_valid_time")
@@index([systemFrom, systemTo], name: "idx_system_time")
@@index([isDeleted])
```

## Naming Conventions

### Database Columns
- Snake case: `valid_from`, `system_from`, `previous_version_id`
- Use Prisma `@map()` directive for field name mapping

### Constants
```typescript
export const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
export const MIN_DATE = new Date('1900-01-01T00:00:00.000Z');
```

## Entity-Specific Designs

### Organization

Tracks changes to:
- Name, slug, EIN, mission
- Logo URL, fiscal year settings
- Status, subscription tier
- Verification status

**Key Considerations:**
- Slug changes are rare but must be tracked
- Verification status changes must be auditable
- Fiscal year changes affect reporting

### Account

Tracks changes to:
- Code, name, type, description
- Parent account relationships
- Active/inactive status
- Balance (cached value)

**Key Considerations:**
- Parent account changes affect hierarchy
- Balance is a derived field (calculated from transactions)
- Code changes require careful migration
- Account type changes should be rare/restricted

### OrganizationUser

Tracks changes to:
- User role within organization
- Anonymous donor preferences
- Highlight visibility settings

**Key Considerations:**
- Role changes must be auditable (security)
- Donor preferences affect public display
- Join date preserved in first version's validFrom

### ProgramSpending

Tracks changes to program-spending details such as description, budget estimate,
target date, and status. See the current Prisma schema for the authoritative fields.

**Key Considerations:**
- Amount estimates and status may change over time
- Actual spending is linked to one or more ledger transactions

### Transaction and Contact

Both models currently include temporal fields. Transaction edits and voids have
additional ledger-specific behavior; use `src/services/transaction.service.ts` rather
than implementing generic CRUD. Contact temporal operations are implemented in
`src/services/contact.service.ts`.

## Query Patterns

### Current Version Query

Get the current (active) version of an entity:

```typescript
const current = await prisma.organization.findFirst({
  where: {
    slug: 'grit-hoops',
    validTo: MAX_DATE,
    systemTo: MAX_DATE,
    isDeleted: false
  }
});
```

### Valid-time query

Get the version whose business-validity interval includes a date:

```typescript
const asOfDate = new Date('2024-06-15');
const historical = await prisma.organization.findFirst({
  where: {
    slug: 'grit-hoops',
    validFrom: { lte: asOfDate },
    validTo: { gt: asOfDate },
    isDeleted: false
  }
});
```

This valid-time query does not answer what the system knew at a past wall-clock time.
For a bi-temporal query, also constrain `systemFrom <= systemAsOfDate` and
`systemTo > systemAsOfDate`, or use the repository helper appropriate to the use case.
See `buildAsOfDateWhere()` and `buildBitemporalAsOfWhere()` in
`src/lib/temporal/temporal-utils.ts`.

### Version History Query

Get all versions using the stable logical `id` (not the row-level `versionId`):

```typescript
const history = await prisma.organization.findMany({
  where: { id: organizationId },
  orderBy: { validFrom: 'desc' }
});
```

### Changes in Date Range

Get all changes within a time period:

```typescript
const changes = await prisma.organization.findMany({
  where: {
    slug: 'grit-hoops',
    systemFrom: { gte: startDate, lte: endDate }
  },
  orderBy: { systemFrom: 'asc' }
});
```

## Update Pattern

The general version-update workflow is:

1. Find the current row with `buildCurrentVersionWhere()`.
2. Close the current row with the existing temporal helper, which uses optimistic
   locking.
3. Create a new row with the same stable `id`, a new `versionId`, a
   `previousVersionId` pointing to the closed row, and open-ended valid/system periods.
4. Preserve `changedBy` and any entity-specific audit/void/delete fields.

Use the entity's service/repository implementation as the actual contract. Closing and
creating a version must be atomic where the domain operation requires it; the generic
repository helper by itself should not be assumed to provide a database transaction.

## Foreign Key Handling

### Current schema pattern

Temporal models use `versionId` as the row primary key and `id` as the stable logical
identifier. Related records commonly store that stable ID in scalar fields; the current
schema does not necessarily declare a Prisma relation or database foreign key to the
temporal model. Resolve related versions through the relevant service/query helper.

### Temporal Joins

When resolving a relationship as of a date, query each temporal entity using the same
time semantics and scope it to the correct organization. The following is illustrative;
use current services/helpers rather than copying it verbatim:

```typescript
// Get organization and its accounts as of 2024-06-15
const asOfDate = new Date('2024-06-15');

const org = await prisma.organization.findFirst({
  where: {
    slug: 'grit-hoops',
    validFrom: { lte: asOfDate },
    validTo: { gt: asOfDate }
  }
});

const accounts = await prisma.account.findMany({
  where: {
    organizationId: org.id,
    validFrom: { lte: asOfDate },
    validTo: { gt: asOfDate },
    isDeleted: false
  }
});
```

## Migration Strategy

### Backfill Process

1. **Add temporal columns** with default values
2. **Backfill initial versions** for all existing records:
   - `versionId`: Generate new UUID
   - `previousVersionId`: null (first version)
   - `validFrom`: Use `createdAt` timestamp
   - `validTo`: MAX_DATE (still current)
   - `systemFrom`: Use `createdAt` timestamp
   - `systemTo`: MAX_DATE (current system version)
   - `isDeleted`: false

3. **Create indexes** for temporal queries
4. **Validate integrity** of backfilled data

Migration SQL must be written for the exact database state and schema. Do not copy
generic backfill SQL from design notes; use the existing migration history and test any
data backfill against a disposable database first.

## Performance Considerations

### Indexing Strategy
- **Primary lookups**: Index on `(id, validTo)` for current version queries
- **Temporal queries**: Composite index on `(id, validFrom, validTo)`
- **System time**: Index on `(systemFrom, systemTo)` for audit queries
- **Soft deletes**: Index on `isDeleted` for filtering

### Query Optimization
- Always filter by `isDeleted = false` for active records
- Use `validTo = MAX_DATE` as shorthand for current version
- Consider materialized views for complex temporal joins
- Cache current versions aggressively

### Storage Considerations
- Version tables grow over time
- Monitor table sizes and query performance
- Consider archival strategy for very old versions (>5 years)
- Partitioning by date may help for very large tables

## Constraints and Validation

### Business Rules
1. No overlapping versions for same logical ID
2. No gaps in temporal coverage (except for deleted records)
3. `validFrom` < `validTo` always
4. `systemFrom` < `systemTo` always
5. `previousVersionId` must reference valid version

### Possible database constraints

These are examples of constraints to consider, not a statement that every temporal
table currently has them. Check `prisma/schema.prisma` and committed migrations before
relying on a constraint.
```sql
-- Ensure valid time ordering
ALTER TABLE organizations 
  ADD CONSTRAINT chk_valid_time 
  CHECK (valid_from < valid_to);

-- Ensure system time ordering  
ALTER TABLE organizations
  ADD CONSTRAINT chk_system_time
  CHECK (system_from < system_to);

-- Soft delete consistency
ALTER TABLE organizations
  ADD CONSTRAINT chk_deleted
  CHECK ((is_deleted = true AND deleted_at IS NOT NULL) OR (is_deleted = false AND deleted_at IS NULL));
```

## Testing Considerations

### Test Scenarios
1. Create initial version
2. Update creates new version, closes old
3. Multiple updates create version chain
4. Soft delete marks record as deleted
5. As-of queries return correct version
6. Current queries exclude deleted
7. History queries show all versions
8. Foreign keys work across versions
9. Temporal joins respect date boundaries
10. Concurrent updates handled correctly

### Data Integrity Checks
- No orphaned versions
- Version chain integrity (previous links valid)
- No overlapping versions
- No gaps in coverage
- All current records have validTo = MAX_DATE

## Future Enhancements

### Potential Additions
- **Effective dating with future validity**: Allow scheduling changes
- **Bi-directional version links**: Add `nextVersionId` for easier navigation
- **Version tags**: Label significant versions (e.g., "end of fiscal year")
- **Archival**: Move old versions to archive tables
- **Compression**: Store diffs instead of full copies for large entities
- **Audit triggers**: Automatic population of changedBy from context

### Advanced Features
- **Temporal foreign keys**: Enforce that FK references valid version at same time
- **Temporal views**: Database views for common temporal queries
- **Change detection**: Highlight exactly what changed between versions
- **Version comparison API**: Side-by-side diff of any two versions
