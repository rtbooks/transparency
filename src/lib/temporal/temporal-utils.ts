/**
 * Temporal Data Utilities
 * 
 * Helper functions for working with bi-temporal versioned entities.
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
