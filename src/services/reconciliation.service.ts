/**
 * Reconciliation Service
 *
 * Auto-matching engine and reconciliation lifecycle management.
 * Matches bank statement lines against RadBooks ledger transactions.
 * Supports many-to-many matching (split deposits, combined entries).
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';
import type { BankStatementLine } from '@/generated/prisma/client';

// ── Types ───────────────────────────────────────────────────────────────

export interface MatchResult {
  statementLineId: string;
  transactionId: string;
  amount: number;
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
  const setA = new Set(na.split(''));
  const setB = new Set(nb.split(''));
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function amountsMatch(statementAmount: number, txnAmount: number): boolean {
  return Math.abs(Math.abs(statementAmount) - Math.abs(txnAmount)) < 0.01;
}

/**
 * Get the remaining unmatched amount for a statement line.
 */
async function getUnmatchedAmount(lineId: string, lineAmount: number): Promise<number> {
  const existingMatches = await prisma.bankStatementLineMatch.findMany({
    where: { lineId },
  });
  const matchedTotal = existingMatches.reduce((sum, m) => sum + Number(m.amount), 0);
  return Math.abs(lineAmount) - matchedTotal;
}

/**
 * Run auto-matching for a bank statement.
 * Auto-match only creates 1:1 full-amount matches. Split/combine matching is manual only.
 */
export async function autoMatchStatement(
  statementId: string,
  bankAccountId: string,
  organizationId: string
): Promise<AutoMatchSummary> {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
  });
  if (!bankAccount) throw new Error('Bank account not found');

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

  const dates = unmatchedLines.map((l) => l.transactionDate.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  minDate.setDate(minDate.getDate() - FUZZY_DATE_TOLERANCE_DAYS);
  maxDate.setDate(maxDate.getDate() + FUZZY_DATE_TOLERANCE_DAYS);

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
          amount: Math.abs(lineAmount),
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
        amount: Math.abs(lineAmount),
        confidence: 'AUTO_FUZZY',
        reason: `Fuzzy match: amount matches, date within ${FUZZY_DATE_TOLERANCE_DAYS} days (score: ${bestMatch.score.toFixed(2)})`,
      });
      matchedTxnIds.add(bestMatch.txn.id);
    }
  }

  // Apply matches to database via join table
  for (const match of matches) {
    await prisma.bankStatementLineMatch.create({
      data: {
        lineId: match.statementLineId,
        transactionId: match.transactionId,
        amount: match.amount,
        confidence: match.confidence,
      },
    });

    await prisma.bankStatementLine.update({
      where: { id: match.statementLineId },
      data: {
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
 * Manually match a statement line to one or more transactions.
 * Supports partial amounts for split matching.
 */
export async function manualMatch(
  lineId: string,
  matchEntries: { transactionId: string; amount: number }[]
): Promise<BankStatementLine> {
  const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId } });
  if (!line) throw new Error('Statement line not found');

  const lineAmount = Math.abs(Number(line.amount));

  // Validate total matched doesn't exceed line amount
  const existingMatches = await prisma.bankStatementLineMatch.findMany({
    where: { lineId },
  });
  const existingTotal = existingMatches.reduce((sum, m) => sum + Number(m.amount), 0);
  const newTotal = matchEntries.reduce((sum, e) => sum + e.amount, 0);

  if (existingTotal + newTotal > lineAmount + 0.01) {
    throw new Error(
      `Total matched amount ($${(existingTotal + newTotal).toFixed(2)}) exceeds line amount ($${lineAmount.toFixed(2)})`
    );
  }

  // Create match entries
  for (const entry of matchEntries) {
    await prisma.bankStatementLineMatch.create({
      data: {
        lineId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        confidence: 'MANUAL',
      },
    });
  }

  // Update line status based on whether fully matched
  const totalMatched = existingTotal + newTotal;
  const fullyMatched = Math.abs(totalMatched - lineAmount) < 0.01;

  return prisma.bankStatementLine.update({
    where: { id: lineId },
    data: {
      matchConfidence: 'MANUAL',
      status: fullyMatched ? 'MATCHED' : 'UNMATCHED',
    },
  });
}

/**
 * Remove a specific match from a statement line.
 */
export async function removeMatch(matchId: string): Promise<BankStatementLine> {
  const match = await prisma.bankStatementLineMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new Error('Match not found');

  await prisma.bankStatementLineMatch.delete({ where: { id: matchId } });

  // Check remaining matches
  const remaining = await prisma.bankStatementLineMatch.findMany({
    where: { lineId: match.lineId },
  });

  const line = await prisma.bankStatementLine.findUnique({ where: { id: match.lineId } });
  if (!line) throw new Error('Line not found');

  const lineAmount = Math.abs(Number(line.amount));
  const remainingTotal = remaining.reduce((sum, m) => sum + Number(m.amount), 0);

  return prisma.bankStatementLine.update({
    where: { id: match.lineId },
    data: {
      matchConfidence: remaining.length > 0 ? line.matchConfidence : 'UNMATCHED',
      status: remaining.length === 0
        ? 'UNMATCHED'
        : Math.abs(remainingTotal - lineAmount) < 0.01
          ? 'MATCHED'
          : 'UNMATCHED',
    },
  });
}

/**
 * Unmatch all matches from a statement line.
 */
export async function unmatchLine(lineId: string): Promise<BankStatementLine> {
  await prisma.bankStatementLineMatch.deleteMany({ where: { lineId } });

  return prisma.bankStatementLine.update({
    where: { id: lineId },
    data: {
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
    include: {
      lines: {
        include: { matches: true },
      },
    },
  });

  if (!statement) throw new Error('Statement not found');
  if (statement.status === 'COMPLETED') throw new Error('Statement already reconciled');

  const matchedLines = statement.lines.filter(
    (l) => l.status === 'MATCHED' && l.matches.length > 0
  );

  const now = new Date();
  const reconciledTxnIds = new Set<string>();

  // Mark all matched transactions as reconciled (temporal: close + create new version)
  for (const line of matchedLines) {
    for (const match of line.matches) {
      if (reconciledTxnIds.has(match.transactionId)) continue;

      const txn = await prisma.transaction.findFirst({
        where: buildCurrentVersionWhere({ id: match.transactionId }),
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
        reconciledTxnIds.add(match.transactionId);
      }
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

  return { reconciledCount: reconciledTxnIds.size };
}
