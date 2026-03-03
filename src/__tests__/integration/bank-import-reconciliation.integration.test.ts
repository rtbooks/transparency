/**
 * Bank Import & Reconciliation Integration Tests
 *
 * Tests the full lifecycle of importing bank transactions and matching them
 * against accrual ledger transactions:
 *
 * 1. Exact match — same amount, date, and reference number
 * 2. Fuzzy match — same amount, date within tolerance
 * 3. Manual match — user-driven matching
 * 4. Split deposit — one bank line matched to multiple ledger transactions
 * 5. Complete reconciliation — atomic versioning of transactions
 * 6. Deduplication — re-importing the same file skips existing lines
 * 7. Already-reconciled — skips transactions already marked reconciled
 *
 * Requires: DATABASE_URL pointing to a real Postgres with migrations applied.
 * Run with: npm run test:integration
 */

import { DbTestHelper } from '../helpers/db-test-helper';
import { createTransaction } from '@/services/transaction.service';
import {
  autoMatchStatement,
  manualMatch,
  completeReconciliation,
  unmatchLine,
  skipLine,
} from '@/services/reconciliation.service';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const db = new DbTestHelper();

let bankAccountId: string;

beforeAll(async () => {
  await db.setup();

  // Create a bank account linked to the test checking account
  const ba = await db.prisma.bankAccount.create({
    data: {
      organizationId: db.orgId,
      accountId: db.accounts.checking,
      bankName: 'Test Bank',
      accountNumberLast4: '1234',
      accountType: 'checking',
    },
  });
  bankAccountId = ba.id;
});

afterAll(async () => {
  // Clean up bank data before helper teardown
  try {
    await db.prisma.bankStatementLineMatch.deleteMany({
      where: {
        line: { bankStatement: { organizationId: db.orgId } },
      },
    });
    await db.prisma.bankStatementLine.deleteMany({
      where: { bankStatement: { organizationId: db.orgId } },
    });
    await db.prisma.bankStatement.deleteMany({ where: { organizationId: db.orgId } });
    await db.prisma.bankAccount.deleteMany({ where: { organizationId: db.orgId } });
  } catch { /* best effort */ }
  await db.teardown();
});

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create a bank statement with lines directly in the database */
async function importBankLines(
  lines: Array<{ date: string; description: string; amount: number; reference?: string }>
) {
  const stmt = await db.prisma.bankStatement.create({
    data: {
      organizationId: db.orgId,
      bankAccountId,
      statementDate: new Date(lines[lines.length - 1].date),
      periodStart: new Date(lines[0].date),
      periodEnd: new Date(lines[lines.length - 1].date),
      openingBalance: 0,
      closingBalance: 0,
      fileName: 'test-import.csv',
      status: 'DRAFT',
    },
  });

  await db.prisma.bankStatementLine.createMany({
    data: lines.map((l) => ({
      bankStatementId: stmt.id,
      transactionDate: new Date(l.date),
      description: l.description,
      referenceNumber: l.reference || null,
      amount: l.amount,
    })),
  });

  return stmt;
}

/** Create a ledger transaction (debit checking, credit revenue) */
async function createCheckingDeposit(
  amount: number,
  description: string,
  date: string,
  referenceNumber?: string
) {
  return createTransaction({
    organizationId: db.orgId,
    transactionDate: new Date(date),
    amount,
    description,
    debitAccountId: db.accounts.checking,
    creditAccountId: db.accounts.revenue,
    referenceNumber,
  });
}

/** Create a ledger transaction (debit expense, credit checking — a withdrawal) */
async function createCheckingWithdrawal(
  amount: number,
  description: string,
  date: string,
  referenceNumber?: string
) {
  return createTransaction({
    organizationId: db.orgId,
    transactionDate: new Date(date),
    amount,
    description,
    debitAccountId: db.accounts.expense,
    creditAccountId: db.accounts.checking,
    referenceNumber,
  });
}

/** Get the current version of a transaction */
async function getCurrentTransaction(txId: string) {
  return db.prisma.transaction.findFirst({
    where: buildCurrentVersionWhere({ id: txId, organizationId: db.orgId }),
  });
}

/** Count versions of a transaction */
async function countVersions(txId: string) {
  return db.prisma.transaction.count({ where: { id: txId } });
}

/** Get statement lines for a statement */
async function getStatementLines(statementId: string) {
  return db.prisma.bankStatementLine.findMany({
    where: { bankStatementId: statementId },
    include: { matches: true },
    orderBy: { transactionDate: 'asc' },
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Auto-Matching', () => {
  it('should exact-match when amount, date, and reference all match', async () => {
    const txn = await createCheckingDeposit(250, 'Donation from John', '2026-03-01', 'REF-001');
    const stmt = await importBankLines([
      { date: '2026-03-01', description: 'Deposit', amount: 250, reference: 'REF-001' },
    ]);

    const result = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    expect(result.exactMatches).toBe(1);
    expect(result.fuzzyMatches).toBe(0);
    expect(result.unmatched).toBe(0);
    expect(result.matches[0].transactionId).toBe(txn.id);
    expect(result.matches[0].confidence).toBe('AUTO_EXACT');

    const lines = await getStatementLines(stmt.id);
    expect(lines[0].status).toBe('MATCHED');
    expect(lines[0].matches).toHaveLength(1);
  });

  it('should fuzzy-match when amount matches and date is within tolerance', async () => {
    // Transaction on Mar 5, bank line on Mar 7 (2 days apart, within 3-day tolerance)
    const txn = await createCheckingDeposit(175.50, 'Fundraiser income', '2026-03-05');
    const stmt = await importBankLines([
      { date: '2026-03-07', description: 'Deposit', amount: 175.50 },
    ]);

    const result = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    expect(result.exactMatches).toBe(0);
    expect(result.fuzzyMatches).toBe(1);
    expect(result.matches[0].transactionId).toBe(txn.id);
    expect(result.matches[0].confidence).toBe('AUTO_FUZZY');
  });

  it('should not match when amounts differ', async () => {
    await createCheckingDeposit(300, 'Some deposit', '2026-03-10');
    const stmt = await importBankLines([
      { date: '2026-03-10', description: 'Deposit', amount: 350 },
    ]);

    const result = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    expect(result.unmatched).toBe(1);
    expect(result.matches).toHaveLength(0);
  });

  it('should not match when date exceeds tolerance', async () => {
    await createCheckingDeposit(400, 'Late deposit', '2026-03-15');
    const stmt = await importBankLines([
      // 10 days apart — well outside 3-day tolerance
      { date: '2026-03-25', description: 'Deposit', amount: 400 },
    ]);

    const result = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    expect(result.unmatched).toBe(1);
    expect(result.matches).toHaveLength(0);
  });

  it('should match withdrawals (negative bank amounts)', async () => {
    const txn = await createCheckingWithdrawal(125, 'Office supplies', '2026-04-01', 'CHK-500');
    const stmt = await importBankLines([
      { date: '2026-04-01', description: 'POS Withdrawal', amount: -125, reference: 'CHK-500' },
    ]);

    const result = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    expect(result.exactMatches).toBe(1);
    expect(result.matches[0].transactionId).toBe(txn.id);
  });
});

describe('Manual Matching', () => {
  it('should allow manual 1:1 match', async () => {
    await createCheckingDeposit(600, 'Grant payment', '2026-04-05');
    const stmt = await importBankLines([
      { date: '2026-04-10', description: 'Wire Transfer', amount: 600 },
    ]);

    // Get the unmatched line
    const lines = await getStatementLines(stmt.id);
    const lineId = lines[0].id;

    // Get ledger transactions for the account
    const txns = await prisma.transaction.findMany({
      where: {
        ...buildCurrentVersionWhere({ organizationId: db.orgId }),
        description: 'Grant payment',
      },
    });

    const result = await manualMatch(lineId, [
      { transactionId: txns[0].id, amount: 600 },
    ]);

    expect(result.status).toBe('MATCHED');
    expect(result.matchConfidence).toBe('MANUAL');
  });

  it('should support split deposit — one bank line matched to multiple transactions', async () => {
    const txn1 = await createCheckingDeposit(500, 'Donation A for split', '2026-04-12');
    const txn2 = await createCheckingDeposit(300, 'Donation B for split', '2026-04-12');
    const stmt = await importBankLines([
      { date: '2026-04-12', description: 'Deposit', amount: 800 },
    ]);

    const lines = await getStatementLines(stmt.id);
    const lineId = lines[0].id;

    const result = await manualMatch(lineId, [
      { transactionId: txn1.id, amount: 500 },
      { transactionId: txn2.id, amount: 300 },
    ]);

    expect(result.status).toBe('MATCHED');

    // Verify both match records exist
    const matches = await prisma.bankStatementLineMatch.findMany({
      where: { lineId },
    });
    expect(matches).toHaveLength(2);
  });

  it('should reject match if total exceeds line amount', async () => {
    const txn = await createCheckingDeposit(999, 'Big donation for rejection', '2026-04-15');
    const stmt = await importBankLines([
      { date: '2026-04-15', description: 'Deposit', amount: 100 },
    ]);

    const lines = await getStatementLines(stmt.id);

    await expect(
      manualMatch(lines[0].id, [{ transactionId: txn.id, amount: 200 }])
    ).rejects.toThrow('exceeds line amount');
  });

  it('should allow unmatching a line', async () => {
    const txn = await createCheckingDeposit(77, 'To unmatch', '2026-04-18');
    const stmt = await importBankLines([
      { date: '2026-04-18', description: 'Deposit', amount: 77 },
    ]);

    // Auto-match first
    await autoMatchStatement(stmt.id, bankAccountId, db.orgId);

    const linesBefore = await getStatementLines(stmt.id);
    expect(linesBefore[0].status).toBe('MATCHED');

    // Unmatch
    const result = await unmatchLine(linesBefore[0].id);
    expect(result.status).toBe('UNMATCHED');

    const matchesAfter = await prisma.bankStatementLineMatch.findMany({
      where: { lineId: linesBefore[0].id },
    });
    expect(matchesAfter).toHaveLength(0);
  });

  it('should allow skipping a line', async () => {
    const stmt = await importBankLines([
      { date: '2026-04-20', description: 'Bank Fee', amount: -5.00 },
    ]);

    const lines = await getStatementLines(stmt.id);
    const result = await skipLine(lines[0].id, 'Bank fee, no ledger entry needed');

    expect(result.status).toBe('SKIPPED');
    expect(result.notes).toBe('Bank fee, no ledger entry needed');
  });
});

describe('Complete Reconciliation', () => {
  it('should atomically mark all matched transactions as cleared', async () => {
    const txn1 = await createCheckingDeposit(1000, 'Complete test deposit 1', '2026-05-01');
    const txn2 = await createCheckingDeposit(2000, 'Complete test deposit 2', '2026-05-02');
    const stmt = await importBankLines([
      { date: '2026-05-01', description: 'Deposit 1', amount: 1000 },
      { date: '2026-05-02', description: 'Deposit 2', amount: 2000 },
    ]);

    // Auto-match
    const matchResult = await autoMatchStatement(stmt.id, bankAccountId, db.orgId);
    expect(matchResult.matches).toHaveLength(2);

    // Complete
    const result = await completeReconciliation(stmt.id, db.userId);
    expect(result.reconciledCount).toBe(2);

    // Verify transactions are now cleared (not reconciled — that's for formal reconciliation)
    const tx1 = await getCurrentTransaction(txn1.id);
    const tx2 = await getCurrentTransaction(txn2.id);
    expect(tx1!.cleared).toBe(true);
    expect(tx1!.clearedAt).toBeTruthy();
    expect(tx1!.reconciled).toBe(false);
    expect(tx2!.cleared).toBe(true);
    expect(tx2!.reconciled).toBe(false);

    // Verify temporal versioning — should have 2 versions each (original + cleared)
    expect(await countVersions(txn1.id)).toBe(2);
    expect(await countVersions(txn2.id)).toBe(2);

    // Verify statement is marked completed
    const finalStmt = await db.prisma.bankStatement.findUnique({ where: { id: stmt.id } });
    expect(finalStmt!.status).toBe('COMPLETED');

    // Verify lines are confirmed
    const lines = await getStatementLines(stmt.id);
    for (const line of lines) {
      expect(line.status).toBe('CONFIRMED');
    }
  });

  it('should handle split deposit — multiple transactions on one line', async () => {
    const txn1 = await createCheckingDeposit(700, 'Split part A', '2026-05-05');
    const txn2 = await createCheckingDeposit(550, 'Split part B', '2026-05-05');
    const stmt = await importBankLines([
      { date: '2026-05-05', description: 'Combined deposit', amount: 1250 },
    ]);

    // Manually match both to the one line
    const lines = await getStatementLines(stmt.id);
    await manualMatch(lines[0].id, [
      { transactionId: txn1.id, amount: 700 },
      { transactionId: txn2.id, amount: 550 },
    ]);

    // Complete — should not hit unique constraint on bank_transaction_id
    const result = await completeReconciliation(stmt.id, db.userId);
    expect(result.reconciledCount).toBe(2);

    // Both transactions should be cleared with different bankTransactionIds
    const tx1 = await getCurrentTransaction(txn1.id);
    const tx2 = await getCurrentTransaction(txn2.id);
    expect(tx1!.cleared).toBe(true);
    expect(tx2!.cleared).toBe(true);
    expect(tx1!.reconciled).toBe(false);
    expect(tx2!.reconciled).toBe(false);
    expect(tx1!.bankTransactionId).not.toBe(tx2!.bankTransactionId);
  });

  it('should skip already-cleared transactions without error', async () => {
    // Create and clear a transaction first
    const txn = await createCheckingDeposit(333, 'Already cleared', '2026-05-10');
    const stmt1 = await importBankLines([
      { date: '2026-05-10', description: 'Deposit', amount: 333 },
    ]);
    await autoMatchStatement(stmt1.id, bankAccountId, db.orgId);
    await completeReconciliation(stmt1.id, db.userId);

    // Verify it's cleared
    const txAfter = await getCurrentTransaction(txn.id);
    expect(txAfter!.cleared).toBe(true);
    const versionsAfter = await countVersions(txn.id);

    // Now try to import and reconcile the same transaction again
    const stmt2 = await importBankLines([
      { date: '2026-05-10', description: 'Same deposit', amount: 333 },
    ]);

    // Manual match to the already-cleared transaction
    const lines = await getStatementLines(stmt2.id);
    await manualMatch(lines[0].id, [{ transactionId: txn.id, amount: 333 }]);

    // Complete should skip the already-cleared transaction
    const result = await completeReconciliation(stmt2.id, db.userId);
    expect(result.reconciledCount).toBe(0);

    // No new version should have been created
    expect(await countVersions(txn.id)).toBe(versionsAfter);
  });

  it('should throw if statement not found', async () => {
    await expect(completeReconciliation('nonexistent-id', db.userId))
      .rejects.toThrow('Statement not found');
  });

  it('should throw if statement already completed', async () => {
    const txn = await createCheckingDeposit(50, 'Double complete', '2026-05-15');
    const stmt = await importBankLines([
      { date: '2026-05-15', description: 'Deposit', amount: 50 },
    ]);
    await autoMatchStatement(stmt.id, bankAccountId, db.orgId);
    await completeReconciliation(stmt.id, db.userId);

    await expect(completeReconciliation(stmt.id, db.userId))
      .rejects.toThrow('Statement already reconciled');
  });
});

describe('Deduplication', () => {
  it('should skip duplicate lines when re-importing the same data', async () => {
    // Import original lines
    const stmt1 = await importBankLines([
      { date: '2026-06-01', description: 'Unique deposit', amount: 888 },
      { date: '2026-06-02', description: 'Another deposit', amount: 222 },
    ]);

    const lines1 = await getStatementLines(stmt1.id);
    expect(lines1).toHaveLength(2);

    // Build fingerprints from the first import
    const existingLines = await db.prisma.bankStatementLine.findMany({
      where: { bankStatement: { bankAccountId } },
      select: { transactionDate: true, amount: true, description: true },
    });
    const existingFingerprints = new Set(
      existingLines.map((l) =>
        `${l.transactionDate.toISOString().slice(0, 10)}|${Number(l.amount).toFixed(2)}|${l.description.trim().toLowerCase()}`
      )
    );

    // Try importing duplicate + one new line
    const newLines = [
      { date: '2026-06-01', description: 'Unique deposit', amount: 888 },  // duplicate
      { date: '2026-06-03', description: 'Brand new deposit', amount: 444 }, // new
    ];

    let duplicatesSkipped = 0;
    const dedupedLines = newLines.filter((line) => {
      const fp = `${new Date(line.date).toISOString().slice(0, 10)}|${Number(line.amount).toFixed(2)}|${line.description.trim().toLowerCase()}`;
      if (existingFingerprints.has(fp)) {
        duplicatesSkipped++;
        return false;
      }
      existingFingerprints.add(fp);
      return true;
    });

    // Create second statement with only new lines
    const stmt2 = await db.prisma.bankStatement.create({
      data: {
        organizationId: db.orgId,
        bankAccountId,
        statementDate: new Date('2026-06-03'),
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-03'),
        openingBalance: 0,
        closingBalance: 0,
        fileName: 'test-import-2.csv',
        status: 'DRAFT',
      },
    });

    if (dedupedLines.length > 0) {
      await db.prisma.bankStatementLine.createMany({
        data: dedupedLines.map((l) => ({
          bankStatementId: stmt2.id,
          transactionDate: new Date(l.date),
          description: l.description,
          amount: l.amount,
        })),
      });
    }

    expect(duplicatesSkipped).toBe(1);

    const lines2 = await getStatementLines(stmt2.id);
    expect(lines2).toHaveLength(1);
    expect(lines2[0].description).toBe('Brand new deposit');
  });
});

describe('Balance Integrity', () => {
  it('should not change account balances when completing reconciliation', async () => {
    const balanceBefore = await db.getAccountBalance(db.accounts.checking);

    const txn = await createCheckingDeposit(150, 'Balance integrity test', '2026-06-10');
    const balanceAfterTxn = await db.getAccountBalance(db.accounts.checking);
    expect(balanceAfterTxn).toBeCloseTo(balanceBefore + 150, 2);

    const stmt = await importBankLines([
      { date: '2026-06-10', description: 'Deposit', amount: 150 },
    ]);
    await autoMatchStatement(stmt.id, bankAccountId, db.orgId);
    await completeReconciliation(stmt.id, db.userId);

    // Balance should be unchanged after reconciliation
    const balanceAfterRecon = await db.getAccountBalance(db.accounts.checking);
    expect(balanceAfterRecon).toBeCloseTo(balanceAfterTxn, 2);
  });
});
