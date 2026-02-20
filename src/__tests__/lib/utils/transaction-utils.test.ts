/**
 * Unit tests for Transaction Utilities
 * 
 * Tests transaction type helpers, validation, and payload preparation.
 */

import {
  TransactionType,
  TransactionFormData,
  getAccountTypesForTransaction,
  validateTransaction,
  prepareTransactionPayload,
} from '@/lib/utils/transaction-utils';

describe('Transaction Utilities', () => {
  describe('getAccountTypesForTransaction()', () => {
    it('should return correct account types for INCOME transaction', () => {
      const result = getAccountTypesForTransaction('INCOME');
      
      expect(result.fromTypes).toEqual(['REVENUE']);
      expect(result.toTypes).toEqual(['ASSET']);
      expect(result.fromLabel).toBe('Revenue Account');
      expect(result.toLabel).toBe('Deposit To (Cash/Bank)');
    });

    it('should return correct account types for EXPENSE transaction', () => {
      const result = getAccountTypesForTransaction('EXPENSE');
      
      expect(result.fromTypes).toEqual(['ASSET']);
      expect(result.toTypes).toEqual(['EXPENSE']);
      expect(result.fromLabel).toBe('Pay From (Cash/Bank)');
      expect(result.toLabel).toBe('Expense Account');
    });

    it('should return correct account types for TRANSFER transaction', () => {
      const result = getAccountTypesForTransaction('TRANSFER');
      
      expect(result.fromTypes).toEqual(['ASSET']);
      expect(result.toTypes).toEqual(['ASSET']);
      expect(result.fromLabel).toBe('Transfer From');
      expect(result.toLabel).toBe('Transfer To');
    });

    it('should return correct account types for GENERAL transaction', () => {
      const result = getAccountTypesForTransaction('GENERAL');
      
      expect(result.fromTypes).toEqual(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
      expect(result.toTypes).toEqual(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
      expect(result.fromLabel).toBe('Credit Account (Source)');
      expect(result.toLabel).toBe('Debit Account (Destination)');
    });

    it('should handle all transaction types without errors', () => {
      const types: TransactionType[] = ['INCOME', 'EXPENSE', 'TRANSFER', 'GENERAL'];
      
      types.forEach(type => {
        const result = getAccountTypesForTransaction(type);
        expect(result).toBeDefined();
        expect(result.fromTypes).toBeDefined();
        expect(result.toTypes).toBeDefined();
        expect(result.fromLabel).toBeDefined();
        expect(result.toLabel).toBeDefined();
      });
    });
  });

  describe('validateTransaction()', () => {
    const baseData: TransactionFormData = {
      type: 'INCOME',
      date: new Date(),
      amount: 100,
      description: 'Test transaction',
      fromAccountId: 'revenue-id',
      toAccountId: 'asset-id',
    };

    describe('Amount validation', () => {
      it('should return null for valid positive amount', () => {
        const result = validateTransaction(baseData);
        expect(result).toBeNull();
      });

      it('should reject zero amount', () => {
        const data = { ...baseData, amount: 0 };
        const result = validateTransaction(data);
        expect(result).toBe('Amount must be greater than zero');
      });

      it('should reject negative amount', () => {
        const data = { ...baseData, amount: -100 };
        const result = validateTransaction(data);
        expect(result).toBe('Amount must be greater than zero');
      });

      it('should accept decimal amounts', () => {
        const data = { ...baseData, amount: 123.45 };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });

      it('should accept very small amounts', () => {
        const data = { ...baseData, amount: 0.01 };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });

      it('should accept very large amounts', () => {
        const data = { ...baseData, amount: 1_000_000 };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });
    });

    describe('TRANSFER validation', () => {
      it('should reject transfer to same account', () => {
        const data: TransactionFormData = {
          type: 'TRANSFER',
          date: new Date(),
          amount: 100,
          description: 'Transfer',
          fromAccountId: 'same-account',
          toAccountId: 'same-account',
        };
        const result = validateTransaction(data);
        expect(result).toBe('Cannot transfer to the same account');
      });

      it('should accept transfer between different accounts', () => {
        const data: TransactionFormData = {
          type: 'TRANSFER',
          date: new Date(),
          amount: 100,
          description: 'Transfer',
          fromAccountId: 'account-1',
          toAccountId: 'account-2',
        };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });
    });

    describe('GENERAL transaction validation', () => {
      it('should reject when debit and credit are same account', () => {
        const data: TransactionFormData = {
          type: 'GENERAL',
          date: new Date(),
          amount: 100,
          description: 'General entry',
          fromAccountId: 'same-account',
          toAccountId: 'same-account',
        };
        const result = validateTransaction(data);
        expect(result).toBe('Debit and credit accounts must be different');
      });

      it('should accept when debit and credit are different accounts', () => {
        const data: TransactionFormData = {
          type: 'GENERAL',
          date: new Date(),
          amount: 100,
          description: 'General entry',
          fromAccountId: 'credit-account',
          toAccountId: 'debit-account',
        };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });
    });

    describe('INCOME validation', () => {
      it('should accept valid income transaction', () => {
        const data: TransactionFormData = {
          type: 'INCOME',
          date: new Date(),
          amount: 500,
          description: 'Donation received',
          fromAccountId: 'revenue',
          toAccountId: 'checking',
        };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });

      it('should still validate amount for income', () => {
        const data: TransactionFormData = {
          type: 'INCOME',
          date: new Date(),
          amount: -100,
          description: 'Invalid income',
          fromAccountId: 'revenue',
          toAccountId: 'checking',
        };
        const result = validateTransaction(data);
        expect(result).toBe('Amount must be greater than zero');
      });
    });

    describe('EXPENSE validation', () => {
      it('should accept valid expense transaction', () => {
        const data: TransactionFormData = {
          type: 'EXPENSE',
          date: new Date(),
          amount: 250,
          description: 'Office supplies',
          fromAccountId: 'checking',
          toAccountId: 'supplies-expense',
        };
        const result = validateTransaction(data);
        expect(result).toBeNull();
      });
    });
  });

  describe('prepareTransactionPayload()', () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    describe('INCOME transactions', () => {
      it('should prepare correct payload with all fields', () => {
        const data: TransactionFormData = {
          type: 'INCOME',
          date: testDate,
          amount: 1000,
          description: 'Donation received',
          referenceNumber: 'DON-001',
          fromAccountId: 'revenue-id',
          toAccountId: 'checking-id',
        };
        
        const result = prepareTransactionPayload(data);
        
        expect(result.date).toBe(testDate.toISOString());
        expect(result.amount).toBe(1000);
        expect(result.description).toBe('Donation received');
        expect(result.referenceNumber).toBe('DON-001');
        expect(result.debitAccountId).toBe('checking-id');
        expect(result.creditAccountId).toBe('revenue-id');
      });

      it('should set referenceNumber to null when not provided', () => {
        const data: TransactionFormData = {
          type: 'INCOME',
          date: testDate,
          amount: 500,
          description: 'Cash donation',
          fromAccountId: 'revenue-id',
          toAccountId: 'cash-id',
        };
        
        const result = prepareTransactionPayload(data);
        expect(result.referenceNumber).toBeNull();
      });
    });

    describe('EXPENSE transactions', () => {
      it('should prepare correct payload for expense', () => {
        const data: TransactionFormData = {
          type: 'EXPENSE',
          date: testDate,
          amount: 250,
          description: 'Office supplies',
          referenceNumber: 'CHK-123',
          fromAccountId: 'checking-id',
          toAccountId: 'supplies-expense-id',
        };
        
        const result = prepareTransactionPayload(data);
        
        expect(result.debitAccountId).toBe('supplies-expense-id');
        expect(result.creditAccountId).toBe('checking-id');
        expect(result.amount).toBe(250);
        expect(result.description).toBe('Office supplies');
      });
    });

    describe('TRANSFER transactions', () => {
      it('should prepare correct payload for transfer', () => {
        const data: TransactionFormData = {
          type: 'TRANSFER',
          date: testDate,
          amount: 500,
          description: 'Transfer to savings',
          fromAccountId: 'checking-id',
          toAccountId: 'savings-id',
        };
        
        const result = prepareTransactionPayload(data);
        
        expect(result.debitAccountId).toBe('savings-id');
        expect(result.creditAccountId).toBe('checking-id');
        expect(result.amount).toBe(500);
      });
    });

    describe('GENERAL transactions', () => {
      it('should prepare correct payload for general journal entry', () => {
        const data: TransactionFormData = {
          type: 'GENERAL',
          date: testDate,
          amount: 1500,
          description: 'Adjusting entry',
          referenceNumber: 'ADJ-2024-01',
          fromAccountId: 'credit-account-id', // Credit Account (Source)
          toAccountId: 'debit-account-id',    // Debit Account (Destination)
        };
        
        const result = prepareTransactionPayload(data);
        
        expect(result.debitAccountId).toBe('debit-account-id');
        expect(result.creditAccountId).toBe('credit-account-id');
        expect(result.amount).toBe(1500);
        expect(result.description).toBe('Adjusting entry');
        expect(result.referenceNumber).toBe('ADJ-2024-01');
      });
    });
  });
});
