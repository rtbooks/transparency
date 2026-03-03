import {
  startReconciliation,
  getLastEndingBalance,
  getReconciliationDetail,
  toggleReconciliationItem,
  completeReconciliation,
  deleteReconciliation,
  listReconciliations,
} from '@/services/account-reconciliation.service';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: { findFirst: jest.fn(), findMany: jest.fn() },
    accountReconciliation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reconciliationItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({
      transaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      accountReconciliation: {
        update: jest.fn(),
      },
    })),
  },
}));

// Mock temporal utils
jest.mock('@/lib/temporal/temporal-utils', () => ({
  buildCurrentVersionWhere: jest.fn((where: Record<string, unknown>) => ({
    ...where,
    validTo: new Date('9999-12-31T23:59:59.999Z'),
    isDeleted: false,
  })),
  closeVersion: jest.fn(),
  buildNewVersionData: jest.fn((current: Record<string, unknown>, updates: Record<string, unknown>) => ({
    ...current,
    ...updates,
    versionId: 'new-version-id',
  })),
}));

import { prisma } from '@/lib/prisma';

const mockAccount = {
  id: 'acct-1',
  versionId: 'acct-v1',
  code: '1000',
  name: 'Checking Account',
  type: 'ASSET',
  organizationId: 'org-1',
};

describe('account-reconciliation.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('startReconciliation', () => {
    it('should create a new reconciliation', async () => {
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.accountReconciliation.create as jest.Mock).mockResolvedValue({
        id: 'recon-1',
        organizationId: 'org-1',
        accountId: 'acct-1',
        status: 'IN_PROGRESS',
      });

      const result = await startReconciliation({
        organizationId: 'org-1',
        accountId: 'acct-1',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        beginningBalance: 1000,
        endingBalance: 1500,
        createdBy: 'user-1',
      });

      expect(result.id).toBe('recon-1');
      expect(prisma.accountReconciliation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'acct-1',
          beginningBalance: 1000,
          endingBalance: 1500,
        }),
      });
    });

    it('should reject if account not found', async () => {
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(startReconciliation({
        organizationId: 'org-1',
        accountId: 'nonexistent',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        beginningBalance: 0,
        endingBalance: 0,
        createdBy: 'user-1',
      })).rejects.toThrow('Account not found');
    });

    it('should reject if in-progress reconciliation exists', async () => {
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(startReconciliation({
        organizationId: 'org-1',
        accountId: 'acct-1',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        beginningBalance: 0,
        endingBalance: 0,
        createdBy: 'user-1',
      })).rejects.toThrow('already exists');
    });
  });

  describe('getLastEndingBalance', () => {
    it('should return last ending balance', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({
        endingBalance: { toString: () => '1500.00' },
      });

      const result = await getLastEndingBalance('org-1', 'acct-1');
      expect(result).toBe(1500);
    });

    it('should return null if no completed reconciliation', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getLastEndingBalance('org-1', 'acct-1');
      expect(result).toBeNull();
    });
  });

  describe('toggleReconciliationItem', () => {
    it('should add a new item when not already cleared', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({
        id: 'recon-1',
        accountId: 'acct-1',
        status: 'IN_PROGRESS',
      });
      (prisma.reconciliationItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        amount: { toString: () => '100.00' },
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
      });
      (prisma.reconciliationItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const result = await toggleReconciliationItem('recon-1', 'tx-1', 'org-1');
      expect(result.action).toBe('added');
      expect(prisma.reconciliationItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reconciliationId: 'recon-1',
          transactionId: 'tx-1',
          amount: 100, // debit to account = positive
        }),
      });
    });

    it('should remove an existing item when already cleared', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({
        id: 'recon-1',
        status: 'IN_PROGRESS',
      });
      (prisma.reconciliationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'item-1',
        transactionId: 'tx-1',
      });
      (prisma.reconciliationItem.delete as jest.Mock).mockResolvedValue({});

      const result = await toggleReconciliationItem('recon-1', 'tx-1', 'org-1');
      expect(result.action).toBe('removed');
    });

    it('should reject if reconciliation is completed', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue(null); // not found because status filter

      await expect(
        toggleReconciliationItem('recon-1', 'tx-1', 'org-1')
      ).rejects.toThrow('not found or already completed');
    });
  });

  describe('deleteReconciliation', () => {
    it('should delete an in-progress reconciliation', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({
        id: 'recon-1',
        status: 'IN_PROGRESS',
      });
      (prisma.accountReconciliation.delete as jest.Mock).mockResolvedValue({});

      const result = await deleteReconciliation('recon-1', 'org-1');
      expect(result.success).toBe(true);
    });

    it('should reject deleting a completed reconciliation', async () => {
      (prisma.accountReconciliation.findFirst as jest.Mock).mockResolvedValue({
        id: 'recon-1',
        status: 'COMPLETED',
      });

      await expect(deleteReconciliation('recon-1', 'org-1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('listReconciliations', () => {
    it('should list reconciliations with account names', async () => {
      (prisma.accountReconciliation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'recon-1',
          accountId: 'acct-1',
          beginningBalance: { toString: () => '1000' },
          endingBalance: { toString: () => '1500' },
          status: 'COMPLETED',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          completedBy: 'user-1',
          completedAt: new Date(),
          createdAt: new Date(),
          _count: { items: 5 },
        },
      ]);
      (prisma.account.findMany as jest.Mock).mockResolvedValue([mockAccount]);

      const result = await listReconciliations('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].accountName).toBe('Checking Account');
      expect(result[0].itemCount).toBe(5);
    });
  });
});
