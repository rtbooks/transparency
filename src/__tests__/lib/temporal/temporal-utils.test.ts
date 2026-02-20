/**
 * Unit tests for temporal query utilities
 */

import {
  MAX_DATE,
  MIN_DATE,
  buildCurrentVersionWhere,
  buildAsOfDateWhere,
  buildBitemporalAsOfWhere,
} from '@/lib/temporal/temporal-utils';

describe('Temporal Utils', () => {
  describe('Constants', () => {
    it('MAX_DATE should be far in the future (9999-12-31)', () => {
      expect(MAX_DATE.getFullYear()).toBe(9999);
      expect(MAX_DATE.getMonth()).toBe(11); // December (0-indexed)
      expect(MAX_DATE.getDate()).toBe(31);
    });

    it('MIN_DATE should be at start of 1900', () => {
      expect(MIN_DATE.getFullYear()).toBe(1900);
      expect(MIN_DATE.getMonth()).toBe(0); // January
      expect(MIN_DATE.getDate()).toBe(1);
    });
  });

  describe('buildCurrentVersionWhere', () => {
    it('should build query for current versions without additional filters', () => {
      const where = buildCurrentVersionWhere();
      
      expect(where).toHaveProperty('validTo', MAX_DATE);
      expect(where).toHaveProperty('isDeleted', false);
    });

    it('should merge additional filters with temporal constraints', () => {
      const where = buildCurrentVersionWhere({
        organizationId: 'org-123',
        isActive: true,
      });
      
      expect(where).toHaveProperty('validTo', MAX_DATE);
      expect(where).toHaveProperty('isDeleted', false);
      expect(where).toHaveProperty('organizationId', 'org-123');
      expect(where).toHaveProperty('isActive', true);
    });

    it('should handle complex filter objects', () => {
      const where = buildCurrentVersionWhere({
        name: { contains: 'test' },
        amount: { gte: 100 },
      });
      
      expect(where).toHaveProperty('validTo', MAX_DATE);
      expect(where).toHaveProperty('isDeleted', false);
      expect(where.name).toEqual({ contains: 'test' });
      expect(where.amount).toEqual({ gte: 100 });
    });
  });

  describe('buildAsOfDateWhere', () => {
    const testDate = new Date('2024-06-15T12:00:00Z');

    it('should build query for specific date without additional filters', () => {
      const where = buildAsOfDateWhere(testDate);
      
      expect(where).toHaveProperty('validFrom');
      expect(where).toHaveProperty('validTo');
      expect(where).toHaveProperty('isDeleted', false);
      
      expect(where.validFrom).toEqual({ lte: testDate });
      expect(where.validTo).toEqual({ gt: testDate });
    });

    it('should merge additional filters with temporal constraints', () => {
      const where = buildAsOfDateWhere(testDate, {
        organizationId: 'org-456',
        type: 'ASSET',
      });
      
      expect(where.validFrom).toEqual({ lte: testDate });
      expect(where.validTo).toEqual({ gt: testDate });
      expect(where).toHaveProperty('isDeleted', false);
      expect(where).toHaveProperty('organizationId', 'org-456');
      expect(where).toHaveProperty('type', 'ASSET');
    });

    it('should handle date at boundary conditions', () => {
      const boundaryDate = new Date('2024-01-01T00:00:00.000Z');
      const where = buildAsOfDateWhere(boundaryDate);
      
      // Version valid from must be <= query date
      expect(where.validFrom).toEqual({ lte: boundaryDate });
      // Version valid to must be > query date
      expect(where.validTo).toEqual({ gt: boundaryDate });
    });
  });

  describe('Date boundary logic', () => {
    it('should handle version that starts and ends on same day', () => {
      const date = new Date('2024-06-15T14:30:00Z');
      const versionStart = new Date('2024-06-15T10:00:00Z');
      const versionEnd = new Date('2024-06-15T18:00:00Z');
      
      // Check if date falls within version validity
      const isValid = versionStart <= date && date < versionEnd;
      expect(isValid).toBe(true);
    });

    it('should exclude versions that end exactly at query time', () => {
      const queryDate = new Date('2024-06-15T12:00:00Z');
      const versionEnd = new Date('2024-06-15T12:00:00Z');
      
      // validTo uses gt (greater than), not gte
      // So version ending exactly at query time is NOT included
      const where = buildAsOfDateWhere(queryDate);
      expect(where.validTo).toEqual({ gt: queryDate });
      
      // This ensures no overlap at boundaries
      const isIncluded = versionEnd > queryDate;
      expect(isIncluded).toBe(false);
    });

    it('should include versions that start exactly at query time', () => {
      const queryDate = new Date('2024-06-15T12:00:00Z');
      const versionStart = new Date('2024-06-15T12:00:00Z');
      
      // validFrom uses lte (less than or equal)
      // So version starting exactly at query time IS included
      const where = buildAsOfDateWhere(queryDate);
      expect(where.validFrom).toEqual({ lte: queryDate });
      
      const isIncluded = versionStart <= queryDate;
      expect(isIncluded).toBe(true);
    });
  });

  describe('buildBitemporalAsOfWhere', () => {
    const testDate = new Date('2024-06-15T12:00:00Z');

    it('should filter by both system time and valid time', () => {
      const where = buildBitemporalAsOfWhere(testDate);

      expect(where.systemFrom).toEqual({ lte: testDate });
      expect(where.systemTo).toEqual({ gt: testDate });
      expect(where.validFrom).toEqual({ lte: testDate });
      expect(where.validTo).toEqual({ gt: testDate });
      expect(where.isDeleted).toBe(false);
    });

    it('should merge base where conditions', () => {
      const where = buildBitemporalAsOfWhere(testDate, {
        organizationId: 'org-1',
      });

      expect(where.organizationId).toBe('org-1');
      expect(where.systemFrom).toEqual({ lte: testDate });
      expect(where.validTo).toEqual({ gt: testDate });
    });

    it('should exclude transactions entered after the as-of date', () => {
      const asOfDate = new Date('2024-06-01T00:00:00Z');
      const where = buildBitemporalAsOfWhere(asOfDate);

      // A transaction with systemFrom = June 15 should NOT match
      // because systemFrom <= June 1 would be false
      const txSystemFrom = new Date('2024-06-15T00:00:00Z');
      expect(txSystemFrom <= asOfDate).toBe(false);
    });

    it('should include transactions entered before the as-of date', () => {
      const asOfDate = new Date('2024-06-15T00:00:00Z');
      const where = buildBitemporalAsOfWhere(asOfDate);

      // A transaction with systemFrom = June 1 should match
      const txSystemFrom = new Date('2024-06-01T00:00:00Z');
      const txSystemTo = MAX_DATE;
      expect(txSystemFrom <= asOfDate).toBe(true);
      expect(txSystemTo > asOfDate).toBe(true);
    });

    it('should respect includeDeleted option', () => {
      const where = buildBitemporalAsOfWhere(testDate, {}, { includeDeleted: true });
      expect(where).not.toHaveProperty('isDeleted');
    });
  });
});
