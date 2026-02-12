/**
 * Unit tests for Balance Verification
 * 
 * Tests balance recalculation, verification, summaries, and double-entry integrity.
 * These are CRITICAL - any errors here could fail to detect financial data corruption.
 */

import { AccountType } from '@/generated/prisma/client';
import {
  recalculateAccountBalance,
  verifyAccountBalance,
  calculateBalanceSummary,
  verifyDoubleEntryIntegrity,
  calculateHierarchicalBalance,
} from '@/lib/accounting/balance-verification';

describe('Balance Verification', () => {
  describe('recalculateAccountBalance()', () => {
    const accountId = 'test-account-id';

    describe('ASSET accounts', () => {
      const accountType: AccountType = 'ASSET';

      it('should return initialBalance with empty transaction history', () => {
        const result = recalculateAccountBalance([], accountId, accountType, 1000);
        expect(result).toBe(1000);
      });

      it('should return 0 with empty history and no initialBalance', () => {
        const result = recalculateAccountBalance([], accountId, accountType);
        expect(result).toBe(0);
      });

      it('should calculate correct balance with single debit transaction', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other-id', amount: 500 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(1500); // 1000 + 500
      });

      it('should calculate correct balance with single credit transaction', () => {
        const transactions = [
          { debitAccountId: 'other-id', creditAccountId: accountId, amount: 300 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(700); // 1000 - 300
      });

      it('should calculate correct balance with multiple debit transactions', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other-1', amount: 100 },
          { debitAccountId: accountId, creditAccountId: 'other-2', amount: 200 },
          { debitAccountId: accountId, creditAccountId: 'other-3', amount: 150 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(1450); // 1000 + 100 + 200 + 150
      });

      it('should calculate correct balance with multiple credit transactions', () => {
        const transactions = [
          { debitAccountId: 'other-1', creditAccountId: accountId, amount: 100 },
          { debitAccountId: 'other-2', creditAccountId: accountId, amount: 200 },
          { debitAccountId: 'other-3', creditAccountId: accountId, amount: 50 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(650); // 1000 - 100 - 200 - 50
      });

      it('should calculate correct balance with mixed debits and credits', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other-1', amount: 500 },  // +500
          { debitAccountId: 'other-2', creditAccountId: accountId, amount: 200 },  // -200
          { debitAccountId: accountId, creditAccountId: 'other-3', amount: 300 },  // +300
          { debitAccountId: 'other-4', creditAccountId: accountId, amount: 100 },  // -100
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(1500); // 1000 + 500 - 200 + 300 - 100
      });

      it('should ignore transactions not involving the account', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },     // Affects account
          { debitAccountId: 'unrelated-1', creditAccountId: 'unrelated-2', amount: 999 }, // Ignored
          { debitAccountId: 'other', creditAccountId: accountId, amount: 200 },     // Affects account
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(1300); // 1000 + 500 - 200
      });
    });

    describe('LIABILITY accounts', () => {
      const accountType: AccountType = 'LIABILITY';

      it('should calculate correct balance with credits increasing', () => {
        const transactions = [
          { debitAccountId: 'other', creditAccountId: accountId, amount: 500 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(1500); // 1000 + 500 (credit increases)
      });

      it('should calculate correct balance with debits decreasing', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other', amount: 300 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 1000);
        expect(result).toBe(700); // 1000 - 300 (debit decreases)
      });
    });

    describe('REVENUE accounts', () => {
      const accountType: AccountType = 'REVENUE';

      it('should calculate correct balance with credits increasing revenue', () => {
        const transactions = [
          { debitAccountId: 'checking', creditAccountId: accountId, amount: 1000 },
          { debitAccountId: 'checking', creditAccountId: accountId, amount: 2000 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 0);
        expect(result).toBe(3000);
      });

      it('should calculate correct balance with refund (debit decreases revenue)', () => {
        const transactions = [
          { debitAccountId: 'checking', creditAccountId: accountId, amount: 1000 },
          { debitAccountId: accountId, creditAccountId: 'checking', amount: 200 }, // Refund
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 0);
        expect(result).toBe(800);
      });
    });

    describe('EXPENSE accounts', () => {
      const accountType: AccountType = 'EXPENSE';

      it('should calculate correct balance with debits increasing expense', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'cash', amount: 500 },
          { debitAccountId: accountId, creditAccountId: 'cash', amount: 250 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, accountType, 0);
        expect(result).toBe(750);
      });
    });

    describe('Edge cases', () => {
      it('should handle Prisma Decimal amounts', () => {
        const transactions = [
          { 
            debitAccountId: accountId, 
            creditAccountId: 'other', 
            amount: { toString: () => '500.50' } 
          },
        ];
        const result = recalculateAccountBalance(transactions, accountId, 'ASSET', 1000);
        expect(result).toBe(1500.50);
      });

      it('should handle decimal precision correctly', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other', amount: 100.50 },
          { debitAccountId: accountId, creditAccountId: 'other', amount: 200.25 },
          { debitAccountId: 'other', creditAccountId: accountId, amount: 50.75 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, 'ASSET', 0);
        expect(result).toBe(250); // 0 + 100.50 + 200.25 - 50.75
      });

      it('should handle zero initial balance', () => {
        const transactions = [
          { debitAccountId: accountId, creditAccountId: 'other', amount: 100 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, 'ASSET', 0);
        expect(result).toBe(100);
      });

      it('should handle negative balance results', () => {
        const transactions = [
          { debitAccountId: 'other', creditAccountId: accountId, amount: 500 },
        ];
        const result = recalculateAccountBalance(transactions, accountId, 'ASSET', 100);
        expect(result).toBe(-400); // 100 - 500
      });
    });
  });

  describe('verifyAccountBalance()', () => {
    it('should return isCorrect: true for matching balances', () => {
      const result = verifyAccountBalance(1000, 1000);
      expect(result.isCorrect).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should return isCorrect: false for mismatched balances', () => {
      const result = verifyAccountBalance(1000, 1100);
      expect(result.isCorrect).toBe(false);
      expect(result.difference).toBe(100);
    });

    it('should allow floating point precision errors (< 1 cent)', () => {
      const result = verifyAccountBalance(100.001, 100.002);
      expect(result.isCorrect).toBe(true);
      expect(result.difference).toBeLessThan(0.01);
    });

    it('should detect discrepancies >= 1 cent', () => {
      const result = verifyAccountBalance(100, 100.01);
      expect(result.isCorrect).toBe(false);
      expect(result.difference).toBeCloseTo(0.01, 2);
    });

    it('should handle Prisma Decimal current balance', () => {
      const currentBalance = { toString: () => '1000.50' };
      const result = verifyAccountBalance(currentBalance, 1000.50);
      expect(result.isCorrect).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should calculate difference correctly', () => {
      const result = verifyAccountBalance(1000, 1250);
      expect(result.difference).toBe(250);
    });

    it('should calculate difference as absolute value', () => {
      const result1 = verifyAccountBalance(1000, 1250);
      const result2 = verifyAccountBalance(1250, 1000);
      expect(result1.difference).toBe(250);
      expect(result2.difference).toBe(250);
    });
  });

  describe('calculateBalanceSummary()', () => {
    const accountId = 'test-account';
    const accountName = 'Test Account';
    const accountType: AccountType = 'ASSET';

    it('should calculate correct totals for account with debits only', () => {
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other-1', amount: 100 },
        { debitAccountId: accountId, creditAccountId: 'other-2', amount: 200 },
        { debitAccountId: accountId, creditAccountId: 'other-3', amount: 150 },
      ];
      const result = calculateBalanceSummary(accountId, accountName, accountType, 1000, transactions);
      
      expect(result.accountId).toBe(accountId);
      expect(result.accountName).toBe(accountName);
      expect(result.accountType).toBe(accountType);
      expect(result.currentBalance).toBe(1000);
      expect(result.totalDebits).toBe(450);
      expect(result.totalCredits).toBe(0);
      expect(result.transactionCount).toBe(3);
    });

    it('should calculate correct totals for account with credits only', () => {
      const transactions = [
        { debitAccountId: 'other-1', creditAccountId: accountId, amount: 100 },
        { debitAccountId: 'other-2', creditAccountId: accountId, amount: 200 },
      ];
      const result = calculateBalanceSummary(accountId, accountName, accountType, 500, transactions);
      
      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(300);
      expect(result.transactionCount).toBe(2);
    });

    it('should calculate correct totals for account with mixed transactions', () => {
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 500 },
        { debitAccountId: 'other', creditAccountId: accountId, amount: 200 },
        { debitAccountId: accountId, creditAccountId: 'other', amount: 300 },
      ];
      const result = calculateBalanceSummary(accountId, accountName, accountType, 1000, transactions);
      
      expect(result.totalDebits).toBe(800);
      expect(result.totalCredits).toBe(200);
      expect(result.transactionCount).toBe(3);
    });

    it('should handle account with no transactions', () => {
      const result = calculateBalanceSummary(accountId, accountName, accountType, 1000, []);
      
      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.currentBalance).toBe(1000);
    });

    it('should handle Prisma Decimal amounts', () => {
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: { toString: () => '100.50' } },
        { debitAccountId: 'other', creditAccountId: accountId, amount: { toString: () => '50.25' } },
      ];
      const currentBalance = { toString: () => '1000.75' };
      const result = calculateBalanceSummary(accountId, accountName, accountType, currentBalance, transactions);
      
      expect(result.currentBalance).toBe(1000.75);
      expect(result.totalDebits).toBe(100.50);
      expect(result.totalCredits).toBe(50.25);
    });

    it('should ignore transactions not involving the account', () => {
      const transactions = [
        { debitAccountId: accountId, creditAccountId: 'other', amount: 100 },
        { debitAccountId: 'unrelated-1', creditAccountId: 'unrelated-2', amount: 999 },
        { debitAccountId: 'other', creditAccountId: accountId, amount: 50 },
      ];
      const result = calculateBalanceSummary(accountId, accountName, accountType, 1000, transactions);
      
      expect(result.totalDebits).toBe(100);
      expect(result.totalCredits).toBe(50);
      expect(result.transactionCount).toBe(2);
    });
  });

  describe('verifyDoubleEntryIntegrity()', () => {
    it('should return isValid: true when system is balanced', () => {
      const transactions = [
        { amount: 100 },
        { amount: 200 },
        { amount: 50 },
      ];
      const result = verifyDoubleEntryIntegrity(transactions);
      
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(350);
      expect(result.totalCredits).toBe(350);
      expect(result.difference).toBe(0);
    });

    it('should handle empty transaction set', () => {
      const result = verifyDoubleEntryIntegrity([]);
      
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.difference).toBe(0);
    });

    it('should handle single transaction', () => {
      const transactions = [{ amount: 500 }];
      const result = verifyDoubleEntryIntegrity(transactions);
      
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(500);
      expect(result.totalCredits).toBe(500);
    });

    it('should handle Prisma Decimal amounts', () => {
      const transactions = [
        { amount: { toString: () => '100.50' } },
        { amount: { toString: () => '200.25' } },
      ];
      const result = verifyDoubleEntryIntegrity(transactions);
      
      expect(result.totalDebits).toBe(300.75);
      expect(result.totalCredits).toBe(300.75);
      expect(result.isValid).toBe(true);
    });

    it('should allow floating point precision errors', () => {
      // Simulate floating point errors
      const transactions = [
        { amount: 0.1 },
        { amount: 0.2 },
      ];
      const result = verifyDoubleEntryIntegrity(transactions);
      
      expect(result.isValid).toBe(true);
      expect(result.difference).toBeLessThan(0.01);
    });

    it('should handle large numbers of transactions', () => {
      const transactions = Array(1000).fill({ amount: 100 });
      const result = verifyDoubleEntryIntegrity(transactions);
      
      expect(result.totalDebits).toBe(100000);
      expect(result.totalCredits).toBe(100000);
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateHierarchicalBalance()', () => {
    it('should return 0 for non-existent account', () => {
      const accounts = [
        { id: 'acc-1', parentAccountId: null, currentBalance: 1000 },
      ];
      const result = calculateHierarchicalBalance('non-existent', accounts);
      expect(result).toBe(0);
    });

    it('should return own balance for account with no children', () => {
      const accounts = [
        { id: 'acc-1', parentAccountId: null, currentBalance: 1000 },
      ];
      const result = calculateHierarchicalBalance('acc-1', accounts);
      expect(result).toBe(1000);
    });

    it('should calculate parent + direct children correctly', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: 1000 },
        { id: 'child-1', parentAccountId: 'parent', currentBalance: 200 },
        { id: 'child-2', parentAccountId: 'parent', currentBalance: 300 },
      ];
      const result = calculateHierarchicalBalance('parent', accounts);
      expect(result).toBe(1500); // 1000 + 200 + 300
    });

    it('should calculate parent + children + grandchildren (3 levels)', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: 1000 },
        { id: 'child-1', parentAccountId: 'parent', currentBalance: 200 },
        { id: 'child-2', parentAccountId: 'parent', currentBalance: 300 },
        { id: 'grandchild-1', parentAccountId: 'child-1', currentBalance: 50 },
        { id: 'grandchild-2', parentAccountId: 'child-1', currentBalance: 75 },
      ];
      const result = calculateHierarchicalBalance('parent', accounts);
      expect(result).toBe(1625); // 1000 + 200 + 300 + 50 + 75
    });

    it('should not double-count when calculating child balance', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: 1000 },
        { id: 'child', parentAccountId: 'parent', currentBalance: 200 },
        { id: 'grandchild', parentAccountId: 'child', currentBalance: 50 },
      ];
      
      // Child's hierarchical balance should be child + grandchild only
      const childResult = calculateHierarchicalBalance('child', accounts);
      expect(childResult).toBe(250); // 200 + 50 (no parent)
      
      // Parent's should include all
      const parentResult = calculateHierarchicalBalance('parent', accounts);
      expect(parentResult).toBe(1250); // 1000 + 200 + 50
    });

    it('should handle Prisma Decimal balances', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: { toString: () => '1000.50' } },
        { id: 'child', parentAccountId: 'parent', currentBalance: { toString: () => '200.25' } },
      ];
      const result = calculateHierarchicalBalance('parent', accounts);
      expect(result).toBe(1200.75);
    });

    it('should handle negative balances', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: 1000 },
        { id: 'child', parentAccountId: 'parent', currentBalance: -200 },
      ];
      const result = calculateHierarchicalBalance('parent', accounts);
      expect(result).toBe(800);
    });

    it('should handle zero balances', () => {
      const accounts = [
        { id: 'parent', parentAccountId: null, currentBalance: 0 },
        { id: 'child', parentAccountId: 'parent', currentBalance: 0 },
      ];
      const result = calculateHierarchicalBalance('parent', accounts);
      expect(result).toBe(0);
    });

    it('should handle complex hierarchy (5 levels deep)', () => {
      const accounts = [
        { id: 'level-1', parentAccountId: null, currentBalance: 100 },
        { id: 'level-2', parentAccountId: 'level-1', currentBalance: 100 },
        { id: 'level-3', parentAccountId: 'level-2', currentBalance: 100 },
        { id: 'level-4', parentAccountId: 'level-3', currentBalance: 100 },
        { id: 'level-5', parentAccountId: 'level-4', currentBalance: 100 },
      ];
      const result = calculateHierarchicalBalance('level-1', accounts);
      expect(result).toBe(500); // All 5 levels
    });

    it('should handle multiple branches correctly', () => {
      const accounts = [
        { id: 'root', parentAccountId: null, currentBalance: 1000 },
        { id: 'branch-a', parentAccountId: 'root', currentBalance: 200 },
        { id: 'branch-b', parentAccountId: 'root', currentBalance: 300 },
        { id: 'leaf-a1', parentAccountId: 'branch-a', currentBalance: 50 },
        { id: 'leaf-a2', parentAccountId: 'branch-a', currentBalance: 75 },
        { id: 'leaf-b1', parentAccountId: 'branch-b', currentBalance: 100 },
      ];
      const result = calculateHierarchicalBalance('root', accounts);
      expect(result).toBe(1725); // 1000 + 200 + 300 + 50 + 75 + 100
    });
  });
});
