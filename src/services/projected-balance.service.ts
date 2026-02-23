/**
 * Projected Balance Service
 *
 * Calculates projected/available balances for cash/bank accounts by
 * subtracting outstanding PAYABLE bill amounts that are funded from each account.
 * RECEIVABLE bills are excluded from projections per design.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

export interface ProjectedBalanceResult {
  accountId: string;
  accountName: string;
  currentBalance: number;
  pendingPayables: number;
  projectedBalance: number;
  isOverdraft: boolean;
  pendingBillCount: number;
}

/**
 * Get the projected balance for a single account.
 * Projected = currentBalance − SUM(outstanding PAYABLE bills funded from this account)
 */
export async function getProjectedBalance(
  organizationId: string,
  accountId: string
): Promise<ProjectedBalanceResult | null> {
  const account = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({ id: accountId, organizationId }),
  });

  if (!account) return null;

  const currentBalance = Number(account.currentBalance);

  // Sum outstanding PAYABLE bills that designate this account as their funding source
  const result = await prisma.bill.aggregate({
    where: {
      organizationId,
      direction: 'PAYABLE',
      fundingAccountId: accountId,
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    },
    _sum: { amount: true, amountPaid: true },
    _count: { id: true },
  });

  const totalBilled = Number(result._sum.amount || 0);
  const totalPaid = Number(result._sum.amountPaid || 0);
  const pendingPayables = totalBilled - totalPaid;
  const projectedBalance = currentBalance - pendingPayables;

  return {
    accountId,
    accountName: account.name,
    currentBalance,
    pendingPayables,
    projectedBalance,
    isOverdraft: projectedBalance < 0,
    pendingBillCount: result._count.id,
  };
}

/**
 * Check if recording an additional amount against this funding account
 * would cause an overdraft.
 */
export async function checkOverdraftRisk(
  organizationId: string,
  accountId: string,
  additionalAmount: number = 0
): Promise<{
  currentBalance: number;
  pendingPayables: number;
  additionalAmount: number;
  projectedBalance: number;
  isOverdraft: boolean;
}> {
  const result = await getProjectedBalance(organizationId, accountId);
  if (!result) {
    return {
      currentBalance: 0,
      pendingPayables: 0,
      additionalAmount,
      projectedBalance: -additionalAmount,
      isOverdraft: additionalAmount > 0,
    };
  }

  const projectedBalance = result.projectedBalance - additionalAmount;

  return {
    currentBalance: result.currentBalance,
    pendingPayables: result.pendingPayables,
    additionalAmount,
    projectedBalance,
    isOverdraft: projectedBalance < 0,
  };
}

/**
 * Get projected balances for all ASSET accounts in an organization
 * that have pending payable obligations. Used for dashboard alerts.
 */
export async function getOverdraftAlerts(
  organizationId: string
): Promise<ProjectedBalanceResult[]> {
  // Find all ASSET accounts that are referenced as funding accounts on unpaid bills
  const fundedAccounts = await prisma.bill.findMany({
    where: {
      organizationId,
      direction: 'PAYABLE',
      fundingAccountId: { not: null },
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    },
    select: { fundingAccountId: true },
    distinct: ['fundingAccountId'],
  });

  const accountIds = fundedAccounts
    .map((b) => b.fundingAccountId)
    .filter(Boolean) as string[];

  if (accountIds.length === 0) return [];

  const results = await Promise.all(
    accountIds.map((id) => getProjectedBalance(organizationId, id))
  );

  // Return only accounts at risk (negative projected balance)
  return results
    .filter((r): r is ProjectedBalanceResult => r !== null && r.isOverdraft)
    .sort((a, b) => a.projectedBalance - b.projectedBalance);
}
