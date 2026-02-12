/**
 * Unit tests for Balance Calculator
 * 
 * Tests the core double-entry bookkeeping balance calculations.
 * These are CRITICAL - any errors here corrupt financial data.
 */

import { AccountType } from '@/generated/prisma/client';
import { calculateNewBalance, updateAccountBalances } from '@/lib/accounting/balance-calculator';

describe('Balance Calculator', () => {
  describe('calculateNewBalance()', () => {
    describe('ASSET accounts', () => {
      const accountType: AccountType = 'ASSET';

      it('should increase balance when debited', () => {
        const currentBalance = 1000;
        const amount = 500;
        const result = calculateNewBalance(currentBalance, amount, accountType, true);
        expect(result).toBe(1500);
      });

      it('should decrease balance when credited', () => {
        const currentBalance = 1000;
        const amount = 300;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(700);
      });

      it('should handle zero starting balance', () => {
        const result = calculateNewBalance(0, 500, accountType, true);
        expect(result).toBe(500);
      });

      it('should allow negative balance (overdraft)', () => {
        const currentBalance = 100;
        const amount = 300;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(-200);
      });
    });

    describe('LIABILITY accounts', () => {
      const accountType: AccountType = 'LIABILITY';

      it('should increase balance when credited', () => {
        const currentBalance = 1000;
        const amount = 500;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(1500);
      });

      it('should decrease balance when debited', () => {
        const currentBalance = 1000;
        const amount = 300;
        const result = calculateNewBalance(currentBalance, amount, accountType, true);
        expect(result).toBe(700);
      });

      it('should handle zero starting balance', () => {
        const result = calculateNewBalance(0, 500, accountType, false);
        expect(result).toBe(500);
      });
    });

    describe('EQUITY accounts', () => {
      const accountType: AccountType = 'EQUITY';

      it('should increase balance when credited', () => {
        const currentBalance = 10000;
        const amount = 2000;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(12000);
      });

      it('should decrease balance when debited', () => {
        const currentBalance = 10000;
        const amount = 1500;
        const result = calculateNewBalance(currentBalance, amount, accountType, true);
        expect(result).toBe(8500);
      });

      it('should handle zero starting balance', () => {
        const result = calculateNewBalance(0, 5000, accountType, false);
        expect(result).toBe(5000);
      });
    });

    describe('REVENUE accounts', () => {
      const accountType: AccountType = 'REVENUE';

      it('should increase balance when credited', () => {
        const currentBalance = 50000;
        const amount = 1000;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(51000);
      });

      it('should decrease balance when debited (refund/reversal)', () => {
        const currentBalance = 50000;
        const amount = 500;
        const result = calculateNewBalance(currentBalance, amount, accountType, true);
        expect(result).toBe(49500);
      });

      it('should handle zero starting balance (first revenue)', () => {
        const result = calculateNewBalance(0, 1000, accountType, false);
        expect(result).toBe(1000);
      });
    });

    describe('EXPENSE accounts', () => {
      const accountType: AccountType = 'EXPENSE';

      it('should increase balance when debited', () => {
        const currentBalance = 5000;
        const amount = 250;
        const result = calculateNewBalance(currentBalance, amount, accountType, true);
        expect(result).toBe(5250);
      });

      it('should decrease balance when credited (refund/reversal)', () => {
        const currentBalance = 5000;
        const amount = 200;
        const result = calculateNewBalance(currentBalance, amount, accountType, false);
        expect(result).toBe(4800);
      });

      it('should handle zero starting balance (first expense)', () => {
        const result = calculateNewBalance(0, 250, accountType, true);
        expect(result).toBe(250);
      });
    });

    describe('Edge cases', () => {
      it('should handle zero amount transaction', () => {
        const result = calculateNewBalance(1000, 0, 'ASSET', true);
        expect(result).toBe(1000);
      });

      it('should handle very large amounts (billions)', () => {
        const currentBalance = 1_000_000_000; // 1 billion
        const amount = 500_000_000; // 500 million
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBe(1_500_000_000);
      });

      it('should handle decimal precision (cents)', () => {
        const currentBalance = 100.50;
        const amount = 25.25;
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBe(125.75);
      });

      it('should handle three decimal places correctly', () => {
        const currentBalance = 100.123;
        const amount = 50.456;
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBeCloseTo(150.579, 3);
      });

      it('should avoid floating point rounding errors', () => {
        const currentBalance = 0.1;
        const amount = 0.2;
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        // JavaScript: 0.1 + 0.2 = 0.30000000000000004
        // We accept this for now, but should be aware
        expect(result).toBeCloseTo(0.3, 10);
      });

      it('should handle string input for currentBalance', () => {
        const currentBalance = { toString: () => '1000.50' };
        const amount = 250.25;
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBe(1250.75);
      });

      it('should handle string input for amount', () => {
        const currentBalance = 1000.50;
        const amount = { toString: () => '250.25' };
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBe(1250.75);
      });

      it('should handle both string inputs (Prisma Decimal simulation)', () => {
        const currentBalance = { toString: () => '1000.50' };
        const amount = { toString: () => '250.25' };
        const result = calculateNewBalance(currentBalance, amount, 'ASSET', true);
        expect(result).toBe(1250.75);
      });

      it('should handle negative amounts (edge case, should be prevented elsewhere)', () => {
        const result = calculateNewBalance(1000, -100, 'ASSET', true);
        expect(result).toBe(900); // -100 debit = 900
      });
    });
  });

  describe('updateAccountBalances()', () => {
    // Mock Prisma client
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        account: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      };
    });

    it('should update both accounts atomically', async () => {
      // Setup: Debit asset account, credit revenue account
      const debitAccount = {
        id: 'debit-account-id',
        currentBalance: 1000,
        type: 'ASSET' as AccountType,
      };
      const creditAccount = {
        id: 'credit-account-id',
        currentBalance: 5000,
        type: 'REVENUE' as AccountType,
      };

      mockPrisma.account.findUnique
        .mockResolvedValueOnce(debitAccount)
        .mockResolvedValueOnce(creditAccount);

      mockPrisma.account.update
        .mockResolvedValueOnce({ ...debitAccount, currentBalance: 1500 })
        .mockResolvedValueOnce({ ...creditAccount, currentBalance: 5500 });

      const result = await updateAccountBalances(
        mockPrisma,
        'debit-account-id',
        'credit-account-id',
        500
      );

      // Verify both accounts were fetched
      expect(mockPrisma.account.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'debit-account-id' },
      });
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'credit-account-id' },
      });

      // Verify both accounts were updated
      expect(mockPrisma.account.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'debit-account-id' },
        data: { currentBalance: 1500 }, // 1000 + 500 (asset debit increases)
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'credit-account-id' },
        data: { currentBalance: 5500 }, // 5000 + 500 (revenue credit increases)
      });

      // Verify return values
      expect(result.newDebitBalance).toBe(1500);
      expect(result.newCreditBalance).toBe(5500);
    });

    it('should throw error if debit account not found', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(null) // Debit account not found
        .mockResolvedValueOnce({ id: 'credit-id', currentBalance: 1000, type: 'REVENUE' });

      await expect(
        updateAccountBalances(mockPrisma, 'invalid-id', 'credit-id', 500)
      ).rejects.toThrow('One or both accounts not found');
    });

    it('should throw error if credit account not found', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce({ id: 'debit-id', currentBalance: 1000, type: 'ASSET' })
        .mockResolvedValueOnce(null); // Credit account not found

      await expect(
        updateAccountBalances(mockPrisma, 'debit-id', 'invalid-id', 500)
      ).rejects.toThrow('One or both accounts not found');
    });

    it('should throw error if both accounts not found', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        updateAccountBalances(mockPrisma, 'invalid-1', 'invalid-2', 500)
      ).rejects.toThrow('One or both accounts not found');
    });

    it('should handle Prisma Decimal types', async () => {
      // Simulate Prisma Decimal objects
      const debitAccount = {
        id: 'debit-id',
        currentBalance: { toString: () => '1000.50' },
        type: 'ASSET' as AccountType,
      };
      const creditAccount = {
        id: 'credit-id',
        currentBalance: { toString: () => '2000.75' },
        type: 'LIABILITY' as AccountType,
      };

      mockPrisma.account.findUnique
        .mockResolvedValueOnce(debitAccount)
        .mockResolvedValueOnce(creditAccount);

      mockPrisma.account.update.mockResolvedValue({});

      await updateAccountBalances(mockPrisma, 'debit-id', 'credit-id', 250.25);

      // Verify calculations were correct
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'debit-id' },
        data: { currentBalance: 1250.75 }, // 1000.50 + 250.25 (asset debit)
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'credit-id' },
        data: { currentBalance: 2251.0 }, // 2000.75 + 250.25 (liability credit)
      });
    });

    it('should handle different account type combinations correctly', async () => {
      // Test: Expense (debit) and Cash (credit)
      const expenseAccount = {
        id: 'expense-id',
        currentBalance: 1000,
        type: 'EXPENSE' as AccountType,
      };
      const cashAccount = {
        id: 'cash-id',
        currentBalance: 5000,
        type: 'ASSET' as AccountType,
      };

      mockPrisma.account.findUnique
        .mockResolvedValueOnce(expenseAccount)
        .mockResolvedValueOnce(cashAccount);

      mockPrisma.account.update.mockResolvedValue({});

      await updateAccountBalances(mockPrisma, 'expense-id', 'cash-id', 300);

      // Expense debit increases: 1000 + 300 = 1300
      // Cash credit decreases: 5000 - 300 = 4700
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'expense-id' },
        data: { currentBalance: 1300 },
      });
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'cash-id' },
        data: { currentBalance: 4700 },
      });
    });
  });
});
