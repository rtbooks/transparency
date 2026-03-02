/**
 * Account Reconciliation Service
 *
 * Implements the standard accounting reconciliation workflow:
 * 1. Start a reconciliation for an account + period with beginning/ending balances
 * 2. Toggle which transactions cleared during the period
 * 3. System computes: beginningBalance + sum(cleared net effects) should = endingBalance
 * 4. Complete when the difference is zero — marks cleared transactions as reconciled
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';

// ── Types ───────────────────────────────────────────────────────────────

export interface StartReconciliationInput {
  organizationId: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  beginningBalance: number;
  endingBalance: number;
  createdBy: string;
}

export interface ReconciliationDetail {
  id: string;
  organizationId: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  periodStart: Date;
  periodEnd: Date;
  beginningBalance: number;
  endingBalance: number;
  status: string;
  completedBy: string | null;
  completedAt: Date | null;
  clearedItems: ClearedItem[];
  availableTransactions: AvailableTransaction[];
  difference: number;
}

export interface ClearedItem {
  id: string; // ReconciliationItem.id
  transactionId: string;
  amount: number; // net effect on account
  transactionDate: Date;
  description: string;
  referenceNumber: string | null;
  type: string;
}

export interface AvailableTransaction {
  id: string; // Transaction.id
  transactionDate: Date;
  description: string;
  amount: number; // net effect on account
  type: string;
  referenceNumber: string | null;
  reconciled: boolean;
}

// ── Service Functions ───────────────────────────────────────────────────

/**
 * Compute the net effect of a transaction on a given account.
 * For asset/expense accounts: debits increase (+), credits decrease (-)
 * For liability/equity/revenue accounts: credits increase (+), debits decrease (-)
 *
 * But for reconciliation purposes, we always show the effect on the asset account
 * (bank accounts are assets): debit = +, credit = -.
 */
function computeNetEffect(
  txAmount: number,
  debitAccountId: string,
  creditAccountId: string,
  accountId: string
): number {
  if (debitAccountId === accountId) {
    return txAmount; // Debit to this account = increase
  } else if (creditAccountId === accountId) {
    return -txAmount; // Credit from this account = decrease
  }
  return 0;
}

/**
 * Start a new reconciliation for an account and period.
 * Auto-populates beginningBalance from the last completed reconciliation if not provided.
 */
export async function startReconciliation(input: StartReconciliationInput) {
  // Verify account exists and belongs to org
  const account = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({
      id: input.accountId,
      organizationId: input.organizationId,
    }),
  });

  if (!account) {
    throw new Error('Account not found');
  }

  // Check for existing in-progress reconciliation for this account
  const existing = await prisma.accountReconciliation.findFirst({
    where: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      status: 'IN_PROGRESS',
    },
  });

  if (existing) {
    throw new Error('An in-progress reconciliation already exists for this account. Complete or delete it first.');
  }

  const reconciliation = await prisma.accountReconciliation.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      beginningBalance: input.beginningBalance,
      endingBalance: input.endingBalance,
    },
  });

  return reconciliation;
}

/**
 * Get the last completed reconciliation's ending balance for auto-populating.
 */
export async function getLastEndingBalance(
  organizationId: string,
  accountId: string
): Promise<number | null> {
  const last = await prisma.accountReconciliation.findFirst({
    where: {
      organizationId,
      accountId,
      status: 'COMPLETED',
    },
    orderBy: { periodEnd: 'desc' },
    select: { endingBalance: true },
  });

  return last ? Number(last.endingBalance) : null;
}

/**
 * Get full reconciliation detail including cleared items and available transactions.
 */
export async function getReconciliationDetail(
  reconciliationId: string,
  organizationId: string
): Promise<ReconciliationDetail> {
  const reconciliation = await prisma.accountReconciliation.findFirst({
    where: { id: reconciliationId, organizationId },
    include: {
      items: true,
    },
  });

  if (!reconciliation) {
    throw new Error('Reconciliation not found');
  }

  // Get account info
  const account = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({ id: reconciliation.accountId }),
    select: { name: true, code: true },
  });

  // Get all unreconciled transactions for this account in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      ...buildCurrentVersionWhere({ organizationId }),
      isVoided: false,
      isDeleted: false,
      transactionDate: {
        gte: reconciliation.periodStart,
        lte: reconciliation.periodEnd,
      },
      OR: [
        { debitAccountId: reconciliation.accountId },
        { creditAccountId: reconciliation.accountId },
      ],
    },
    orderBy: { transactionDate: 'asc' },
  });

  // Build cleared items set
  const clearedTxIds = new Set(reconciliation.items.map((i) => i.transactionId));

  // Cleared items with transaction details
  const clearedItems: ClearedItem[] = [];
  const availableTransactions: AvailableTransaction[] = [];

  for (const tx of transactions) {
    const netEffect = computeNetEffect(
      Number(tx.amount),
      tx.debitAccountId,
      tx.creditAccountId,
      reconciliation.accountId
    );

    if (clearedTxIds.has(tx.id)) {
      const item = reconciliation.items.find((i) => i.transactionId === tx.id)!;
      clearedItems.push({
        id: item.id,
        transactionId: tx.id,
        amount: netEffect,
        transactionDate: tx.transactionDate,
        description: tx.description,
        referenceNumber: tx.referenceNumber,
        type: tx.type,
      });
    } else {
      availableTransactions.push({
        id: tx.id,
        transactionDate: tx.transactionDate,
        description: tx.description,
        amount: netEffect,
        type: tx.type,
        referenceNumber: tx.referenceNumber,
        reconciled: tx.reconciled,
      });
    }
  }

  // Calculate difference
  const clearedTotal = clearedItems.reduce((sum, item) => sum + item.amount, 0);
  const difference = Number(reconciliation.beginningBalance) + clearedTotal - Number(reconciliation.endingBalance);

  return {
    id: reconciliation.id,
    organizationId: reconciliation.organizationId,
    accountId: reconciliation.accountId,
    accountName: account?.name || 'Unknown',
    accountCode: account?.code || '',
    periodStart: reconciliation.periodStart,
    periodEnd: reconciliation.periodEnd,
    beginningBalance: Number(reconciliation.beginningBalance),
    endingBalance: Number(reconciliation.endingBalance),
    status: reconciliation.status,
    completedBy: reconciliation.completedBy,
    completedAt: reconciliation.completedAt,
    clearedItems,
    availableTransactions,
    difference,
  };
}

/**
 * Toggle a transaction's cleared status in a reconciliation.
 * If already cleared, removes it. If not cleared, adds it.
 */
export async function toggleReconciliationItem(
  reconciliationId: string,
  transactionId: string,
  organizationId: string
) {
  const reconciliation = await prisma.accountReconciliation.findFirst({
    where: { id: reconciliationId, organizationId, status: 'IN_PROGRESS' },
  });

  if (!reconciliation) {
    throw new Error('Reconciliation not found or already completed');
  }

  // Check if item already exists
  const existing = await prisma.reconciliationItem.findUnique({
    where: {
      uq_recon_item_txn: {
        reconciliationId,
        transactionId,
      },
    },
  });

  if (existing) {
    // Remove it (un-clear)
    await prisma.reconciliationItem.delete({ where: { id: existing.id } });
    return { action: 'removed' as const, transactionId };
  }

  // Add it — compute net effect
  const tx = await prisma.transaction.findFirst({
    where: buildCurrentVersionWhere({ id: transactionId, organizationId }),
  });

  if (!tx) {
    throw new Error('Transaction not found');
  }

  const netEffect = computeNetEffect(
    Number(tx.amount),
    tx.debitAccountId,
    tx.creditAccountId,
    reconciliation.accountId
  );

  await prisma.reconciliationItem.create({
    data: {
      reconciliationId,
      transactionId,
      amount: netEffect,
    },
  });

  return { action: 'added' as const, transactionId };
}

/**
 * Complete a reconciliation — marks all cleared transactions as reconciled.
 * Only allowed when difference === 0.
 */
export async function completeReconciliation(
  reconciliationId: string,
  organizationId: string,
  userId: string
) {
  const detail = await getReconciliationDetail(reconciliationId, organizationId);

  if (detail.status === 'COMPLETED') {
    throw new Error('Reconciliation is already completed');
  }

  // Allow small floating-point tolerance
  if (Math.abs(detail.difference) > 0.005) {
    throw new Error(
      `Cannot complete: difference is $${detail.difference.toFixed(2)}. Beginning balance + cleared items must equal ending balance.`
    );
  }

  // Mark all cleared transactions as reconciled using temporal versioning
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    for (const item of detail.clearedItems) {
      // Find the current version of this transaction
      const currentVersion = await tx.transaction.findFirst({
        where: buildCurrentVersionWhere({ id: item.transactionId, organizationId }),
      });

      if (!currentVersion || currentVersion.reconciled) continue;

      // Close old version
      await closeVersion(tx.transaction, currentVersion.versionId, now, 'transaction');

      // Create new version with reconciled = true
      const changeReason = `Reconciled in period ${detail.periodStart.toISOString().slice(0, 10)} to ${detail.periodEnd.toISOString().slice(0, 10)}`;
      await tx.transaction.create({
        data: buildNewVersionData(currentVersion, {
          reconciled: true,
          reconciledAt: now,
          changedBy: userId,
          changeReason,
        } as any, now, userId) as any,
      });
    }

    // Mark reconciliation as completed
    await tx.accountReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'COMPLETED',
        completedBy: userId,
        completedAt: now,
      },
    });
  });

  return { success: true, clearedCount: detail.clearedItems.length };
}

/**
 * Delete an in-progress reconciliation.
 */
export async function deleteReconciliation(
  reconciliationId: string,
  organizationId: string
) {
  const reconciliation = await prisma.accountReconciliation.findFirst({
    where: { id: reconciliationId, organizationId },
  });

  if (!reconciliation) {
    throw new Error('Reconciliation not found');
  }

  if (reconciliation.status === 'COMPLETED') {
    throw new Error('Cannot delete a completed reconciliation');
  }

  await prisma.accountReconciliation.delete({ where: { id: reconciliationId } });
  return { success: true };
}

/**
 * List reconciliations for an organization, optionally filtered by account.
 */
export async function listReconciliations(
  organizationId: string,
  accountId?: string
) {
  const reconciliations = await prisma.accountReconciliation.findMany({
    where: {
      organizationId,
      ...(accountId ? { accountId } : {}),
    },
    orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { items: true } },
    },
  });

  // Get account names for display
  const accountIds = [...new Set(reconciliations.map((r) => r.accountId))];
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      ...buildCurrentVersionWhere({}),
    },
    select: { id: true, name: true, code: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return reconciliations.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    accountName: accountMap.get(r.accountId)?.name || 'Unknown',
    accountCode: accountMap.get(r.accountId)?.code || '',
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    beginningBalance: Number(r.beginningBalance),
    endingBalance: Number(r.endingBalance),
    status: r.status,
    completedBy: r.completedBy,
    completedAt: r.completedAt,
    itemCount: r._count.items,
    createdAt: r.createdAt,
  }));
}
