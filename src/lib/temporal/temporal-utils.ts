/**
 * Temporal Data Utilities
 * 
 * Helper functions for working with bi-temporal versioned entities.
 * In the stable entity ID design:
 *   - `versionId` is the row-level PK (unique per version)
 *   - `id` is the stable entity identifier (shared across all versions)
 *   - FK references store the stable `id`
 *   - Current version: validTo = MAX_DATE and isDeleted = false
 */

// Constants
export const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
export const MIN_DATE = new Date('1900-01-01T00:00:00.000Z');

// Types
export interface TemporalFields {
  id: string;
  versionId: string;
  previousVersionId: string | null;
  validFrom: Date;
  validTo: Date;
  systemFrom: Date;
  systemTo: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  changedBy: string | null;
}

export interface TemporalQueryOptions {
  asOfDate?: Date;
  includeDeleted?: boolean;
  systemAsOfDate?: Date;
}

export interface VersionChanges<T> {
  from: T & TemporalFields;
  to: T & TemporalFields;
  changes: Partial<T>;
  changedFields: (keyof T)[];
}

// Query Builders
export function buildCurrentVersionWhere(
  baseWhere: Record<string, any> = {},
  options: { includeDeleted?: boolean } = {}
): any {
  return {
    ...baseWhere,
    validTo: MAX_DATE,
    ...(options.includeDeleted ? {} : { isDeleted: false }),
  };
}

export function buildAsOfDateWhere(
  asOfDate: Date,
  baseWhere: Record<string, any> = {},
  options: { includeDeleted?: boolean } = {}
): any {
  return {
    ...baseWhere,
    validFrom: { lte: asOfDate },
    validTo: { gt: asOfDate },
    ...(options.includeDeleted ? {} : { isDeleted: false }),
  };
}

export function isCurrentVersion(record: TemporalFields): boolean {
  return record.validTo.getTime() === MAX_DATE.getTime() && !record.isDeleted;
}

export function wasValidAt(record: TemporalFields, date: Date): boolean {
  return record.validFrom <= date && record.validTo > date;
}

/**
 * Build a where clause for bi-temporal "as of" queries.
 * Returns records that existed in the system AND were valid at the given date.
 */
export function buildBitemporalAsOfWhere(
  asOfDate: Date,
  baseWhere: Record<string, any> = {},
  options: { includeDeleted?: boolean } = {}
): any {
  return {
    ...baseWhere,
    systemFrom: { lte: asOfDate },
    systemTo: { gt: asOfDate },
    validFrom: { lte: asOfDate },
    validTo: { gt: asOfDate },
    ...(options.includeDeleted ? {} : { isDeleted: false }),
  };
}

// ============================================================
// Entity Resolution Helpers
// These replace Prisma `include` for cross-entity bitemporal joins.
// ============================================================

/**
 * Build a where clause to resolve a single entity by its stable ID (current version).
 */
export function buildEntityWhere(entityId: string, options?: { includeDeleted?: boolean }) {
  return buildCurrentVersionWhere({ id: entityId }, options);
}

/**
 * Build a where clause to resolve multiple entities by their stable IDs (current versions).
 */
export function buildEntitiesWhere(entityIds: string[], options?: { includeDeleted?: boolean }) {
  return buildCurrentVersionWhere({ id: { in: entityIds } }, options);
}

/**
 * Given an array of resolved entities and a key field name, build a Map<entityId, entity>
 * for O(1) lookups when enriching related records.
 */
export function buildEntityMap<T extends { id: string }>(entities: T[]): Map<string, T> {
  return new Map(entities.map(e => [e.id, e]));
}

/**
 * Collect unique non-null entity IDs from an array of records for batch resolution.
 */
export function collectEntityIds<T>(records: T[], ...fields: ((r: T) => string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    for (const field of fields) {
      const id = field(record);
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}
