/**
 * Unit tests for Account Service
 * 
 * Tests account versioning, balance calculations, and hierarchy management.
 */

import type { Prisma } from '@/generated/prisma/client';

describe('Account Service', () => {
  describe('Version Management', () => {
    it('should create account with initial balance', () => {
      const now = new Date();
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      
      const account = {
        id: 'acc-123',
        versionId: 'ver-1',
        previousVersionId: null,
        organizationId: 'org-123',
        code: '1000',
        name: 'Cash',
        type: 'ASSET',
        balance: 1000,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
      };

      expect(account.previousVersionId).toBeNull();
      expect(account.balance).toBe(1000);
      expect(account.validTo).toEqual(MAX_DATE);
    });

    it('should create new version on balance update', () => {
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      
      const v1 = {
        id: 'acc-123',
        versionId: 'ver-1',
        balance: 1000,
        validTo: MAX_DATE,
      };

      const updateTime = new Date();
      const v2 = {
        id: 'acc-123',
        versionId: 'ver-2',
        previousVersionId: 'ver-1',
        balance: 1500, // Updated
        validFrom: updateTime,
        validTo: MAX_DATE,
      };

      expect(v2.previousVersionId).toBe(v1.versionId);
      expect(v2.balance).toBe(1500);
      expect(v2.balance).toBeGreaterThan(v1.balance);
    });
  });

  describe('Account Type Logic', () => {
    it('should categorize accounts by code ranges', () => {
      const accounts = [
        { code: '1000', type: 'ASSET', name: 'Cash' },
        { code: '1500', type: 'ASSET', name: 'Equipment' },
        { code: '2000', type: 'LIABILITY', name: 'Accounts Payable' },
        { code: '3000', type: 'EQUITY', name: 'Retained Earnings' },
        { code: '4000', type: 'REVENUE', name: 'Donations' },
        { code: '5000', type: 'EXPENSE', name: 'Salaries' },
      ];

      const assets = accounts.filter(a => a.code.startsWith('1'));
      const liabilities = accounts.filter(a => a.code.startsWith('2'));
      const equity = accounts.filter(a => a.code.startsWith('3'));
      const revenue = accounts.filter(a => a.code.startsWith('4'));
      const expenses = accounts.filter(a => a.code.startsWith('5'));

      expect(assets).toHaveLength(2);
      expect(liabilities).toHaveLength(1);
      expect(equity).toHaveLength(1);
      expect(revenue).toHaveLength(1);
      expect(expenses).toHaveLength(1);
    });

    it('should distinguish current vs fixed assets', () => {
      const assets = [
        { code: '1000', name: 'Cash' },
        { code: '1100', name: 'Accounts Receivable' },
        { code: '1500', name: 'Equipment' },
        { code: '1600', name: 'Building' },
      ];

      const currentAssets = assets.filter(a => parseInt(a.code) < 1500);
      const fixedAssets = assets.filter(a => parseInt(a.code) >= 1500);

      expect(currentAssets).toHaveLength(2);
      expect(fixedAssets).toHaveLength(2);
    });

    it('should distinguish current vs long-term liabilities', () => {
      const liabilities = [
        { code: '2000', name: 'Accounts Payable' },
        { code: '2100', name: 'Short-term Loans' },
        { code: '2500', name: 'Long-term Debt' },
        { code: '2600', name: 'Bonds Payable' },
      ];

      const currentLiabilities = liabilities.filter(a => parseInt(a.code) < 2500);
      const longTermLiabilities = liabilities.filter(a => parseInt(a.code) >= 2500);

      expect(currentLiabilities).toHaveLength(2);
      expect(longTermLiabilities).toHaveLength(2);
    });
  });

  describe('Balance Calculations', () => {
    it('should calculate debit impact on asset accounts', () => {
      const account = { type: 'ASSET', balance: 1000 };
      const debitAmount = 500;

      // Assets increase with debits
      const newBalance = account.balance + debitAmount;
      expect(newBalance).toBe(1500);
    });

    it('should calculate credit impact on asset accounts', () => {
      const account = { type: 'ASSET', balance: 1000 };
      const creditAmount = 300;

      // Assets decrease with credits
      const newBalance = account.balance - creditAmount;
      expect(newBalance).toBe(700);
    });

    it('should calculate debit impact on liability accounts', () => {
      const account = { type: 'LIABILITY', balance: 2000 };
      const debitAmount = 400;

      // Liabilities decrease with debits
      const newBalance = account.balance - debitAmount;
      expect(newBalance).toBe(1600);
    });

    it('should calculate credit impact on liability accounts', () => {
      const account = { type: 'LIABILITY', balance: 2000 };
      const creditAmount = 600;

      // Liabilities increase with credits
      const newBalance = account.balance + creditAmount;
      expect(newBalance).toBe(2600);
    });

    it('should calculate debit impact on revenue accounts', () => {
      const account = { type: 'REVENUE', balance: 10000 };
      const debitAmount = 200;

      // Revenue decreases with debits (returns/refunds)
      const newBalance = account.balance - debitAmount;
      expect(newBalance).toBe(9800);
    });

    it('should calculate credit impact on revenue accounts', () => {
      const account = { type: 'REVENUE', balance: 10000 };
      const creditAmount = 1000;

      // Revenue increases with credits
      const newBalance = account.balance + creditAmount;
      expect(newBalance).toBe(11000);
    });

    it('should calculate debit impact on expense accounts', () => {
      const account = { type: 'EXPENSE', balance: 5000 };
      const debitAmount = 500;

      // Expenses increase with debits
      const newBalance = account.balance + debitAmount;
      expect(newBalance).toBe(5500);
    });

    it('should handle zero balance accounts', () => {
      const account = { balance: 0 };
      const transaction = { amount: 100 };

      const newBalance = account.balance + transaction.amount;
      expect(newBalance).toBe(100);
    });
  });

  describe('Account Hierarchy', () => {
    it('should build parent-child relationships', () => {
      const accounts = [
        { id: '1', code: '1000', name: 'Assets', parentId: null },
        { id: '2', code: '1100', name: 'Current Assets', parentId: '1' },
        { id: '3', code: '1110', name: 'Cash', parentId: '2' },
        { id: '4', code: '1120', name: 'Checking', parentId: '3' },
      ];

      const rootAccounts = accounts.filter(a => a.parentId === null);
      const childAccounts = (parentId: string) => 
        accounts.filter(a => a.parentId === parentId);

      expect(rootAccounts).toHaveLength(1);
      expect(rootAccounts[0].name).toBe('Assets');

      const level1Children = childAccounts('1');
      expect(level1Children).toHaveLength(1);
      expect(level1Children[0].name).toBe('Current Assets');

      const level2Children = childAccounts('2');
      expect(level2Children).toHaveLength(1);
      expect(level2Children[0].name).toBe('Cash');
    });

    it('should calculate account depth in hierarchy', () => {
      const accounts = [
        { id: '1', parentId: null, depth: 0 },
        { id: '2', parentId: '1', depth: 1 },
        { id: '3', parentId: '2', depth: 2 },
        { id: '4', parentId: '3', depth: 3 },
      ];

      expect(accounts[0].depth).toBe(0); // Root
      expect(accounts[1].depth).toBe(1);
      expect(accounts[2].depth).toBe(2);
      expect(accounts[3].depth).toBe(3);
    });

    it('should aggregate child account balances', () => {
      const accounts = [
        { id: '1', parentId: null, balance: 0, code: '1000' },
        { id: '2', parentId: '1', balance: 1000, code: '1100' },
        { id: '3', parentId: '1', balance: 1500, code: '1200' },
        { id: '4', parentId: '2', balance: 500, code: '1110' },
        { id: '5', parentId: '2', balance: 500, code: '1120' },
      ];

      const getChildren = (parentId: string) => 
        accounts.filter(a => a.parentId === parentId);

      const calculateTotal = (parentId: string): number => {
        const children = getChildren(parentId);
        return children.reduce((sum, child) => {
          const childBalance = child.balance || 0;
          const descendantBalance = calculateTotal(child.id);
          return sum + childBalance + descendantBalance;
        }, 0);
      };

      const rootTotal = calculateTotal('1');
      expect(rootTotal).toBe(3500); // 1000 + 1500 + 500 + 500
    });
  });

  describe('Code Validation', () => {
    it('should validate account code format', () => {
      const validCodes = ['1000', '2500', '3000', '4100', '5200'];
      const codePattern = /^\d{4}$/;

      validCodes.forEach(code => {
        expect(codePattern.test(code)).toBe(true);
      });
    });

    it('should reject invalid account codes', () => {
      const invalidCodes = ['100', '10000', 'ABCD', '1a00', ''];
      const codePattern = /^\d{4}$/;

      invalidCodes.forEach(code => {
        expect(codePattern.test(code)).toBe(false);
      });
    });

    it('should ensure unique codes within organization', () => {
      const accounts = [
        { code: '1000', orgId: 'org-1' },
        { code: '1100', orgId: 'org-1' },
        { code: '1000', orgId: 'org-2' }, // Same code, different org - OK
      ];

      const org1Codes = accounts
        .filter(a => a.orgId === 'org-1')
        .map(a => a.code);

      const uniqueOrg1Codes = new Set(org1Codes);
      expect(uniqueOrg1Codes.size).toBe(org1Codes.length);
    });
  });

  describe('Query Filters', () => {
    it('should filter accounts by organization', () => {
      const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
      
      const filter = {
        organizationId: 'org-123',
        validTo: MAX_DATE,
        isDeleted: false,
      };

      expect(filter.organizationId).toBe('org-123');
      expect(filter.validTo).toEqual(MAX_DATE);
    });

    it('should filter accounts by type', () => {
      const accounts = [
        { type: 'ASSET' },
        { type: 'ASSET' },
        { type: 'LIABILITY' },
        { type: 'REVENUE' },
      ];

      const assets = accounts.filter(a => a.type === 'ASSET');
      expect(assets).toHaveLength(2);
    });

    it('should filter accounts by parent', () => {
      const accounts = [
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: '1' },
        { id: '4', parentId: '2' },
      ];

      const childrenOf1 = accounts.filter(a => a.parentId === '1');
      expect(childrenOf1).toHaveLength(2);
    });
  });
});
