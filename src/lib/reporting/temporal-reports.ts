/**
 * Temporal Reporting Utilities
 * Generate financial reports respecting temporal boundaries
 */

import { prisma } from '@/lib/prisma';
import type { Account, AccountType } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { buildCurrentVersionWhere, buildAsOfDateWhere, buildEntitiesWhere, buildEntityMap, MAX_DATE } from '@/lib/temporal/temporal-utils';

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
  // Get accounts as they existed on the date (bitemporal: valid-time + system-time)
  const accounts = await prisma.account.findMany({
    where: {
      ...buildAsOfDateWhere(asOfDate, { organizationId }),
      systemTo: MAX_DATE,
      isActive: true,
    },
    orderBy: { code: 'asc' },
  });

  // Categorize accounts
  const assets = accounts.filter((a) => a.type === 'ASSET');
  const liabilities = accounts.filter((a) => a.type === 'LIABILITY');
  const equity = accounts.filter((a) => a.type === 'EQUITY');
  const revenueAccounts = accounts.filter((a) => a.type === 'REVENUE');
  const expenseAccounts = accounts.filter((a) => a.type === 'EXPENSE');

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

  // Net income = Revenue balances - Expense balances (must be added to equity for A = L + E)
  const revenueTotal = revenueAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const expenseTotal = expenseAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const netIncome = revenueTotal - expenseTotal;

  const equityAccountsList = equity.map(mapAccount);
  // Include net income as a synthetic line item so the equation balances
  if (netIncome !== 0) {
    equityAccountsList.push({ code: '', name: 'Current Period Net Income', balance: netIncome });
  }

  const equityData = {
    accounts: equityAccountsList,
    total: equity.reduce((sum, a) => sum + Number(a.currentBalance), 0) + netIncome,
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
  // Get revenue/expense accounts as they existed at endDate (temporal lookup).
  // This ensures prior-period reports show account names/status as of that time,
  // not today's values. Also filters to active accounts only.
  const accounts = await prisma.account.findMany({
    where: {
      ...buildAsOfDateWhere(endDate, { organizationId }),
      systemTo: MAX_DATE,
      isActive: true,
      type: { in: ['REVENUE', 'EXPENSE'] },
    },
    orderBy: { code: 'asc' },
  });

  // Build a lookup for account types so we can apply correct debit/credit logic
  const accountTypeMap = new Map<string, AccountType>();
  for (const acc of accounts) {
    accountTypeMap.set(acc.id, acc.type);
  }

  // Get transactions within the date range (current versions only)
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      validTo: MAX_DATE,
      systemTo: MAX_DATE,
      isDeleted: false,
      isVoided: false,
    },
    select: {
      amount: true,
      debitAccountId: true,
      creditAccountId: true,
    },
  });

  // Calculate activity per account using correct debit/credit rules:
  // - EXPENSE accounts: debits increase (positive activity)
  // - REVENUE accounts: credits increase (positive activity)
  const accountActivity = new Map<string, number>();

  transactions.forEach((tx) => {
    const amount = Number(tx.amount);

    const debitType = accountTypeMap.get(tx.debitAccountId);
    if (debitType === 'EXPENSE') {
      accountActivity.set(
        tx.debitAccountId,
        (accountActivity.get(tx.debitAccountId) || 0) + amount
      );
    }

    const creditType = accountTypeMap.get(tx.creditAccountId);
    if (creditType === 'REVENUE') {
      accountActivity.set(
        tx.creditAccountId,
        (accountActivity.get(tx.creditAccountId) || 0) + amount
      );
    }
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
  // Get current cash accounts (active only, no range-overlap duplicates)
  const cashAccounts = await prisma.account.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      type: 'ASSET',
      code: { startsWith: '10' }, // Cash accounts typically 1000-1099
      isActive: true,
    }),
  });

  if (cashAccounts.length === 0) {
    throw new Error('No cash accounts found');
  }

  const cashAccountIds = cashAccounts.map((a) => a.id);

  // Get cash account versions as of startDate to determine beginning balance
  const startDateAccounts = await prisma.account.findMany({
    where: {
      ...buildAsOfDateWhere(startDate, { organizationId }),
      systemTo: MAX_DATE,
      isActive: true,
      type: 'ASSET',
      code: { startsWith: '10' },
    },
  });
  // Deduplicate by stable id (take latest validFrom per id)
  const startBalanceMap = new Map<string, number>();
  for (const acc of startDateAccounts) {
    startBalanceMap.set(acc.id, Number(acc.currentBalance));
  }
  const beginningBalance = Array.from(startBalanceMap.values()).reduce((sum, b) => sum + b, 0);

  // Get all cash transactions in the period (current versions only)
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      validTo: MAX_DATE,
      systemTo: MAX_DATE,
      isDeleted: false,
      isVoided: false,
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
