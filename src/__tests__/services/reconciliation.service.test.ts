/**
 * Reconciliation Service Tests
 *
 * Tests the auto-matching algorithm and reconciliation lifecycle:
 * - Exact matching (amount + date + reference)
 * - Fuzzy matching (amount + date within tolerance)
 * - No false positives when amounts don't match
 * - Manual match/unmatch/skip operations
 * - Complete reconciliation flow
 */

import { prisma } from '@/lib/prisma';
import { MAX_DATE } from '@/lib/temporal/temporal-utils';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bankAccount: { findUnique: jest.fn() },
    bankStatementLine: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bankStatementLineMatch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    bankStatement: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import {
  autoMatchStatement,
  manualMatch,
  unmatchLine,
  skipLine,
  removeMatch,
} from '@/services/reconciliation.service';

// ── Test Data ───────────────────────────────────────────────────────────

const bankAccount = {
  id: 'ba-1',
  accountId: 'acct-checking',
  organizationId: 'org-1',
};

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    bankStatementId: 'stmt-1',
    transactionDate: new Date('2026-01-15T12:00:00'),
    description: 'Electric Company',
    referenceNumber: 'CHK1234',
    amount: -150,
    status: 'UNMATCHED',
    ...overrides,
  };
}

function makeTxn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn-1',
    versionId: 'v-txn-1',
    transactionDate: new Date('2026-01-15T12:00:00'),
    description: 'Electric Bill Payment',
    referenceNumber: 'CHK1234',
    amount: 150,
    debitAccountId: 'acct-expense',
    creditAccountId: 'acct-checking',
    reconciled: false,
    validTo: MAX_DATE,
    systemTo: MAX_DATE,
    isDeleted: false,
    ...overrides,
  };
}

// ── Auto-Matching ──────────────────────────────────────────────────────

describe('autoMatchStatement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(bankAccount);
    (prisma.bankStatementLineMatch.create as jest.Mock).mockResolvedValue({});
  });

  it('should find exact match when amount, date, and reference all match', async () => {
    const line = makeLine();
    const txn = makeTxn();

    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([line]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([txn]);
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({});

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    expect(result.exactMatches).toBe(1);
    expect(result.fuzzyMatches).toBe(0);
    expect(result.unmatched).toBe(0);
    expect(result.matches[0].confidence).toBe('AUTO_EXACT');
    expect(result.matches[0].transactionId).toBe('txn-1');
  });

  it('should find fuzzy match when amount matches but date differs by 2 days', async () => {
    const line = makeLine({ referenceNumber: null });
    const txn = makeTxn({
      referenceNumber: null,
      transactionDate: new Date('2026-01-17T12:00:00'), // 2 days later
    });

    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([line]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([txn]);
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({});

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    expect(result.exactMatches).toBe(0);
    expect(result.fuzzyMatches).toBe(1);
    expect(result.matches[0].confidence).toBe('AUTO_FUZZY');
  });

  it('should not match when amounts differ', async () => {
    const line = makeLine({ amount: -150 });
    const txn = makeTxn({ amount: 200 }); // different amount

    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([line]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([txn]);

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    expect(result.exactMatches).toBe(0);
    expect(result.fuzzyMatches).toBe(0);
    expect(result.unmatched).toBe(1);
  });

  it('should not match when date exceeds tolerance', async () => {
    const line = makeLine({ referenceNumber: null });
    const txn = makeTxn({
      referenceNumber: null,
      transactionDate: new Date('2026-01-25T12:00:00'), // 10 days later — too far
    });

    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([line]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([txn]);

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    expect(result.unmatched).toBe(1);
    expect(result.matches).toHaveLength(0);
  });

  it('should not double-match the same transaction', async () => {
    const line1 = makeLine({ id: 'line-1', amount: -100, referenceNumber: null });
    const line2 = makeLine({ id: 'line-2', amount: -100, referenceNumber: null });
    const txn = makeTxn({ amount: 100, referenceNumber: null });

    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([line1, line2]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([txn]);
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({});

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    // Only one should match — the other remains unmatched
    expect(result.matches).toHaveLength(1);
    expect(result.unmatched).toBe(1);
  });

  it('should return empty results when no unmatched lines exist', async () => {
    (prisma.bankStatementLine.findMany as jest.Mock).mockResolvedValue([]);

    const result = await autoMatchStatement('stmt-1', 'ba-1', 'org-1');

    expect(result.total).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  it('should throw when bank account not found', async () => {
    (prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(autoMatchStatement('stmt-1', 'ba-1', 'org-1'))
      .rejects.toThrow('Bank account not found');
  });
});

// ── Manual Operations ──────────────────────────────────────────────────

describe('manualMatch', () => {
  it('should create match entries and update line status', async () => {
    (prisma.bankStatementLine.findUnique as jest.Mock).mockResolvedValue({
      id: 'line-1',
      amount: '100.00',
    });
    (prisma.bankStatementLineMatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bankStatementLineMatch.create as jest.Mock).mockResolvedValue({
      id: 'match-1',
      lineId: 'line-1',
      transactionId: 'txn-1',
      amount: 100,
    });
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({
      id: 'line-1',
      matchConfidence: 'MANUAL',
      status: 'MATCHED',
    });

    const result = await manualMatch('line-1', [{ transactionId: 'txn-1', amount: 100 }]);

    expect(prisma.bankStatementLineMatch.create).toHaveBeenCalledWith({
      data: {
        lineId: 'line-1',
        transactionId: 'txn-1',
        amount: 100,
        confidence: 'MANUAL',
      },
    });
    expect(result.status).toBe('MATCHED');
  });

  it('should mark as UNMATCHED when partially matched', async () => {
    (prisma.bankStatementLine.findUnique as jest.Mock).mockResolvedValue({
      id: 'line-1',
      amount: '500.00',
    });
    (prisma.bankStatementLineMatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bankStatementLineMatch.create as jest.Mock).mockResolvedValue({});
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({
      id: 'line-1',
      matchConfidence: 'MANUAL',
      status: 'UNMATCHED',
    });

    const result = await manualMatch('line-1', [{ transactionId: 'txn-1', amount: 200 }]);

    expect(result.status).toBe('UNMATCHED');
  });

  it('should reject if total exceeds line amount', async () => {
    (prisma.bankStatementLine.findUnique as jest.Mock).mockResolvedValue({
      id: 'line-1',
      amount: '100.00',
    });
    (prisma.bankStatementLineMatch.findMany as jest.Mock).mockResolvedValue([
      { id: 'existing', amount: '80.00' },
    ]);

    await expect(
      manualMatch('line-1', [{ transactionId: 'txn-2', amount: 30 }])
    ).rejects.toThrow('exceeds line amount');
  });
});

describe('unmatchLine', () => {
  it('should delete all matches and reset to UNMATCHED', async () => {
    (prisma.bankStatementLineMatch.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({
      id: 'line-1',
      matchConfidence: 'UNMATCHED',
      status: 'UNMATCHED',
    });

    await unmatchLine('line-1');

    expect(prisma.bankStatementLineMatch.deleteMany).toHaveBeenCalledWith({
      where: { lineId: 'line-1' },
    });
    expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: {
        matchConfidence: 'UNMATCHED',
        status: 'UNMATCHED',
      },
    });
  });
});

describe('skipLine', () => {
  it('should mark line as SKIPPED with notes', async () => {
    (prisma.bankStatementLine.update as jest.Mock).mockResolvedValue({
      id: 'line-1',
      status: 'SKIPPED',
      notes: 'Bank fee — no matching RadBooks entry',
    });

    await skipLine('line-1', 'Bank fee — no matching RadBooks entry');

    expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: {
        status: 'SKIPPED',
        notes: 'Bank fee — no matching RadBooks entry',
      },
    });
  });
});
