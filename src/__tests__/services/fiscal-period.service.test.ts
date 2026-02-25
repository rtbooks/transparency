/**
 * Unit tests for Fiscal Period Service
 *
 * Tests closing entry generation, balance zeroing, period locking,
 * and reopen/reverse functionality.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    fiscalPeriod: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/temporal/temporal-utils', () => ({
  MAX_DATE: new Date('9999-12-31T23:59:59.999Z'),
  buildCurrentVersionWhere: jest.fn((filters: any) => ({
    ...filters,
    validTo: new Date('9999-12-31T23:59:59.999Z'),
    systemTo: new Date('9999-12-31T23:59:59.999Z'),
    isDeleted: false,
  })),
  closeVersion: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/accounting/balance-calculator', () => ({
  updateAccountBalances: jest.fn(),
  reverseAccountBalances: jest.fn(),
}));

import {
  createFiscalPeriod,
  listFiscalPeriods,
  getCurrentFiscalPeriod,
  getFiscalPeriod,
  previewClose,
  executeClose,
  reopenPeriod,
  isDateInClosedPeriod,
} from '@/services/fiscal-period.service';
import { prisma } from '@/lib/prisma';
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';

const mockPrisma = prisma as any;

describe('Fiscal Period Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFiscalPeriod', () => {
    it('should create a fiscal period when no overlap exists', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.fiscalPeriod.create.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        name: 'FY 2025',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'OPEN',
      });

      const result = await createFiscalPeriod({
        organizationId: 'org-1',
        name: 'FY 2025',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      expect(result.name).toBe('FY 2025');
      expect(result.status).toBe('OPEN');
      expect(mockPrisma.fiscalPeriod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'FY 2025',
          status: 'OPEN',
        }),
      });
    });

    it('should throw if period overlaps with existing', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-existing',
        name: 'FY 2025',
      });

      await expect(createFiscalPeriod({
        organizationId: 'org-1',
        name: 'FY 2025 Duplicate',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2026-05-31'),
      })).rejects.toThrow('overlaps');
    });
  });

  describe('listFiscalPeriods', () => {
    it('should list periods ordered by start date descending', async () => {
      mockPrisma.fiscalPeriod.findMany.mockResolvedValue([
        { id: 'fp-2', name: 'FY 2026' },
        { id: 'fp-1', name: 'FY 2025' },
      ]);

      const result = await listFiscalPeriods('org-1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.fiscalPeriod.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { startDate: 'desc' },
      });
    });
  });

  describe('getCurrentFiscalPeriod', () => {
    it('should return the latest open period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-2',
        name: 'FY 2026',
        status: 'OPEN',
      });

      const result = await getCurrentFiscalPeriod('org-1');
      expect(result?.name).toBe('FY 2026');
    });
  });

  describe('getFiscalPeriod', () => {
    it('should return a period belonging to the organization', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        name: 'FY 2025',
      });

      const result = await getFiscalPeriod('fp-1', 'org-1');
      expect(result.name).toBe('FY 2025');
    });

    it('should throw if period belongs to another org', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-other',
      });

      await expect(getFiscalPeriod('fp-1', 'org-1')).rejects.toThrow('not found');
    });
  });

  describe('previewClose', () => {
    it('should generate preview of closing entries for revenue and expense accounts', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        name: 'FY 2025',
        status: 'OPEN',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: 'acct-fund',
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acct-fund',
        name: 'Net Assets Without Donor Restrictions',
      });

      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acct-rev', code: '4000', name: 'Contributions', type: 'REVENUE', currentBalance: 50000, isActive: true },
        { id: 'acct-exp', code: '5000', name: 'Program Expenses', type: 'EXPENSE', currentBalance: 40000, isActive: true },
      ]);

      const result = await previewClose('fp-1', 'org-1');

      expect(result.entries).toHaveLength(2);
      expect(result.totalRevenue).toBe(50000);
      expect(result.totalExpenses).toBe(40000);
      expect(result.netSurplusOrDeficit).toBe(10000);
      expect(result.fundBalanceAccountName).toBe('Net Assets Without Donor Restrictions');

      // Revenue closing: DR Revenue, CR Fund Balance
      const revEntry = result.entries.find(e => e.accountType === 'REVENUE');
      expect(revEntry?.closingDebitAccountId).toBe('acct-rev');
      expect(revEntry?.closingCreditAccountId).toBe('acct-fund');
      expect(revEntry?.amount).toBe(50000);

      // Expense closing: DR Fund Balance, CR Expense
      const expEntry = result.entries.find(e => e.accountType === 'EXPENSE');
      expect(expEntry?.closingDebitAccountId).toBe('acct-fund');
      expect(expEntry?.closingCreditAccountId).toBe('acct-exp');
      expect(expEntry?.amount).toBe(40000);
    });

    it('should skip accounts with zero balance', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'OPEN',
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: 'acct-fund',
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acct-fund',
        name: 'Fund Balance',
      });

      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acct-rev', code: '4000', name: 'Revenue', type: 'REVENUE', currentBalance: 0, isActive: true },
      ]);

      const result = await previewClose('fp-1', 'org-1');
      expect(result.entries).toHaveLength(0);
    });

    it('should throw if org has no fund balance account', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'OPEN',
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: null,
      });

      await expect(previewClose('fp-1', 'org-1')).rejects.toThrow('Fund Balance account configured');
    });

    it('should throw if period is not OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'CLOSED',
      });

      await expect(previewClose('fp-1', 'org-1')).rejects.toThrow('CLOSED');
    });
  });

  describe('executeClose', () => {
    it('should generate closing transactions and update period status', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        name: 'FY 2025',
        status: 'OPEN',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: 'acct-fund',
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acct-fund',
        name: 'Net Assets',
      });

      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acct-rev', code: '4000', name: 'Revenue', type: 'REVENUE', currentBalance: 50000, isActive: true },
        { id: 'acct-exp', code: '5000', name: 'Expenses', type: 'EXPENSE', currentBalance: 40000, isActive: true },
      ]);

      // Mock $transaction to execute the callback
      let txnIds: string[] = [];
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          transaction: {
            create: jest.fn().mockImplementation(() => {
              const id = `txn-${txnIds.length + 1}`;
              txnIds.push(id);
              return { id };
            }),
          },
          fiscalPeriod: {
            update: jest.fn(),
          },
        };
        return cb(tx);
      });

      (updateAccountBalances as jest.Mock).mockResolvedValue({ newDebitBalance: 0, newCreditBalance: 0 });

      const result = await executeClose('fp-1', 'org-1', 'user-1');

      expect(result.status).toBe('CLOSED');
      expect(result.entriesCreated).toBe(2);
      expect(result.closingTransactionIds).toHaveLength(2);
      expect(result.netSurplusOrDeficit).toBe(10000);
    });

    it('should throw if no accounts have non-zero balances', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'OPEN',
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: 'acct-fund',
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acct-fund',
        name: 'Fund Balance',
      });

      mockPrisma.account.findMany.mockResolvedValue([]);

      await expect(executeClose('fp-1', 'org-1', 'user-1')).rejects.toThrow('No accounts');
    });
  });

  describe('reopenPeriod', () => {
    it('should void closing transactions and set period to OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        name: 'FY 2025',
        status: 'CLOSED',
        closingTransactionIds: ['txn-1', 'txn-2'],
      });

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          transaction: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({
                id: 'txn-1', versionId: 'v1', debitAccountId: 'acct-rev', creditAccountId: 'acct-fund',
                amount: { toString: () => '50000' }, organizationId: 'org-1',
                transactionDate: new Date('2025-12-31'), type: 'CLOSING',
                validTo: new Date('9999-12-31'), isVoided: false, isDeleted: false,
              })
              .mockResolvedValueOnce({
                id: 'txn-2', versionId: 'v2', debitAccountId: 'acct-fund', creditAccountId: 'acct-exp',
                amount: { toString: () => '40000' }, organizationId: 'org-1',
                transactionDate: new Date('2025-12-31'), type: 'CLOSING',
                validTo: new Date('9999-12-31'), isVoided: false, isDeleted: false,
              }),
            updateMany: jest.fn(),
            create: jest.fn(),
          },
          fiscalPeriod: {
            update: jest.fn(),
          },
        };
        return cb(tx);
      });

      (reverseAccountBalances as jest.Mock).mockResolvedValue({ newDebitBalance: 0, newCreditBalance: 0 });

      const result = await reopenPeriod('fp-1', 'org-1', 'user-1');

      expect(result.status).toBe('OPEN');
      expect(result.message).toContain('reopened');
    });

    it('should throw if period is not CLOSED', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'OPEN',
      });

      await expect(reopenPeriod('fp-1', 'org-1', 'user-1')).rejects.toThrow('OPEN');
    });
  });

  describe('isDateInClosedPeriod', () => {
    it('should return closed=true when date falls in a closed period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        name: 'FY 2025',
        status: 'CLOSED',
      });

      const result = await isDateInClosedPeriod('org-1', new Date('2025-06-15'));

      expect(result.closed).toBe(true);
      expect(result.periodName).toBe('FY 2025');
    });

    it('should return closed=false when no closed period contains the date', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);

      const result = await isDateInClosedPeriod('org-1', new Date('2026-03-15'));

      expect(result.closed).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle reimbursement accounts with negative expense balance', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'fp-1',
        organizationId: 'org-1',
        status: 'OPEN',
      });

      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        fundBalanceAccountId: 'acct-fund',
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acct-fund',
        name: 'Fund Balance',
      });

      // Expense account with negative balance (more reimbursements than expenses)
      mockPrisma.account.findMany.mockResolvedValue([
        { id: 'acct-exp', code: '5000', name: 'Program Expenses', type: 'EXPENSE', currentBalance: -200, isActive: true },
        { id: 'acct-rev', code: '4000', name: 'Revenue', type: 'REVENUE', currentBalance: 1000, isActive: true },
      ]);

      const result = await previewClose('fp-1', 'org-1');

      // Should still generate entries for non-zero balances
      expect(result.entries).toHaveLength(2);
      const expEntry = result.entries.find(e => e.accountType === 'EXPENSE');
      expect(expEntry?.amount).toBe(200); // absolute value
      expect(result.totalExpenses).toBe(-200); // raw balance
      expect(result.netSurplusOrDeficit).toBe(1200); // 1000 - (-200) = 1200
    });
  });
});
