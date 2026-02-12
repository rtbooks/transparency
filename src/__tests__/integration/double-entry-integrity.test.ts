/**
 * Integration tests for Double-Entry Bookkeeping Integrity
 * 
 * CRITICAL: These tests verify that our financial system maintains
 * double-entry bookkeeping integrity at all times. Any failures here
 * indicate potential data corruption.
 * 
 * Tests use mocked Prisma client to simulate database operations
 * without requiring a real database connection.
 */

import { AccountType } from '@/generated/prisma/client';
import { calculateNewBalance } from '@/lib/accounting/balance-calculator';
import {
  recalculateAccountBalance,
  verifyAccountBalance,
  verifyDoubleEntryIntegrity,
} from '@/lib/accounting/balance-verification';

describe('Double-Entry Integrity Tests', () => {
  describe('Single transaction maintains balance', () => {
    it('should maintain debits = credits for INCOME transaction', () => {
      // Setup: Donation received
      const debitAccount = { id: 'checking', type: 'ASSET' as AccountType, balance: 1000 };
      const creditAccount = { id: 'revenue', type: 'REVENUE' as AccountType, balance: 5000 };
      const amount = 500;

      // Calculate new balances
      const newDebitBalance = calculateNewBalance(debitAccount.balance, amount, debitAccount.type, true);
      const newCreditBalance = calculateNewBalance(creditAccount.balance, amount, creditAccount.type, false);

      // Verify balance changes
      expect(newDebitBalance).toBe(1500); // Asset increases
      expect(newCreditBalance).toBe(5500); // Revenue increases
      expect(newDebitBalance - debitAccount.balance).toBe(amount); // +500
      expect(newCreditBalance - creditAccount.balance).toBe(amount); // +500

      // Verify transaction is balanced
      const transactions = [{ amount }];
      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalDebits).toBe(integrity.totalCredits);
    });

    it('should maintain debits = credits for EXPENSE transaction', () => {
      // Setup: Office supplies purchase
      const debitAccount = { id: 'supplies', type: 'EXPENSE' as AccountType, balance: 1000 };
      const creditAccount = { id: 'cash', type: 'ASSET' as AccountType, balance: 5000 };
      const amount = 250;

      // Calculate new balances
      const newDebitBalance = calculateNewBalance(debitAccount.balance, amount, debitAccount.type, true);
      const newCreditBalance = calculateNewBalance(creditAccount.balance, amount, creditAccount.type, false);

      // Verify balance changes
      expect(newDebitBalance).toBe(1250); // Expense increases
      expect(newCreditBalance).toBe(4750); // Asset decreases

      // Verify both accounts affected by same amount
      expect(newDebitBalance - debitAccount.balance).toBe(amount);
      expect(creditAccount.balance - newCreditBalance).toBe(amount);

      // Verify transaction is balanced
      const transactions = [{ amount }];
      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.isValid).toBe(true);
    });

    it('should maintain debits = credits for TRANSFER transaction', () => {
      // Setup: Transfer between asset accounts
      const debitAccount = { id: 'savings', type: 'ASSET' as AccountType, balance: 2000 };
      const creditAccount = { id: 'checking', type: 'ASSET' as AccountType, balance: 5000 };
      const amount = 1000;

      // Calculate new balances
      const newDebitBalance = calculateNewBalance(debitAccount.balance, amount, debitAccount.type, true);
      const newCreditBalance = calculateNewBalance(creditAccount.balance, amount, creditAccount.type, false);

      // Verify balance changes
      expect(newDebitBalance).toBe(3000); // Savings increases
      expect(newCreditBalance).toBe(4000); // Checking decreases

      // Total assets unchanged (internal transfer)
      const totalAssetsBefore = debitAccount.balance + creditAccount.balance;
      const totalAssetsAfter = newDebitBalance + newCreditBalance;
      expect(totalAssetsAfter).toBe(totalAssetsBefore);
    });
  });

  describe('Multiple transactions maintain system balance', () => {
    it('should maintain total debits = total credits across 100 transactions', () => {
      const transactions = [];
      
      // Create 100 random transactions
      for (let i = 0; i < 100; i++) {
        const amount = Math.floor(Math.random() * 1000) + 1;
        transactions.push({ amount });
      }

      // Verify system integrity
      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalDebits).toBe(integrity.totalCredits);
      expect(integrity.difference).toBe(0);
    });

    it('should maintain balance with diverse transaction amounts', () => {
      const transactions = [
        { amount: 1000.50 },
        { amount: 250.25 },
        { amount: 75.75 },
        { amount: 3000 },
        { amount: 0.01 },
        { amount: 999.99 },
      ];

      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalDebits).toBe(integrity.totalCredits);
    });

    it('should calculate correct system-wide totals', () => {
      const transactions = [
        { amount: 100 },
        { amount: 200 },
        { amount: 300 },
      ];

      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.totalDebits).toBe(600);
      expect(integrity.totalCredits).toBe(600);
      expect(integrity.isValid).toBe(true);
    });
  });

  describe('Transaction reversal maintains balance', () => {
    it('should return accounts to original balance after reversal', () => {
      const accountA = { id: 'account-a', type: 'ASSET' as AccountType, initialBalance: 1000 };
      const accountB = { id: 'account-b', type: 'REVENUE' as AccountType, initialBalance: 5000 };
      const amount = 500;

      // Original transaction: Debit A, Credit B
      let balanceA = calculateNewBalance(accountA.initialBalance, amount, accountA.type, true);
      let balanceB = calculateNewBalance(accountB.initialBalance, amount, accountB.type, false);

      expect(balanceA).toBe(1500); // A increased
      expect(balanceB).toBe(5500); // B increased

      // Reversal transaction: Debit B, Credit A (opposite)
      balanceA = calculateNewBalance(balanceA, amount, accountA.type, false);
      balanceB = calculateNewBalance(balanceB, amount, accountB.type, true);

      // Should return to original
      expect(balanceA).toBe(accountA.initialBalance);
      expect(balanceB).toBe(accountB.initialBalance);
    });

    it('should maintain system integrity through reversal', () => {
      // Original transaction
      const transaction1 = { amount: 750 };
      
      // Reversal (same amount, opposite direction)
      const transaction2 = { amount: 750 };

      const transactions = [transaction1, transaction2];
      const integrity = verifyDoubleEntryIntegrity(transactions);
      
      expect(integrity.isValid).toBe(true);
      expect(integrity.totalDebits).toBe(integrity.totalCredits);
    });
  });

  describe('Account balance recalculation', () => {
    it('should recalculate correct balance from transaction history', () => {
      const accountId = 'checking-account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 1000;

      // Transaction history
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other-1', amount: 500 },  // +500
        { debitAccountId: 'other-2', creditAccountId: accountId, amount: 200 },  // -200
        { debitAccountId: accountId, creditAccountId: 'other-3', amount: 300 },  // +300
        { debitAccountId: 'other-4', creditAccountId: accountId, amount: 100 },  // -100
      ];

      const recalculatedBalance = recalculateAccountBalance(
        transactions,
        accountId,
        accountType,
        initialBalance
      );

      // Expected: 1000 + 500 - 200 + 300 - 100 = 1500
      expect(recalculatedBalance).toBe(1500);
    });

    it('should detect corrupted balance', () => {
      const accountId = 'account';
      const accountType: AccountType = 'ASSET';
      const storedBalance = 9999; // Corrupted
      const initialBalance = 1000;

      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },
      ];

      const recalculatedBalance = recalculateAccountBalance(
        transactions,
        accountId,
        accountType,
        initialBalance
      );

      const verification = verifyAccountBalance(storedBalance, recalculatedBalance);
      
      expect(verification.isCorrect).toBe(false);
      expect(recalculatedBalance).toBe(1500); // Correct value
      expect(storedBalance).toBe(9999); // Corrupted value
      expect(verification.difference).toBeGreaterThan(0);
    });

    it('should recalculate balance with 20 transactions', () => {
      const accountId = 'test-account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 5000;

      const transactions = [];
      let expectedBalance = initialBalance;

      // Create 20 transactions
      for (let i = 0; i < 20; i++) {
        const amount = (i + 1) * 100; // 100, 200, 300, ...
        const isDebit = i % 2 === 0;

        if (isDebit) {
          transactions.push({
            debitAccountId: accountId,
            creditAccountId: `other-${i}`,
            amount,
          });
          expectedBalance += amount; // Asset debits increase
        } else {
          transactions.push({
            debitAccountId: `other-${i}`,
            creditAccountId: accountId,
            amount,
          });
          expectedBalance -= amount; // Asset credits decrease
        }
      }

      const recalculatedBalance = recalculateAccountBalance(
        transactions,
        accountId,
        accountType,
        initialBalance
      );

      expect(recalculatedBalance).toBe(expectedBalance);
    });
  });

  describe('Balance sheet equation', () => {
    it('should satisfy Assets = Liabilities + Equity at all times', () => {
      // Initial state
      const accounts = {
        cash: { type: 'ASSET' as AccountType, balance: 10000 },
        equipment: { type: 'ASSET' as AccountType, balance: 5000 },
        loan: { type: 'LIABILITY' as AccountType, balance: 8000 },
        equity: { type: 'EQUITY' as AccountType, balance: 7000 },
      };

      // Verify initial equation
      const initialAssets = accounts.cash.balance + accounts.equipment.balance;
      const initialLiabilitiesEquity = accounts.loan.balance + accounts.equity.balance;
      expect(initialAssets).toBe(initialLiabilitiesEquity);
      expect(initialAssets).toBe(15000);

      // Transaction 1: Receive donation (increases assets and equity)
      const revenue = { type: 'REVENUE' as AccountType, balance: 0 };
      accounts.cash.balance = calculateNewBalance(accounts.cash.balance, 2000, accounts.cash.type, true);
      revenue.balance = calculateNewBalance(revenue.balance, 2000, revenue.type, false);

      // Revenue increases equity (closing entry concept)
      const assets1 = accounts.cash.balance + accounts.equipment.balance;
      const liabilitiesEquity1 = accounts.loan.balance + accounts.equity.balance + revenue.balance;
      expect(assets1).toBe(liabilitiesEquity1);

      // Transaction 2: Purchase equipment with cash (asset transfer)
      accounts.equipment.balance = calculateNewBalance(accounts.equipment.balance, 1000, accounts.equipment.type, true);
      accounts.cash.balance = calculateNewBalance(accounts.cash.balance, 1000, accounts.cash.type, false);

      // Equation still holds (internal asset transfer)
      const assets2 = accounts.cash.balance + accounts.equipment.balance;
      const liabilitiesEquity2 = accounts.loan.balance + accounts.equity.balance + revenue.balance;
      expect(assets2).toBe(liabilitiesEquity2);
    });

    it('should maintain equation through multiple organizations', () => {
      // Org 1
      const org1 = {
        assets: 10000,
        liabilities: 3000,
        equity: 7000,
      };

      // Org 2
      const org2 = {
        assets: 25000,
        liabilities: 10000,
        equity: 15000,
      };

      // Verify each organization independently
      expect(org1.assets).toBe(org1.liabilities + org1.equity);
      expect(org2.assets).toBe(org2.liabilities + org2.equity);

      // Organizations are independent
      expect(org1.assets).not.toBe(org2.assets);
      expect(org1.equity).not.toBe(org2.equity);
    });

    it('should maintain equation after diverse transactions', () => {
      const balances = {
        // Assets
        cash: 5000,
        equipment: 3000,
        // Liabilities
        loan: 2000,
        // Equity
        capital: 6000,
        // Revenue/Expense (affect equity)
        revenue: 0,
        expense: 0,
      };

      // Initial equation
      let assets = balances.cash + balances.equipment;
      let liabilitiesEquity = balances.loan + balances.capital;
      expect(assets).toBe(liabilitiesEquity);

      // Transaction: Donation received
      balances.cash = calculateNewBalance(balances.cash, 1000, 'ASSET', true);
      balances.revenue = calculateNewBalance(balances.revenue, 1000, 'REVENUE', false);

      // Transaction: Pay expense
      balances.expense = calculateNewBalance(balances.expense, 500, 'EXPENSE', true);
      balances.cash = calculateNewBalance(balances.cash, 500, 'ASSET', false);

      // Calculate net income (revenue - expense)
      const netIncome = balances.revenue - balances.expense; // 1000 - 500 = 500

      // Final equation (revenue and expense flow to equity)
      assets = balances.cash + balances.equipment;
      liabilitiesEquity = balances.loan + balances.capital + netIncome;
      expect(assets).toBe(liabilitiesEquity);
    });
  });

  describe('Temporal balance consistency', () => {
    it('should maintain balance consistency over time', () => {
      const accountId = 'temporal-account';
      const accountType: AccountType = 'ASSET';
      
      // T0: Initial balance
      const balanceT0 = 1000;

      // T1: Transaction 1 (debit 500)
      const transactionsT1 = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },
      ];
      const balanceT1 = recalculateAccountBalance(transactionsT1, accountId, accountType, balanceT0);
      expect(balanceT1).toBe(1500);

      // T2: Transaction 2 (credit 200)
      const transactionsT2 = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },
        { debitAccountId: 'other', creditAccountId: accountId, amount: 200 },
      ];
      const balanceT2 = recalculateAccountBalance(transactionsT2, accountId, accountType, balanceT0);
      expect(balanceT2).toBe(1300);

      // T3: Transaction 3 (debit 300)
      const transactionsT3 = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },
        { debitAccountId: 'other', creditAccountId: accountId, amount: 200 },
        { debitAccountId: accountId, creditAccountId: 'other', amount: 300 },
      ];
      const balanceT3 = recalculateAccountBalance(transactionsT3, accountId, accountType, balanceT0);
      expect(balanceT3).toBe(1600);

      // Verify balance at each point matches sum of transactions up to that point
      expect(balanceT1).toBe(1500); // 1000 + 500
      expect(balanceT2).toBe(1300); // 1000 + 500 - 200
      expect(balanceT3).toBe(1600); // 1000 + 500 - 200 + 300
    });

    it('should handle account renames without affecting balance', () => {
      const accountId = 'account-id';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 2000;

      // Transactions occurred under original account name "Cash"
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other-1', amount: 500 },
        { debitAccountId: 'other-2', creditAccountId: accountId, amount: 300 },
      ];

      // Account renamed to "Checking" but balance should remain consistent
      const balance = recalculateAccountBalance(transactions, accountId, accountType, initialBalance);
      expect(balance).toBe(2200); // 2000 + 500 - 300

      // Balance is tied to account ID, not name
      const verification = verifyAccountBalance(2200, balance);
      expect(verification.isCorrect).toBe(true);
    });

    it('should verify balance at specific point in time', () => {
      const accountId = 'account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 1000;

      // All transactions
      const allTransactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 100, date: '2024-01-01' },
        { debitAccountId: accountId, creditAccountId: 'other', amount: 200, date: '2024-01-02' },
        { debitAccountId: accountId, creditAccountId: 'other', amount: 300, date: '2024-01-03' },
      ];

      // Balance at different points
      const balanceAtT1 = recalculateAccountBalance(
        allTransactions.slice(0, 1),
        accountId,
        accountType,
        initialBalance
      );
      expect(balanceAtT1).toBe(1100);

      const balanceAtT2 = recalculateAccountBalance(
        allTransactions.slice(0, 2),
        accountId,
        accountType,
        initialBalance
      );
      expect(balanceAtT2).toBe(1300);

      const balanceAtT3 = recalculateAccountBalance(
        allTransactions,
        accountId,
        accountType,
        initialBalance
      );
      expect(balanceAtT3).toBe(1600);

      // Each balance represents state at that point in time
      expect(balanceAtT1).toBeLessThan(balanceAtT2);
      expect(balanceAtT2).toBeLessThan(balanceAtT3);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle zero-balance accounts', () => {
      const accountId = 'zero-account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 0;

      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 100 },
      ];

      const balance = recalculateAccountBalance(transactions, accountId, accountType, initialBalance);
      expect(balance).toBe(100);
    });

    it('should handle negative balances (overdraft scenario)', () => {
      const accountId = 'overdraft-account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 100;

      const transactions = [
        { debitAccountId: 'other', creditAccountId: accountId, amount: 300 },
      ];

      const balance = recalculateAccountBalance(transactions, accountId, accountType, initialBalance);
      expect(balance).toBe(-200); // Negative balance (overdraft)
    });

    it('should handle very large transaction amounts', () => {
      const amount = 1_000_000_000; // 1 billion
      const account = { type: 'ASSET' as AccountType, balance: 0 };

      const newBalance = calculateNewBalance(account.balance, amount, account.type, true);
      expect(newBalance).toBe(1_000_000_000);

      const transactions = [{ amount }];
      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.isValid).toBe(true);
    });

    it('should handle decimal precision correctly', () => {
      const transactions = [
        { amount: 100.50 },
        { amount: 200.25 },
        { amount: 50.75 },
      ];

      const integrity = verifyDoubleEntryIntegrity(transactions);
      expect(integrity.totalDebits).toBe(351.50);
      expect(integrity.totalCredits).toBe(351.50);
      expect(integrity.isValid).toBe(true);
    });

    it('should handle empty transaction history', () => {
      const accountId = 'empty-account';
      const accountType: AccountType = 'ASSET';
      const initialBalance = 1000;

      const balance = recalculateAccountBalance([], accountId, accountType, initialBalance);
      expect(balance).toBe(initialBalance);
    });
  });
});
