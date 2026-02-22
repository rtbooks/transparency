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
// ============================================================
// Optimistic Locking
// ============================================================

export class ConcurrentModificationError extends Error {
  constructor(modelName: string, versionId: string) {
    super(`Concurrent modification detected on ${modelName} version ${versionId}. The record was modified by another process.`);
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Close a bitemporal version row with optimistic locking.
 * Uses systemTo = MAX_DATE as the lock condition — if another process
 * already closed this version, the WHERE clause matches 0 rows.
 * Throws ConcurrentModificationError if the version was already closed.
 */
export async function closeVersion(
  prismaModel: any,
  versionId: string,
  now: Date,
  modelName: string = 'record'
): Promise<void> {
  const result = await prismaModel.updateMany({
    where: {
      versionId,
      systemTo: MAX_DATE,
    },
    data: {
      validTo: now,
      systemTo: now,
    },
  });

  if (result.count === 0) {
    throw new ConcurrentModificationError(modelName, versionId);
  }
}

/**
 * Create a new version of a bitemporal entity from an existing record.
 * Copies all fields from the source, applies updates, and sets fresh temporal fields.
 */
export function buildNewVersionData<T extends TemporalFields>(
  current: T,
  updates: Partial<T>,
  now: Date,
  userId?: string | null,
): Record<string, any> {
  const { versionId: _vId, previousVersionId: _pvId, validFrom: _vf, validTo: _vt, systemFrom: _sf, systemTo: _st, ...rest } = current as any;
  return {
    ...rest,
    ...updates,
    id: current.id,
    versionId: crypto.randomUUID(),
    previousVersionId: current.versionId,
    validFrom: now,
    validTo: MAX_DATE,
    systemFrom: now,
    systemTo: MAX_DATE,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    changedBy: userId ?? null,
  };
}

// ============================================================
// Entity Resolution Helpers
// ============================================================

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
