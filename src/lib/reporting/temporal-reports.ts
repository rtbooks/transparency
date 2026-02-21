/**
 * Temporal Reporting Utilities
 * Generate financial reports respecting temporal boundaries
 */

import { prisma } from '@/lib/prisma';
import type { Account, AccountType } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { buildEntitiesWhere, buildEntityMap } from '@/lib/temporal/temporal-utils';

interface BalanceSheetData {
  asOfDate: Date;
  assets: {
    current: Array<{ code: string; name: string; balance: number }>;
    fixed: Array<{ code: string; name: string; balance: number }>;
    total: number;
  };
  liabilities: {
    current: Array<{ code: string; name: string; balance: number }>;
    longTerm: Array<{ code: string; name: string; balance: number }>;
    total: number;
  };
  equity: {
    accounts: Array<{ code: string; name: string; balance: number }>;
    total: number;
  };
  netWorth: number;
}

interface IncomeStatementData {
  startDate: Date;
  endDate: Date;
  revenue: {
    accounts: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  expenses: {
    accounts: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  netIncome: number;
}

interface CashFlowData {
  startDate: Date;
  endDate: Date;
  operating: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  investing: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  financing: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  netChange: number;
  beginningBalance: number;
  endingBalance: number;
}

/**
 * Generate Balance Sheet as of a specific date
 */
export async function generateBalanceSheet(
  organizationId: string,
  asOfDate: Date
): Promise<BalanceSheetData> {
  // Get accounts as they existed on the date
  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      validFrom: { lte: asOfDate },
      validTo: { gt: asOfDate },
      isDeleted: false,
      isActive: true,
    },
    orderBy: { code: 'asc' },
  });

  // Categorize accounts
  const assets = accounts.filter((a) => a.type === 'ASSET');
  const liabilities = accounts.filter((a) => a.type === 'LIABILITY');
  const equity = accounts.filter((a) => a.type === 'EQUITY');

  // Further categorize assets (simplified - could be enhanced with account code ranges)
  const currentAssets = assets.filter((a) => 
    a.code.startsWith('1') && parseInt(a.code) < 1500
  );
  const fixedAssets = assets.filter((a) => 
    a.code.startsWith('1') && parseInt(a.code) >= 1500
  );

  // Further categorize liabilities
  const currentLiabilities = liabilities.filter((a) => 
    a.code.startsWith('2') && parseInt(a.code) < 2500
  );
  const longTermLiabilities = liabilities.filter((a) => 
    a.code.startsWith('2') && parseInt(a.code) >= 2500
  );

  const mapAccount = (acc: Account) => ({
    code: acc.code,
    name: acc.name,
    balance: Number(acc.currentBalance),
  });

  const assetsData = {
    current: currentAssets.map(mapAccount),
    fixed: fixedAssets.map(mapAccount),
    total: assets.reduce((sum, a) => sum + Number(a.currentBalance), 0),
  };

  const liabilitiesData = {
    current: currentLiabilities.map(mapAccount),
    longTerm: longTermLiabilities.map(mapAccount),
    total: liabilities.reduce((sum, a) => sum + Number(a.currentBalance), 0),
  };

  const equityData = {
    accounts: equity.map(mapAccount),
    total: equity.reduce((sum, a) => sum + Number(a.currentBalance), 0),
  };

  return {
    asOfDate,
    assets: assetsData,
    liabilities: liabilitiesData,
    equity: equityData,
    netWorth: assetsData.total - liabilitiesData.total,
  };
}

/**
 * Generate Income Statement for a date range
 */
export async function generateIncomeStatement(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<IncomeStatementData> {
  // Get revenue and expense accounts that existed during the period
  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      validFrom: { lte: endDate },
      validTo: { gt: startDate },
      isDeleted: false,
      type: { in: ['REVENUE', 'EXPENSE'] },
    },
    orderBy: { code: 'asc' },
  });

  // Get transactions within the date range
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amount: true,
      debitAccountId: true,
      creditAccountId: true,
    },
  });

  // Calculate activity for each account
  const accountActivity = new Map<string, number>();

  transactions.forEach((tx) => {
    const amount = Number(tx.amount);
    
    // Debit increases assets/expenses, credit increases liabilities/equity/revenue
    accountActivity.set(
      tx.debitAccountId,
      (accountActivity.get(tx.debitAccountId) || 0) + amount
    );
    accountActivity.set(
      tx.creditAccountId,
      (accountActivity.get(tx.creditAccountId) || 0) + amount
    );
  });

  const revenue = accounts.filter((a) => a.type === 'REVENUE');
  const expenses = accounts.filter((a) => a.type === 'EXPENSE');

  const revenueData = {
    accounts: revenue.map((acc) => ({
      code: acc.code,
      name: acc.name,
      amount: accountActivity.get(acc.id) || 0,
    })),
    total: revenue.reduce((sum, acc) => sum + (accountActivity.get(acc.id) || 0), 0),
  };

  const expenseData = {
    accounts: expenses.map((acc) => ({
      code: acc.code,
      name: acc.name,
      amount: accountActivity.get(acc.id) || 0,
    })),
    total: expenses.reduce((sum, acc) => sum + (accountActivity.get(acc.id) || 0), 0),
  };

  return {
    startDate,
    endDate,
    revenue: revenueData,
    expenses: expenseData,
    netIncome: revenueData.total - expenseData.total,
  };
}

/**
 * Generate Cash Flow Statement for a date range
 */
export async function generateCashFlow(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowData> {
  // Get cash accounts
  const cashAccounts = await prisma.account.findMany({
    where: {
      organizationId,
      validFrom: { lte: endDate },
      validTo: { gt: startDate },
      isDeleted: false,
      type: 'ASSET',
      code: { startsWith: '10' }, // Cash accounts typically 1000-1099
    },
  });

  if (cashAccounts.length === 0) {
    throw new Error('No cash accounts found');
  }

  const cashAccountIds = cashAccounts.map((a) => a.id);

  // Get all cash transactions in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      OR: [
        { debitAccountId: { in: cashAccountIds } },
        { creditAccountId: { in: cashAccountIds } },
      ],
    },
    orderBy: { transactionDate: 'asc' },
  });

  // Resolve debit and credit accounts (bitemporal entities)
  const allAccountIds = [...new Set([
    ...transactions.map(tx => tx.debitAccountId),
    ...transactions.map(tx => tx.creditAccountId),
  ])];
  const accounts = allAccountIds.length > 0
    ? await prisma.account.findMany({ where: buildEntitiesWhere(allAccountIds) })
    : [];
  const accountMap = buildEntityMap(accounts);

  // Categorize cash flows (simplified)
  const operating: Array<{ description: string; amount: number }> = [];
  const investing: Array<{ description: string; amount: number }> = [];
  const financing: Array<{ description: string; amount: number }> = [];

  transactions.forEach((tx) => {
    const amount = Number(tx.amount);
    const isCashDebit = cashAccountIds.includes(tx.debitAccountId);
    const otherAccount = isCashDebit
      ? accountMap.get(tx.creditAccountId)
      : accountMap.get(tx.debitAccountId);
    const netAmount = isCashDebit ? amount : -amount;

    if (!otherAccount) return;

    // Categorize based on other account type/code
    if (otherAccount.type === 'REVENUE' || otherAccount.type === 'EXPENSE') {
      operating.push({
        description: `${otherAccount.code} - ${otherAccount.name}`,
        amount: netAmount,
      });
    } else if (otherAccount.code.startsWith('15')) {
      // Fixed assets
      investing.push({
        description: `${otherAccount.code} - ${otherAccount.name}`,
        amount: netAmount,
      });
    } else if (otherAccount.type === 'LIABILITY' || otherAccount.type === 'EQUITY') {
      financing.push({
        description: `${otherAccount.code} - ${otherAccount.name}`,
        amount: netAmount,
      });
    }
  });

  const operatingTotal = operating.reduce((sum, item) => sum + item.amount, 0);
  const investingTotal = investing.reduce((sum, item) => sum + item.amount, 0);
  const financingTotal = financing.reduce((sum, item) => sum + item.amount, 0);
  const netChange = operatingTotal + investingTotal + financingTotal;

  // Get beginning balance (as of start date)
  const beginningBalance = cashAccounts.reduce((sum, acc) => {
    // This is simplified - should query balance as of startDate
    return sum + Number(acc.currentBalance);
  }, 0) - netChange;

  return {
    startDate,
    endDate,
    operating: {
      items: operating,
      total: operatingTotal,
    },
    investing: {
      items: investing,
      total: investingTotal,
    },
    financing: {
      items: financing,
      total: financingTotal,
    },
    netChange,
    beginningBalance,
    endingBalance: beginningBalance + netChange,
  };
}
