/**
 * Account tree and formatting utility tests
 *
 * Covers buildAccountTree, formatCurrency, isReimbursementTransaction,
 * formatTransactionAmount, and getAccountTypeInfo.
 */

import {
  buildAccountTree,
  formatCurrency,
  isReimbursementTransaction,
  formatTransactionAmount,
  getAccountTypeInfo,
} from '@/lib/utils/account-tree';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeAccount(overrides: Record<string, unknown>) {
  return {
    id: 'acct-1',
    versionId: 'v-1',
    organizationId: 'org-1',
    name: 'Test Account',
    code: '1000',
    type: 'ASSET',
    subType: null,
    description: null,
    parentAccountId: null,
    isSystemAccount: false,
    validFrom: new Date(),
    validTo: new Date('9999-12-31'),
    systemFrom: new Date(),
    systemTo: new Date('9999-12-31'),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    previousVersionId: null,
    changedBy: null,
    changeReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

// ── buildAccountTree ────────────────────────────────────────────────────

describe('buildAccountTree', () => {
  it('should return empty array for empty input', () => {
    expect(buildAccountTree([])).toEqual([]);
  });

  it('should create root nodes for accounts without parents', () => {
    const accounts = [
      makeAccount({ id: 'a1', code: '1000', name: 'Assets' }),
      makeAccount({ id: 'a2', code: '2000', name: 'Liabilities' }),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree).toHaveLength(2);
    expect(tree[0].code).toBe('1000');
    expect(tree[1].code).toBe('2000');
  });

  it('should nest children under their parent', () => {
    const accounts = [
      makeAccount({ id: 'root', code: '1000', name: 'Assets' }),
      makeAccount({ id: 'child', code: '1100', name: 'Checking', parentAccountId: 'root' }),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe('Checking');
  });

  it('should sort children by code numerically', () => {
    const accounts = [
      makeAccount({ id: 'root', code: '1000', name: 'Assets' }),
      makeAccount({ id: 'c2', code: '1200', name: 'Savings', parentAccountId: 'root' }),
      makeAccount({ id: 'c1', code: '1100', name: 'Checking', parentAccountId: 'root' }),
      makeAccount({ id: 'c3', code: '1050', name: 'Cash', parentAccountId: 'root' }),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree[0].children.map((c: any) => c.code)).toEqual(['1050', '1100', '1200']);
  });

  it('should treat orphans as root nodes', () => {
    const accounts = [
      makeAccount({ id: 'orphan', code: '3000', name: 'Orphan', parentAccountId: 'missing-parent' }),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Orphan');
  });

  it('should handle multiple nesting levels', () => {
    const accounts = [
      makeAccount({ id: 'root', code: '1000', name: 'Assets' }),
      makeAccount({ id: 'mid', code: '1100', name: 'Bank', parentAccountId: 'root' }),
      makeAccount({ id: 'leaf', code: '1110', name: 'Checking', parentAccountId: 'mid' }),
    ];
    const tree = buildAccountTree(accounts);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe('Checking');
  });
});

// ── formatCurrency ──────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('should format number as USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format string as USD', () => {
    expect(formatCurrency('99.99')).toBe('$99.99');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle Decimal-like objects with toString', () => {
    expect(formatCurrency({ toString: () => '500' })).toBe('$500.00');
  });

  it('should format negative numbers', () => {
    expect(formatCurrency(-42.5)).toBe('-$42.50');
  });
});

// ── isReimbursementTransaction ──────────────────────────────────────────

describe('isReimbursementTransaction', () => {
  it('should return true for EXPENSE type with EXPENSE credit account', () => {
    expect(isReimbursementTransaction('EXPENSE', 'EXPENSE')).toBe(true);
  });

  it('should return false for EXPENSE type with non-EXPENSE credit', () => {
    expect(isReimbursementTransaction('EXPENSE', 'ASSET')).toBe(false);
  });

  it('should return false for non-EXPENSE type', () => {
    expect(isReimbursementTransaction('JOURNAL', 'EXPENSE')).toBe(false);
    expect(isReimbursementTransaction('REVENUE', 'EXPENSE')).toBe(false);
  });

  it('should return false when credit account type is undefined', () => {
    expect(isReimbursementTransaction('EXPENSE', undefined)).toBe(false);
  });
});

// ── formatTransactionAmount ─────────────────────────────────────────────

describe('formatTransactionAmount', () => {
  it('should format regular amount without parentheses', () => {
    expect(formatTransactionAmount(100, 'JOURNAL')).toBe('$100.00');
  });

  it('should wrap reimbursements in parentheses', () => {
    expect(formatTransactionAmount(50, 'EXPENSE', 'EXPENSE')).toBe('($50.00)');
  });
});

// ── getAccountTypeInfo ──────────────────────────────────────────────────

describe('getAccountTypeInfo', () => {
  it('should return correct info for all standard types', () => {
    expect(getAccountTypeInfo('ASSET')).toEqual({ label: 'Asset', color: 'text-green-600' });
    expect(getAccountTypeInfo('LIABILITY')).toEqual({ label: 'Liability', color: 'text-red-600' });
    expect(getAccountTypeInfo('EQUITY')).toEqual({ label: 'Equity', color: 'text-blue-600' });
    expect(getAccountTypeInfo('REVENUE')).toEqual({ label: 'Revenue', color: 'text-emerald-600' });
    expect(getAccountTypeInfo('EXPENSE')).toEqual({ label: 'Expense', color: 'text-orange-600' });
  });

  it('should return gray fallback for unknown types', () => {
    expect(getAccountTypeInfo('UNKNOWN')).toEqual({ label: 'UNKNOWN', color: 'text-gray-600' });
  });
});
