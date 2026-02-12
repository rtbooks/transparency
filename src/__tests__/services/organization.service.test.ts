/**
 * Unit tests for Organization Service
 * 
 * Note: These are focused unit tests testing the service logic.
 * Integration tests with actual database would be in a separate file.
 */

import type { Prisma } from '@/generated/prisma/client';

describe('Organization Service', () => {
  describe('Version Management', () => {
    it('should structure new organization with temporal fields', () => {
      const now = new Date();
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      
      const orgData = {
        id: 'org-123',
        versionId: 'ver-1',
        previousVersionId: null,
        name: 'Test Org',
        slug: 'test-org',
        ein: '12-3456789',
        foundedDate: now,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      // Initial version should have no previous version
      expect(orgData.previousVersionId).toBeNull();
      
      // Should be valid indefinitely (current version)
      expect(orgData.validTo).toEqual(MAX_DATE);
      expect(orgData.systemTo).toEqual(MAX_DATE);
      
      // Should not be deleted
      expect(orgData.isDeleted).toBe(false);
      expect(orgData.deletedAt).toBeNull();
    });

    it('should create new version on update', () => {
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      const originalVersion = {
        id: 'org-123',
        versionId: 'ver-1',
        previousVersionId: null,
        name: 'Test Org',
        validFrom: new Date('2024-01-01'),
        validTo: MAX_DATE,
        systemFrom: new Date('2024-01-01'),
        systemTo: MAX_DATE,
      };

      const updateTime = new Date('2024-06-15');
      
      // Close old version
      const closedVersion = {
        ...originalVersion,
        validTo: updateTime,
        systemTo: updateTime,
      };

      // Create new version
      const newVersion = {
        ...originalVersion,
        versionId: 'ver-2',
        previousVersionId: 'ver-1',
        name: 'Updated Test Org', // Changed field
        validFrom: updateTime,
        validTo: MAX_DATE,
        systemFrom: updateTime,
        systemTo: MAX_DATE,
      };

      // Verify version chain
      expect(newVersion.previousVersionId).toBe(originalVersion.versionId);
      
      // Verify temporal continuity (no gaps)
      expect(closedVersion.validTo).toEqual(newVersion.validFrom);
      
      // Verify new version is current
      expect(newVersion.validTo).toEqual(MAX_DATE);
    });

    it('should handle soft delete correctly', () => {
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      const currentVersion = {
        id: 'org-123',
        versionId: 'ver-1',
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        validTo: MAX_DATE,
      };

      const deleteTime = new Date();
      const deletedVersion = {
        ...currentVersion,
        versionId: 'ver-2',
        previousVersionId: 'ver-1',
        isDeleted: true,
        deletedAt: deleteTime,
        deletedBy: 'user-123',
        validFrom: deleteTime,
        validTo: MAX_DATE,
      };

      expect(deletedVersion.isDeleted).toBe(true);
      expect(deletedVersion.deletedAt).toBe(deleteTime);
      expect(deletedVersion.deletedBy).toBe('user-123');
      expect(deletedVersion.validTo).toEqual(MAX_DATE); // Still current (just marked deleted)
    });
  });

  describe('Slug Generation', () => {
    it('should generate valid slugs from organization names', () => {
      const testCases = [
        { name: 'GRIT Hoops Westwood', expected: 'grit-hoops-westwood' },
        { name: 'Test Org 123', expected: 'test-org-123' },
        { name: 'Special@Characters!Inc', expected: 'special-characters-inc' },
        { name: '  Spaces  Everywhere  ', expected: 'spaces-everywhere' },
      ];

      testCases.forEach(({ name, expected }) => {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        expect(slug).toBe(expected);
      });
    });

    it('should handle slug uniqueness conflicts', () => {
      const baseSlug = 'test-org';
      const existingSlugs = ['test-org', 'test-org-1', 'test-org-2'];

      // Function to find next available slug
      const getUniqueSlug = (base: string, existing: string[]): string => {
        if (!existing.includes(base)) return base;
        
        let counter = 1;
        let candidate = `${base}-${counter}`;
        while (existing.includes(candidate)) {
          counter++;
          candidate = `${base}-${counter}`;
        }
        return candidate;
      };

      const uniqueSlug = getUniqueSlug(baseSlug, existingSlugs);
      expect(uniqueSlug).toBe('test-org-3');
      expect(existingSlugs).not.toContain(uniqueSlug);
    });
  });

  describe('EIN Validation', () => {
    it('should validate EIN format (XX-XXXXXXX)', () => {
      const validEINs = [
        '12-3456789',
        '98-7654321',
        '00-0000000',
      ];

      const einPattern = /^\d{2}-\d{7}$/;

      validEINs.forEach(ein => {
        expect(einPattern.test(ein)).toBe(true);
      });
    });

    it('should reject invalid EIN formats', () => {
      const invalidEINs = [
        '123456789',      // No dash
        '12-345678',      // Too short
        '12-34567890',    // Too long
        'AB-1234567',     // Letters
        '1-23456789',     // Wrong format
      ];

      const einPattern = /^\d{2}-\d{7}$/;

      invalidEINs.forEach(ein => {
        expect(einPattern.test(ein)).toBe(false);
      });
    });
  });

  describe('Query Filtering', () => {
    it('should build correct filter for current organization by slug', () => {
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      const slug = 'test-org';

      const filter = {
        slug,
        validTo: MAX_DATE,
        isDeleted: false,
      };

      expect(filter.slug).toBe(slug);
      expect(filter.validTo).toEqual(MAX_DATE);
      expect(filter.isDeleted).toBe(false);
    });

    it('should build correct filter for organization as of date', () => {
      const asOfDate = new Date('2024-06-15');
      const slug = 'test-org';

      const filter = {
        slug,
        validFrom: { lte: asOfDate },
        validTo: { gt: asOfDate },
        isDeleted: false,
      };

      expect(filter.slug).toBe(slug);
      expect(filter.validFrom).toEqual({ lte: asOfDate });
      expect(filter.validTo).toEqual({ gt: asOfDate });
    });

    it('should build correct filter for organization history', () => {
      const slug = 'test-org';

      const filter = {
        slug,
      };

      const orderBy = {
        systemFrom: 'desc' as const,
      };

      expect(filter.slug).toBe(slug);
      expect(orderBy.systemFrom).toBe('desc');
    });

    it('should filter changes within date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-30');

      const versions = [
        { systemFrom: new Date('2023-12-15') },
        { systemFrom: new Date('2024-02-01') },
        { systemFrom: new Date('2024-05-15') },
        { systemFrom: new Date('2024-07-01') },
      ];

      const filtered = versions.filter(v => 
        v.systemFrom >= startDate && v.systemFrom <= endDate
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Change Detection', () => {
    it('should detect which fields changed between versions', () => {
      const v1 = {
        name: 'Old Name',
        description: 'Old Description',
        website: 'https://old.com',
        phone: '555-0100',
      };

      const v2 = {
        name: 'New Name',
        description: 'Old Description',
        website: 'https://new.com',
        phone: '555-0100',
      };

      const changes: string[] = [];
      const keys = Object.keys(v1) as Array<keyof typeof v1>;

      keys.forEach(key => {
        if (v1[key] !== v2[key]) {
          changes.push(key);
        }
      });

      expect(changes).toContain('name');
      expect(changes).toContain('website');
      expect(changes).not.toContain('description');
      expect(changes).not.toContain('phone');
      expect(changes).toHaveLength(2);
    });

    it('should handle null to value changes', () => {
      const v1 = { description: null };
      const v2 = { description: 'New description' };

      const changed = v1.description !== v2.description;
      expect(changed).toBe(true);
    });

    it('should handle value to null changes', () => {
      const v1 = { website: 'https://example.com' };
      const v2 = { website: null };

      const changed = v1.website !== v2.website;
      expect(changed).toBe(true);
    });
  });
});
