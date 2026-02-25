/**
 * Reconciliation Service
 *
 * Auto-matching engine and reconciliation lifecycle management.
 * Matches bank statement lines against RadBooks ledger transactions.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';
import type { BankStatementLine } from '@/generated/prisma/client';

// ── Types ───────────────────────────────────────────────────────────────

export interface MatchResult {
  statementLineId: string;
  transactionId: string;
  confidence: 'AUTO_EXACT' | 'AUTO_FUZZY';
  reason: string;
}

export interface AutoMatchSummary {
  total: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatched: number;
  matches: MatchResult[];
}

interface LedgerTransaction {
  id: string;
  transactionDate: Date;
  amount: number;
  description: string;
  referenceNumber: string | null;
  debitAccountId: string;
  creditAccountId: string;
  reconciled: boolean;
}

// ── Matching Algorithm ──────────────────────────────────────────────────

const FUZZY_DATE_TOLERANCE_DAYS = 3;

function daysDiff(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function descriptionSimilarity(a: string, b: string): number {
  const na = normalizeDescription(a);
  const nb = normalizeDescription(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Simple character overlap score
  const setA = new Set(na.split(''));
  const setB = new Set(nb.split(''));
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Determine the effective amount for matching a statement line against a ledger transaction.
 * Bank statement: positive = deposit, negative = withdrawal.
 * RadBooks ledger: amount is always positive, direction determined by debit/credit accounts.
 *
 * A deposit matches a transaction where the bank account is the DEBIT side.
 * A withdrawal matches a transaction where the bank account is the CREDIT side.
 */
function amountsMatch(statementAmount: number, txnAmount: number): boolean {
  return Math.abs(Math.abs(statementAmount) - Math.abs(txnAmount)) < 0.01;
}

/**
 * Run auto-matching for a bank statement.
 * Finds unmatched statement lines and attempts to match them against
 * unreconciled ledger transactions for the same account and date range.
 */
export async function autoMatchStatement(
  statementId: string,
  bankAccountId: string,
  organizationId: string
): Promise<AutoMatchSummary> {
  // Get bank account to find the linked Chart of Accounts account ID
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
  });
  if (!bankAccount) throw new Error('Bank account not found');

  // Get unmatched statement lines
  const unmatchedLines = await prisma.bankStatementLine.findMany({
    where: {
      bankStatementId: statementId,
      status: 'UNMATCHED',
    },
    orderBy: { transactionDate: 'asc' },
  });

  if (unmatchedLines.length === 0) {
    return { total: 0, exactMatches: 0, fuzzyMatches: 0, unmatched: 0, matches: [] };
  }

  // Determine date range with tolerance
  const dates = unmatchedLines.map((l) => l.transactionDate.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  minDate.setDate(minDate.getDate() - FUZZY_DATE_TOLERANCE_DAYS);
  maxDate.setDate(maxDate.getDate() + FUZZY_DATE_TOLERANCE_DAYS);

  // Get unreconciled ledger transactions for this account in the date range
  const accountId = bankAccount.accountId;
  const ledgerTxns = await prisma.transaction.findMany({
    where: {
      ...buildCurrentVersionWhere({ organizationId }),
      reconciled: false,
      transactionDate: { gte: minDate, lte: maxDate },
      OR: [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ],
    },
  });

  const availableTxns: LedgerTransaction[] = ledgerTxns.map((t) => ({
    id: t.id,
    transactionDate: t.transactionDate,
    amount: Number(t.amount),
    description: t.description,
    referenceNumber: t.referenceNumber,
    debitAccountId: t.debitAccountId,
    creditAccountId: t.creditAccountId,
    reconciled: t.reconciled,
  }));

  const matchedTxnIds = new Set<string>();
  const matches: MatchResult[] = [];

  // Pass 1: Exact matches (amount + date + reference number)
  for (const line of unmatchedLines) {
    if (line.status !== 'UNMATCHED') continue;
    const lineAmount = Number(line.amount);

    for (const txn of availableTxns) {
      if (matchedTxnIds.has(txn.id)) continue;
      if (!amountsMatch(lineAmount, txn.amount)) continue;

      const sameDate = daysDiff(line.transactionDate, txn.transactionDate) < 1;
      const sameRef = line.referenceNumber && txn.referenceNumber &&
        line.referenceNumber.trim() === txn.referenceNumber.trim();

      if (sameDate && sameRef) {
        matches.push({
          statementLineId: line.id,
          transactionId: txn.id,
          confidence: 'AUTO_EXACT',
          reason: 'Exact match: amount, date, and reference number',
        });
        matchedTxnIds.add(txn.id);
        break;
      }
    }
  }

  const exactMatchedLineIds = new Set(matches.map((m) => m.statementLineId));

  // Pass 2: Fuzzy matches (amount + date within tolerance)
  for (const line of unmatchedLines) {
    if (exactMatchedLineIds.has(line.id)) continue;
    const lineAmount = Number(line.amount);

    let bestMatch: { txn: LedgerTransaction; score: number } | null = null;

    for (const txn of availableTxns) {
      if (matchedTxnIds.has(txn.id)) continue;
      if (!amountsMatch(lineAmount, txn.amount)) continue;

      const dateDiff = daysDiff(line.transactionDate, txn.transactionDate);
      if (dateDiff > FUZZY_DATE_TOLERANCE_DAYS) continue;

      // Score: closer date = higher score, description similarity bonus
      const dateScore = 1 - dateDiff / FUZZY_DATE_TOLERANCE_DAYS;
      const descScore = descriptionSimilarity(line.description, txn.description);
      const totalScore = dateScore * 0.6 + descScore * 0.4;

      if (!bestMatch || totalScore > bestMatch.score) {
        bestMatch = { txn, score: totalScore };
      }
    }

    if (bestMatch && bestMatch.score > 0.3) {
      matches.push({
        statementLineId: line.id,
        transactionId: bestMatch.txn.id,
        confidence: 'AUTO_FUZZY',
        reason: `Fuzzy match: amount matches, date within ${FUZZY_DATE_TOLERANCE_DAYS} days (score: ${bestMatch.score.toFixed(2)})`,
      });
      matchedTxnIds.add(bestMatch.txn.id);
    }
  }

  // Apply matches to database
  for (const match of matches) {
    await prisma.bankStatementLine.update({
      where: { id: match.statementLineId },
      data: {
        matchedTransactionId: match.transactionId,
        matchConfidence: match.confidence,
        status: 'MATCHED',
      },
    });
  }

  const exactCount = matches.filter((m) => m.confidence === 'AUTO_EXACT').length;
  const fuzzyCount = matches.filter((m) => m.confidence === 'AUTO_FUZZY').length;

  return {
    total: unmatchedLines.length,
    exactMatches: exactCount,
    fuzzyMatches: fuzzyCount,
    unmatched: unmatchedLines.length - exactCount - fuzzyCount,
    matches,
  };
}

/**
 * Manually match a statement line to a transaction.
 */
export async function manualMatch(
  lineId: string,
  transactionId: string
): Promise<BankStatementLine> {
  return prisma.bankStatementLine.update({
    where: { id: lineId },
    data: {
      matchedTransactionId: transactionId,
      matchConfidence: 'MANUAL',
      status: 'MATCHED',
    },
  });
}

/**
 * Unmatch a previously matched statement line.
 */
export async function unmatchLine(lineId: string): Promise<BankStatementLine> {
  return prisma.bankStatementLine.update({
    where: { id: lineId },
    data: {
      matchedTransactionId: null,
      matchConfidence: 'UNMATCHED',
      status: 'UNMATCHED',
    },
  });
}

/**
 * Skip a statement line (mark as intentionally unmatched).
 */
export async function skipLine(lineId: string, notes?: string): Promise<BankStatementLine> {
  return prisma.bankStatementLine.update({
    where: { id: lineId },
    data: {
      status: 'SKIPPED',
      notes: notes || null,
    },
  });
}

/**
 * Complete reconciliation: mark all matched transactions as reconciled.
 */
export async function completeReconciliation(
  statementId: string,
  userId: string
): Promise<{ reconciledCount: number }> {
  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: { lines: true },
  });

  if (!statement) throw new Error('Statement not found');
  if (statement.status === 'COMPLETED') throw new Error('Statement already reconciled');

  const matchedLines = statement.lines.filter(
    (l) => l.status === 'MATCHED' && l.matchedTransactionId
  );

  const now = new Date();

  // Mark all matched transactions as reconciled (temporal: close + create new version)
  for (const line of matchedLines) {
    const txn = await prisma.transaction.findFirst({
      where: buildCurrentVersionWhere({ id: line.matchedTransactionId! }),
    });

    if (txn && !txn.reconciled) {
      await closeVersion(prisma.transaction, txn.versionId, now, 'transaction');
      await prisma.transaction.create({
        data: buildNewVersionData(txn, {
          reconciled: true,
          reconciledAt: now,
          bankTransactionId: line.id,
        } as any, now, userId) as any,
      });
    }

    // Confirm the line
    await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: { status: 'CONFIRMED' },
    });
  }

  // Mark statement as completed
  await prisma.bankStatement.update({
    where: { id: statementId },
    data: {
      status: 'COMPLETED',
      reconciledBy: userId,
      reconciledAt: now,
    },
  });

  return { reconciledCount: matchedLines.length };
}
