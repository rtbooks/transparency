/**
 * Temporal Immutability Tests
 *
 * Validates that:
 * 1. The migration SQL exists and covers all 6 bitemporal tables
 * 2. The trigger function only allows temporal closing fields to be updated
 * 3. The application code no longer uses direct .update() on bitemporal tables
 *    (all mutations go through closeVersion + create or updateMany with temporal fields)
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Migration SQL Validation ───────────────────────────────────────────

describe('Temporal Immutability Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260225070000_add_temporal_immutability_triggers/migration.sql'
  );
  let migrationSql: string;

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('should create the shared trigger function', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION enforce_temporal_immutability()');
    expect(migrationSql).toContain('RETURNS TRIGGER');
  });

  const bitemporalTables = [
    'organizations',
    'organization_users',
    'accounts',
    'transactions',
    'program_spending',
    'contacts',
  ];

  it.each(bitemporalTables)('should apply trigger to %s table', (table) => {
    expect(migrationSql).toContain(`BEFORE UPDATE ON ${table}`);
    expect(migrationSql).toContain(`trg_temporal_immutability_${table}`);
  });

  it('should only allow temporal closing fields to be updated', () => {
    // The trigger allows these 5 columns to change
    expect(migrationSql).toContain("'valid_to'");
    expect(migrationSql).toContain("'system_to'");
    expect(migrationSql).toContain("'is_deleted'");
    expect(migrationSql).toContain("'deleted_at'");
    expect(migrationSql).toContain("'deleted_by'");
  });

  it('should raise an exception when non-temporal columns are modified', () => {
    expect(migrationSql).toContain('RAISE EXCEPTION');
    expect(migrationSql).toContain('Temporal immutability violation');
  });
});

// ── Application Code Compliance ────────────────────────────────────────

describe('Application Code Temporal Compliance', () => {
  const srcDir = path.join(process.cwd(), 'src');

  function findFiles(dir: string, ext: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'generated' && entry.name !== '__tests__') {
        results.push(...findFiles(fullPath, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  // These are the bitemporal Prisma model names (camelCase as used in prisma.X.update)
  const bitemporalModels = [
    'organization',
    'organizationUser',
    'account',
    'transaction',
    'programSpending',
    'contact',
  ];

  it('should not have direct .update() calls on bitemporal models in application code', () => {
    const tsFiles = findFiles(srcDir, '.ts').concat(findFiles(srcDir, '.tsx'));
    const violations: string[] = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const model of bitemporalModels) {
        // Match patterns like .organization.update( or tx.transaction.update(
        // but NOT .updateMany( which is used for temporal closing
        const pattern = new RegExp(`\\.${model}\\.update\\(`, 'g');
        const matches = content.match(pattern);
        if (matches) {
          const relativePath = path.relative(process.cwd(), file);
          violations.push(`${relativePath}: ${model}.update() found ${matches.length} time(s)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
