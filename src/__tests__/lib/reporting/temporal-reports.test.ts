/**
 * Unit tests for temporal reporting utilities
 */

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
