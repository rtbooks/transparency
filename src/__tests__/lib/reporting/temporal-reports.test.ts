/**
 * Unit tests for temporal reporting utilities
 *
 * Tests cover:
 * - Correct temporal filtering (no duplicate accounts from version overlaps)
 * - Proper debit/credit activity logic for income statement
 * - Balance sheet accounting equation: Assets = Liabilities + Equity (incl. net income)
 * - Cash flow beginning balance calculation
 */

import { MAX_DATE, buildCurrentVersionWhere, buildAsOfDateWhere } from '@/lib/temporal/temporal-utils';

// ── Prisma mock ────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/temporal/temporal-utils', () => {
  const actual = jest.requireActual('@/lib/temporal/temporal-utils');
  return actual;
});

import { prisma } from '@/lib/prisma';
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateCashFlow,
} from '@/lib/reporting/temporal-reports';

// ── Helpers ────────────────────────────────────────────────

function makeAccount(overrides: Partial<any> = {}) {
  return {
    id: 'acc-1',
    versionId: 'v-1',
    organizationId: 'org-1',
    code: '1000',
    name: 'Cash',
    type: 'ASSET',
    currentBalance: { toString: () => '10000' },
    isActive: true,
    isDeleted: false,
    validFrom: new Date('2024-01-01'),
    validTo: MAX_DATE,
    systemFrom: new Date('2024-01-01'),
    systemTo: MAX_DATE,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

// ── Existing logic tests ───────────────────────────────────

describe('Temporal Reporting', () => {
  describe('Balance Sheet Generation', () => {
    it('should categorize assets correctly', () => {
      const accounts = [
        { code: '1000', name: 'Cash', type: 'ASSET', balance: 10000 },
        { code: '1100', name: 'Accounts Receivable', type: 'ASSET', balance: 5000 },
        { code: '1500', name: 'Equipment', type: 'ASSET', balance: 25000 },
        { code: '1600', name: 'Building', type: 'ASSET', balance: 100000 },
      ];

      // Current assets: code < 1500
      const currentAssets = accounts.filter(a => 
        a.type === 'ASSET' && parseInt(a.code) < 1500
      );
      
      // Fixed assets: code >= 1500
      const fixedAssets = accounts.filter(a => 
        a.type === 'ASSET' && parseInt(a.code) >= 1500
      );

      expect(currentAssets).toHaveLength(2);
      expect(currentAssets[0].name).toBe('Cash');
      expect(currentAssets[1].name).toBe('Accounts Receivable');
      
      expect(fixedAssets).toHaveLength(2);
      expect(fixedAssets[0].name).toBe('Equipment');
      expect(fixedAssets[1].name).toBe('Building');
    });

    it('should calculate total assets correctly', () => {
      const assets = [
        { balance: 10000 },
        { balance: 5000 },
        { balance: 25000 },
      ];

      const total = assets.reduce((sum, a) => sum + a.balance, 0);
      expect(total).toBe(40000);
    });

    it('should calculate net worth (assets - liabilities)', () => {
      const totalAssets = 150000;
      const totalLiabilities = 50000;
      const totalEquity = 100000;

      // Assets = Liabilities + Equity (accounting equation)
      expect(totalAssets).toBe(totalLiabilities + totalEquity);

      // Net Worth = Assets - Liabilities
      const netWorth = totalAssets - totalLiabilities;
      expect(netWorth).toBe(100000);
      expect(netWorth).toBe(totalEquity);
    });
  });

  describe('Income Statement Calculations', () => {
    it('should calculate net income (revenue - expenses)', () => {
      const revenue = 50000;
      const expenses = 35000;
      const netIncome = revenue - expenses;

      expect(netIncome).toBe(15000);
    });

    it('should handle negative net income (loss)', () => {
      const revenue = 30000;
      const expenses = 45000;
      const netIncome = revenue - expenses;

      expect(netIncome).toBe(-15000);
      expect(netIncome).toBeLessThan(0);
    });

    it('should sum account activities correctly', () => {
      const accountActivity = new Map<string, number>();
      const transactions = [
        { accountId: 'acc-1', amount: 100 },
        { accountId: 'acc-1', amount: 200 },
        { accountId: 'acc-2', amount: 150 },
      ];

      transactions.forEach(tx => {
        const current = accountActivity.get(tx.accountId) || 0;
        accountActivity.set(tx.accountId, current + tx.amount);
      });

      expect(accountActivity.get('acc-1')).toBe(300);
      expect(accountActivity.get('acc-2')).toBe(150);
    });
  });

  describe('Cash Flow Categorization', () => {
    it('should categorize operating activities (revenue/expense)', () => {
      const transaction = {
        otherAccountType: 'REVENUE',
        otherAccountCode: '4000',
      };

      const isOperating = 
        transaction.otherAccountType === 'REVENUE' ||
        transaction.otherAccountType === 'EXPENSE';

      expect(isOperating).toBe(true);
    });

    it('should categorize investing activities (fixed assets)', () => {
      const transaction = {
        otherAccountCode: '1500', // Fixed asset
      };

      const isInvesting = transaction.otherAccountCode.startsWith('15');
      expect(isInvesting).toBe(true);
    });

    it('should categorize financing activities (liabilities/equity)', () => {
      const transaction1 = { otherAccountType: 'LIABILITY' };
      const transaction2 = { otherAccountType: 'EQUITY' };

      const isFinancing1 = 
        transaction1.otherAccountType === 'LIABILITY' ||
        transaction1.otherAccountType === 'EQUITY';
      
      const isFinancing2 = 
        transaction2.otherAccountType === 'LIABILITY' ||
        transaction2.otherAccountType === 'EQUITY';

      expect(isFinancing1).toBe(true);
      expect(isFinancing2).toBe(true);
    });

    it('should calculate net change in cash', () => {
      const operating = 25000;
      const investing = -10000; // Negative (purchase of asset)
      const financing = 5000;

      const netChange = operating + investing + financing;
      expect(netChange).toBe(20000);
    });

    it('should calculate ending cash balance', () => {
      const beginningBalance = 10000;
      const netChange = 20000;
      const endingBalance = beginningBalance + netChange;

      expect(endingBalance).toBe(30000);
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter transactions within date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      const transactions = [
        { date: new Date('2023-12-15') },
        { date: new Date('2024-01-15') },
        { date: new Date('2024-02-20') },
        { date: new Date('2024-04-05') },
      ];

      const filtered = transactions.filter(tx => 
        tx.date >= startDate && tx.date <= endDate
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].date.getMonth()).toBe(0); // January
      expect(filtered[1].date.getMonth()).toBe(1); // February
    });
  });

  describe('Temporal Boundary Conditions', () => {
    it('should respect account validity periods', () => {
      const queryDate = new Date('2024-06-15');
      const account = {
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31'),
      };

      const isValid = 
        account.validFrom <= queryDate &&
        queryDate < account.validTo;

      expect(isValid).toBe(true);
    });

    it('should exclude accounts not yet valid', () => {
      const queryDate = new Date('2024-06-15');
      const account = {
        validFrom: new Date('2024-07-01'),
        validTo: new Date('2024-12-31'),
      };

      const isValid = 
        account.validFrom <= queryDate &&
        queryDate < account.validTo;

      expect(isValid).toBe(false);
    });

    it('should exclude accounts no longer valid', () => {
      const queryDate = new Date('2024-06-15');
      const account = {
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-05-31'),
      };

      const isValid = 
        account.validFrom <= queryDate &&
        queryDate < account.validTo;

      expect(isValid).toBe(false);
    });
  });
});

// ── Bug-fix regression tests ───────────────────────────────

describe('Income Statement - temporal query correctness', () => {
  it('should use buildCurrentVersionWhere (no range-overlap duplicates)', async () => {
    (prisma.account.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

    await generateIncomeStatement(
      'org-1',
      new Date('2024-01-01'),
      new Date('2024-03-31')
    );

    const accountQuery = (prisma.account.findMany as jest.Mock).mock.calls[0][0];
    // Must filter by validTo = MAX_DATE and systemTo = MAX_DATE (current version only)
    expect(accountQuery.where.validTo).toEqual(MAX_DATE);
    expect(accountQuery.where.systemTo).toEqual(MAX_DATE);
    // Must NOT use range queries like { lte: endDate } for validFrom
    expect(accountQuery.where.validFrom).toBeUndefined();
  });

  it('should return one entry per logical account (no duplicates)', async () => {
    // Simulate: same logical account returned once via buildCurrentVersionWhere
    const revenueAccount = makeAccount({
      id: 'rev-1', code: '4000', name: 'Donations', type: 'REVENUE',
    });
    (prisma.account.findMany as jest.Mock).mockResolvedValue([revenueAccount]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { amount: { toString: () => '500' }, debitAccountId: 'cash-1', creditAccountId: 'rev-1' },
    ]);

    const result = await generateIncomeStatement('org-1', new Date('2024-01-01'), new Date('2024-12-31'));

    expect(result.revenue.accounts).toHaveLength(1);
    expect(result.revenue.accounts[0].name).toBe('Donations');
  });
});

describe('Income Statement - debit/credit activity logic', () => {
  it('should only count credits for REVENUE accounts', async () => {
    const revenueAcc = makeAccount({ id: 'rev-1', code: '4000', name: 'Donations', type: 'REVENUE' });
    const expenseAcc = makeAccount({ id: 'exp-1', code: '5000', name: 'Supplies', type: 'EXPENSE' });
    (prisma.account.findMany as jest.Mock).mockResolvedValue([revenueAcc, expenseAcc]);

    // Transaction: Debit Expense, Credit Revenue — $1000
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { amount: { toString: () => '1000' }, debitAccountId: 'exp-1', creditAccountId: 'rev-1' },
    ]);

    const result = await generateIncomeStatement('org-1', new Date('2024-01-01'), new Date('2024-12-31'));

    // Revenue should show 1000 (credited)
    expect(result.revenue.total).toBe(1000);
    // Expense should show 1000 (debited)
    expect(result.expenses.total).toBe(1000);
    // Net income = 1000 - 1000 = 0
    expect(result.netIncome).toBe(0);
  });

  it('should NOT double-count: debit to ASSET should not appear in revenue/expense', async () => {
    const revenueAcc = makeAccount({ id: 'rev-1', code: '4000', name: 'Donations', type: 'REVENUE' });
    (prisma.account.findMany as jest.Mock).mockResolvedValue([revenueAcc]);

    // Transaction: Debit Cash (ASSET, not tracked), Credit Revenue
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { amount: { toString: () => '500' }, debitAccountId: 'cash-1', creditAccountId: 'rev-1' },
    ]);

    const result = await generateIncomeStatement('org-1', new Date('2024-01-01'), new Date('2024-12-31'));

    // Revenue = 500 from credit side only
    expect(result.revenue.total).toBe(500);
    // No expense accounts → 0
    expect(result.expenses.total).toBe(0);
    expect(result.netIncome).toBe(500);
  });

  it('should handle expense-only transactions correctly', async () => {
    const expenseAcc = makeAccount({ id: 'exp-1', code: '5000', name: 'Rent', type: 'EXPENSE' });
    (prisma.account.findMany as jest.Mock).mockResolvedValue([expenseAcc]);

    // Debit Expense, Credit Cash (ASSET)
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { amount: { toString: () => '2000' }, debitAccountId: 'exp-1', creditAccountId: 'cash-1' },
    ]);

    const result = await generateIncomeStatement('org-1', new Date('2024-01-01'), new Date('2024-12-31'));

    expect(result.revenue.total).toBe(0);
    expect(result.expenses.total).toBe(2000);
    expect(result.netIncome).toBe(-2000);
  });
});

describe('Balance Sheet - temporal query correctness', () => {
  it('should include systemTo: MAX_DATE in account query', async () => {
    (prisma.account.findMany as jest.Mock).mockResolvedValue([]);

    await generateBalanceSheet('org-1', new Date('2024-06-30'));

    const query = (prisma.account.findMany as jest.Mock).mock.calls[0][0];
    expect(query.where.systemTo).toEqual(MAX_DATE);
  });
});

describe('Balance Sheet - accounting equation (A = L + E)', () => {
  it('should include net income in equity so equation balances', async () => {
    const accounts = [
      makeAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'ASSET', currentBalance: { toString: () => '15000' } }),
      makeAccount({ id: 'ap', code: '2000', name: 'Accounts Payable', type: 'LIABILITY', currentBalance: { toString: () => '3000' } }),
      makeAccount({ id: 'retained', code: '3000', name: 'Retained Earnings', type: 'EQUITY', currentBalance: { toString: () => '7000' } }),
      makeAccount({ id: 'rev', code: '4000', name: 'Donations', type: 'REVENUE', currentBalance: { toString: () => '8000' } }),
      makeAccount({ id: 'exp', code: '5000', name: 'Supplies', type: 'EXPENSE', currentBalance: { toString: () => '3000' } }),
    ];
    (prisma.account.findMany as jest.Mock).mockResolvedValue(accounts);

    const result = await generateBalanceSheet('org-1', new Date('2024-12-31'));

    // Assets = 15000
    expect(result.assets.total).toBe(15000);
    // Liabilities = 3000
    expect(result.liabilities.total).toBe(3000);
    // Net income = Revenue(8000) - Expense(3000) = 5000
    // Equity = Retained(7000) + Net Income(5000) = 12000
    expect(result.equity.total).toBe(12000);
    // A = L + E → 15000 = 3000 + 12000
    expect(result.assets.total).toBe(result.liabilities.total + result.equity.total);
  });

  it('should include "Current Period Net Income" line in equity accounts', async () => {
    const accounts = [
      makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '5000' } }),
      makeAccount({ id: 'rev', code: '4000', type: 'REVENUE', currentBalance: { toString: () => '2000' } }),
      makeAccount({ id: 'exp', code: '5000', type: 'EXPENSE', currentBalance: { toString: () => '500' } }),
    ];
    (prisma.account.findMany as jest.Mock).mockResolvedValue(accounts);

    const result = await generateBalanceSheet('org-1', new Date('2024-12-31'));

    const netIncomeLine = result.equity.accounts.find(a => a.name === 'Current Period Net Income');
    expect(netIncomeLine).toBeDefined();
    expect(netIncomeLine!.balance).toBe(1500); // 2000 - 500
  });

  it('should NOT add net income line when net income is zero', async () => {
    const accounts = [
      makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '5000' } }),
    ];
    (prisma.account.findMany as jest.Mock).mockResolvedValue(accounts);

    const result = await generateBalanceSheet('org-1', new Date('2024-12-31'));
    const netIncomeLine = result.equity.accounts.find(a => a.name === 'Current Period Net Income');
    expect(netIncomeLine).toBeUndefined();
  });
});

describe('Cash Flow - beginning balance', () => {
  it('should query account balances as of startDate for beginning balance', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-31');

    // First call: current cash accounts. Second call: as-of-startDate accounts.
    (prisma.account.findMany as jest.Mock)
      .mockResolvedValueOnce([
        makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '15000' } }),
      ])
      .mockResolvedValueOnce([
        makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '10000' } }),
      ])
      .mockResolvedValueOnce([]); // for buildEntitiesWhere

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

    const result = await generateCashFlow('org-1', startDate, endDate);

    // Beginning balance should come from the as-of-startDate query (10000), not current (15000)
    expect(result.beginningBalance).toBe(10000);

    // Verify the second findMany call uses as-of-date filtering
    const secondCall = (prisma.account.findMany as jest.Mock).mock.calls[1][0];
    expect(secondCall.where.validFrom).toEqual({ lte: startDate });
    expect(secondCall.where.validTo).toEqual({ gt: startDate });
    expect(secondCall.where.systemTo).toEqual(MAX_DATE);
  });

  it('should calculate endingBalance = beginningBalance + netChange', async () => {
    const cashAccount = makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '15000' } });
    const cashAtStart = makeAccount({ id: 'cash', code: '1000', type: 'ASSET', currentBalance: { toString: () => '10000' } });
    const relatedAccounts = [
      makeAccount({ id: 'cash', code: '1000', type: 'ASSET', name: 'Cash' }),
      makeAccount({ id: 'rev', code: '4000', type: 'REVENUE', name: 'Income' }),
    ];

    // generateCashFlow calls account.findMany 3 times:
    // 1) current cash accounts  2) as-of-startDate  3) entity resolution
    const findManyMock = prisma.account.findMany as jest.Mock;
    findManyMock
      .mockResolvedValueOnce([cashAccount])
      .mockResolvedValueOnce([cashAtStart])
      .mockResolvedValueOnce(relatedAccounts);

    // Cash debit (inflow) of 5000
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        amount: { toString: () => '5000' },
        debitAccountId: 'cash',
        creditAccountId: 'rev',
      },
    ]);

    const result = await generateCashFlow('org-1', new Date('2024-01-01'), new Date('2024-03-31'));

    expect(result.beginningBalance).toBe(10000);
    expect(result.netChange).toBe(5000);
    expect(result.endingBalance).toBe(15000);
  });
});
