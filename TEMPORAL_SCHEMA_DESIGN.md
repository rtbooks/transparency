# Temporal Schema Design

## Overview

This document defines the bi-temporal versioning pattern used for all mutable financial entities in RadBooks.

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

All versioned entities include these fields:

```prisma
// Core identity
id                  String   @id @default(uuid())
versionId           String   @unique @default(uuid())
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

### PlannedPurchase

Tracks changes to:
- Title, description, category
- Estimated amount, target date
- Status, priority
- Actual transaction linkage

**Key Considerations:**
- Amount estimates can change frequently
- Status transitions must be tracked
- Link to actual transaction is immutable once set

## Query Patterns

### Current Version Query

Get the current (active) version of an entity:

```typescript
const current = await prisma.organization.findFirst({
  where: {
    slug: 'grit-hoops',
    validTo: MAX_DATE,
    isDeleted: false
  }
});
```

### As-Of Query

Get version valid at a specific point in time:

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

### Version History Query

Get all versions of an entity:

```typescript
const history = await prisma.organization.findMany({
  where: { slug: 'grit-hoops' },
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

Creating a new version:

```typescript
async function updateVersion<T>(
  current: T & TemporalFields,
  updates: Partial<T>,
  userId: string
): Promise<T & TemporalFields> {
  const now = new Date();
  
  // Step 1: Close current version
  await prisma[model].update({
    where: { versionId: current.versionId },
    data: {
      validTo: now,
      systemTo: now
    }
  });
  
  // Step 2: Create new version
  return await prisma[model].create({
    data: {
      ...current,
      ...updates,
      versionId: generateUuid(),
      previousVersionId: current.versionId,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
      changedBy: userId
    }
  });
}
```

## Foreign Key Handling

### Principle
- Foreign keys reference the logical `id`, not `versionId`
- This allows relationships to span versions automatically

### Example
```prisma
model Transaction {
  debitAccountId  String
  creditAccountId String
  
  // References the logical account ID, not a specific version
  debitAccount  Account @relation("DebitAccount", fields: [debitAccountId], references: [id])
  creditAccount Account @relation("CreditAccount", fields: [creditAccountId], references: [id])
}
```

### Temporal Joins

When querying relationships as-of a date, both entities must be valid:

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

### Example Backfill SQL

```sql
-- Add temporal columns to Organization
ALTER TABLE organizations
  ADD COLUMN version_id UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN previous_version_id UUID,
  ADD COLUMN valid_from TIMESTAMP DEFAULT created_at,
  ADD COLUMN valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59.999'::timestamp,
  ADD COLUMN system_from TIMESTAMP DEFAULT created_at,
  ADD COLUMN system_to TIMESTAMP DEFAULT '9999-12-31 23:59:59.999'::timestamp,
  ADD COLUMN is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN deleted_at TIMESTAMP,
  ADD COLUMN deleted_by TEXT,
  ADD COLUMN changed_by TEXT;

-- Backfill with initial version data
UPDATE organizations
SET 
  version_id = gen_random_uuid(),
  valid_from = created_at,
  system_from = created_at;

-- Create indexes
CREATE INDEX idx_org_current ON organizations(id, valid_to);
CREATE INDEX idx_org_valid_time ON organizations(id, valid_from, valid_to);
CREATE INDEX idx_org_system_time ON organizations(system_from, system_to);
CREATE INDEX idx_org_deleted ON organizations(is_deleted);
```

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

### Database Constraints
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
