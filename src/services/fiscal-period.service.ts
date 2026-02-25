/**
 * Fiscal Period Service
 * Manages fiscal periods and year-end closing entries for organizations.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import type { FiscalPeriodStatus } from '@/generated/prisma/client';

export interface CreateFiscalPeriodInput {
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface ClosingEntryPreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'REVENUE' | 'EXPENSE';
  currentBalance: number;
  closingDebitAccountId: string;
  closingCreditAccountId: string;
  amount: number; // always positive
}

export interface ClosePreviewResult {
  entries: ClosingEntryPreview[];
  totalRevenue: number;
  totalExpenses: number;
  netSurplusOrDeficit: number;
  fundBalanceAccountId: string;
  fundBalanceAccountName: string;
}

/**
 * Create a new fiscal period for an organization.
 */
export async function createFiscalPeriod(input: CreateFiscalPeriodInput) {
  // Check for overlapping periods
  const existing = await prisma.fiscalPeriod.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        { startDate: { lte: input.endDate }, endDate: { gte: input.startDate } },
      ],
    },
  });

  if (existing) {
    throw new Error(`Fiscal period overlaps with existing period "${existing.name}"`);
  }

  return prisma.fiscalPeriod.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'OPEN',
    },
  });
}

/**
 * List fiscal periods for an organization, ordered by start date descending.
 */
export async function listFiscalPeriods(organizationId: string) {
  return prisma.fiscalPeriod.findMany({
    where: { organizationId },
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Get the current open fiscal period for an organization.
 */
export async function getCurrentFiscalPeriod(organizationId: string) {
  return prisma.fiscalPeriod.findFirst({
    where: { organizationId, status: 'OPEN' },
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Get a fiscal period by ID.
 */
export async function getFiscalPeriod(id: string, organizationId: string) {
  const period = await prisma.fiscalPeriod.findUnique({ where: { id } });
  if (!period || period.organizationId !== organizationId) {
    throw new Error('Fiscal period not found');
  }
  return period;
}

/**
 * Preview what closing entries would be generated for a fiscal period.
 * Does not modify any data.
 */
export async function previewClose(
  periodId: string,
  organizationId: string
): Promise<ClosePreviewResult> {
  const period = await getFiscalPeriod(periodId, organizationId);

  if (period.status !== 'OPEN') {
    throw new Error(`Cannot preview close for a period with status "${period.status}"`);
  }

  // Get the org's fund balance account
  const org = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: organizationId }),
  });
  if (!org?.fundBalanceAccountId) {
    throw new Error('Organization does not have a Fund Balance account configured. Please set one in Organization Settings.');
  }

  const fundBalanceAccount = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({ id: org.fundBalanceAccountId }),
  });
  if (!fundBalanceAccount) {
    throw new Error('Fund Balance account not found');
  }

  // Get all active revenue and expense accounts with non-zero balances
  const tempAccounts = await prisma.account.findMany({
    where: {
      ...buildCurrentVersionWhere({ organizationId }),
      type: { in: ['REVENUE', 'EXPENSE'] },
      isActive: true,
    },
  });

  const entries: ClosingEntryPreview[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const account of tempAccounts) {
    const balance = parseFloat(account.currentBalance.toString());
    if (balance === 0) continue;

    if (account.type === 'REVENUE') {
      // Revenue accounts normally have credit balances (positive in our system)
      // To close: DR Revenue, CR Fund Balance
      totalRevenue += balance;
      entries.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: 'REVENUE',
        currentBalance: balance,
        closingDebitAccountId: account.id,
        closingCreditAccountId: org.fundBalanceAccountId,
        amount: Math.abs(balance),
      });
    } else {
      // Expense accounts normally have debit balances (positive in our system)
      // To close: DR Fund Balance, CR Expense
      totalExpenses += balance;
      entries.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: 'EXPENSE',
        currentBalance: balance,
        closingDebitAccountId: org.fundBalanceAccountId,
        closingCreditAccountId: account.id,
        amount: Math.abs(balance),
      });
    }
  }

  return {
    entries,
    totalRevenue,
    totalExpenses,
    netSurplusOrDeficit: totalRevenue - totalExpenses,
    fundBalanceAccountId: org.fundBalanceAccountId,
    fundBalanceAccountName: fundBalanceAccount.name,
  };
}

/**
 * Execute year-end close for a fiscal period.
 * Generates closing journal entries that zero out all revenue and expense accounts,
 * transferring the net surplus/deficit to the Fund Balance equity account.
 */
export async function executeClose(
  periodId: string,
  organizationId: string,
  userId: string
) {
  const period = await getFiscalPeriod(periodId, organizationId);

  if (period.status !== 'OPEN') {
    throw new Error(`Cannot close a period with status "${period.status}"`);
  }

  const preview = await previewClose(periodId, organizationId);

  if (preview.entries.length === 0) {
    throw new Error('No accounts with non-zero balances to close');
  }

  const now = new Date();
  const closingDate = period.endDate;
  const closingTransactionIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Generate a closing transaction for each temp account
    for (const entry of preview.entries) {
      const transaction = await tx.transaction.create({
        data: {
          organizationId,
          transactionDate: closingDate,
          amount: entry.amount,
          type: 'CLOSING',
          debitAccountId: entry.closingDebitAccountId,
          creditAccountId: entry.closingCreditAccountId,
          description: `Year-end closing entry — ${period.name}`,
          category: 'Closing Entry',
          paymentMethod: 'OTHER',
          createdBy: userId,
          changedBy: userId,
        },
      });

      closingTransactionIds.push(transaction.id);

      // Update account balances using normal double-entry logic
      await updateAccountBalances(
        tx,
        entry.closingDebitAccountId,
        entry.closingCreditAccountId,
        entry.amount
      );
    }

    // Mark period as closed
    await tx.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedBy: userId,
        closingTransactionIds,
      },
    });
  });

  return {
    periodId,
    status: 'CLOSED' as FiscalPeriodStatus,
    closingTransactionIds,
    entriesCreated: closingTransactionIds.length,
    netSurplusOrDeficit: preview.netSurplusOrDeficit,
  };
}

/**
 * Reopen a closed fiscal period.
 * Voids all closing transactions and sets the period back to OPEN.
 */
export async function reopenPeriod(
  periodId: string,
  organizationId: string,
  userId: string
) {
  const period = await getFiscalPeriod(periodId, organizationId);

  if (period.status !== 'CLOSED') {
    throw new Error(`Cannot reopen a period with status "${period.status}"`);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Void each closing transaction by reversing its balance effects
    for (const txnId of period.closingTransactionIds) {
      const current = await tx.transaction.findFirst({
        where: {
          id: txnId,
          validTo: MAX_DATE,
          isVoided: false,
          isDeleted: false,
        },
      });

      if (!current) continue;

      // Close old version
      const { versionId: _v, ...rest } = current;
      await tx.transaction.updateMany({
        where: { versionId: current.versionId, validTo: MAX_DATE },
        data: { validTo: now, systemTo: now },
      });

      // Create voided version
      await tx.transaction.create({
        data: {
          ...rest,
          amount: parseFloat(current.amount.toString()),
          versionId: crypto.randomUUID(),
          previousVersionId: current.versionId,
          validFrom: now,
          validTo: MAX_DATE,
          systemFrom: now,
          systemTo: MAX_DATE,
          isVoided: true,
          voidedAt: now,
          voidedBy: userId,
          voidReason: `Period "${period.name}" reopened`,
          changedBy: userId,
        },
      });

      // Reverse balance effects
      const { reverseAccountBalances } = await import('@/lib/accounting/balance-calculator');
      await reverseAccountBalances(
        tx,
        current.debitAccountId,
        current.creditAccountId,
        parseFloat(current.amount.toString())
      );
    }

    // Mark period as open again
    await tx.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: 'OPEN',
        reopenedAt: now,
        reopenedBy: userId,
        closingTransactionIds: [],
      },
    });
  });

  return {
    periodId,
    status: 'OPEN' as FiscalPeriodStatus,
    message: `Period "${period.name}" has been reopened. All closing entries have been voided.`,
  };
}

/**
 * Check if a transaction date falls within a closed fiscal period.
 * Used as a guard to prevent modifications to closed periods.
 */
export async function isDateInClosedPeriod(
  organizationId: string,
  transactionDate: Date
): Promise<{ closed: boolean; periodName?: string }> {
  const closedPeriod = await prisma.fiscalPeriod.findFirst({
    where: {
      organizationId,
      status: 'CLOSED',
      startDate: { lte: transactionDate },
      endDate: { gte: transactionDate },
    },
  });

  if (closedPeriod) {
    return { closed: true, periodName: closedPeriod.name };
  }

  return { closed: false };
}
