/**
 * Unit tests for Transaction Service
 *
 * Tests edit, void, and history retrieval with bi-temporal versioning.
 * Mocks Prisma client and accounting balance functions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/accounting/balance-calculator', () => ({
  updateAccountBalances: jest.fn(),
  reverseAccountBalances: jest.fn(),
}));

jest.mock('@/lib/temporal/temporal-utils', () => ({
  MAX_DATE: new Date('9999-12-31T23:59:59.999Z'),
}));

import { editTransaction, voidTransaction, getTransactionHistory } from '@/services/transaction.service';
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as any;

const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');

function makeMockTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    organizationId: 'org-1',
    transactionDate: new Date('2024-06-15'),
    amount: { toString: () => '100.00' },
    type: 'EXPENSE',
    debitAccountId: 'debit-acc-1',
    creditAccountId: 'credit-acc-1',
    description: 'Test transaction',
    category: null,
    paymentMethod: 'OTHER',
    referenceNumber: 'REF-001',
    donorUserId: null,
    donorName: null,
    isAnonymous: false,
    receiptUrl: null,
    notes: null,
    bankTransactionId: null,
    reconciled: false,
    reconciledAt: null,
    stripeSessionId: null,
    stripePaymentId: null,
    createdAt: new Date('2024-06-15'),
    createdBy: 'user-1',
    updatedAt: new Date('2024-06-15'),
    versionId: 'version-1',
    previousVersionId: null,
    validFrom: new Date('2024-06-15'),
    validTo: new Date('9999-12-31T23:59:59.999Z'),
    systemFrom: new Date('2024-06-15'),
    systemTo: new Date('9999-12-31T23:59:59.999Z'),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    changedBy: null,
    isVoided: false,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    changeReason: null,
    ...overrides,
  };
}

describe('Transaction Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // $transaction mock: execute the callback with mockPrisma
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(mockPrisma);
    });
  });

  describe('editTransaction()', () => {
    it('should successfully edit a transaction', async () => {
      const current = makeMockTransaction();
      mockPrisma.transaction.findFirst.mockResolvedValue(current);
      mockPrisma.transaction.update.mockResolvedValue({});
      const createdTx = { ...current, versionId: 'version-2', description: 'Updated' };
      mockPrisma.transaction.create.mockResolvedValue(createdTx);
      (reverseAccountBalances as jest.Mock).mockResolvedValue({});
      (updateAccountBalances as jest.Mock).mockResolvedValue({});

      const result = await editTransaction('tx-1', 'org-1', {
        description: 'Updated',
        changeReason: 'Correction',
      }, 'user-2');

      // Old version closed
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 'version-1' },
          data: expect.objectContaining({
            validTo: expect.any(Date),
            systemTo: expect.any(Date),
          }),
        })
      );

      // Reverse old balance effects
      expect(reverseAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        100
      );

      // New version created
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'tx-1',
            description: 'Updated',
            changeReason: 'Correction',
            changedBy: 'user-2',
            previousVersionId: 'version-1',
            validTo: MAX_DATE,
            systemTo: MAX_DATE,
            isVoided: false,
          }),
        })
      );

      // New balance applied
      expect(updateAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        100
      );

      expect(result).toEqual(createdTx);
    });

    it('should handle amount change', async () => {
      const current = makeMockTransaction();
      mockPrisma.transaction.findFirst.mockResolvedValue(current);
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});
      (reverseAccountBalances as jest.Mock).mockResolvedValue({});
      (updateAccountBalances as jest.Mock).mockResolvedValue({});

      await editTransaction('tx-1', 'org-1', {
        amount: 200,
        changeReason: 'Amount fix',
      }, 'user-2');

      // Reversal uses OLD amount
      expect(reverseAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        100
      );

      // New balance uses NEW amount
      expect(updateAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        200
      );

      // New version has new amount
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 200 }),
        })
      );
    });

    it('should handle account change', async () => {
      const current = makeMockTransaction();
      mockPrisma.transaction.findFirst.mockResolvedValue(current);
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});
      (reverseAccountBalances as jest.Mock).mockResolvedValue({});
      (updateAccountBalances as jest.Mock).mockResolvedValue({});

      await editTransaction('tx-1', 'org-1', {
        debitAccountId: 'debit-acc-2',
        changeReason: 'Wrong account',
      }, 'user-2');

      // Reversal on OLD accounts
      expect(reverseAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        100
      );

      // New balance on NEW accounts
      expect(updateAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-2',
        'credit-acc-1',
        100
      );
    });

    it('should throw if transaction not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        editTransaction('tx-missing', 'org-1', { changeReason: 'Fix' }, 'user-2')
      ).rejects.toThrow('Transaction not found or already voided');
    });

    it('should throw if transaction belongs to different org', async () => {
      const current = makeMockTransaction({ organizationId: 'org-other' });
      mockPrisma.transaction.findFirst.mockResolvedValue(current);

      await expect(
        editTransaction('tx-1', 'org-1', { changeReason: 'Fix' }, 'user-2')
      ).rejects.toThrow('Transaction not found or already voided');
    });

    it('should preserve original fields when only some fields change', async () => {
      const current = makeMockTransaction({
        referenceNumber: 'REF-001',
        category: 'supplies',
        notes: 'Important note',
      });
      mockPrisma.transaction.findFirst.mockResolvedValue(current);
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});
      (reverseAccountBalances as jest.Mock).mockResolvedValue({});
      (updateAccountBalances as jest.Mock).mockResolvedValue({});

      await editTransaction('tx-1', 'org-1', {
        description: 'Only description changed',
        changeReason: 'Typo fix',
      }, 'user-2');

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Only description changed',
            referenceNumber: 'REF-001',
            category: 'supplies',
            notes: 'Important note',
            amount: 100,
            debitAccountId: 'debit-acc-1',
            creditAccountId: 'credit-acc-1',
          }),
        })
      );
    });
  });

  describe('voidTransaction()', () => {
    it('should successfully void a transaction', async () => {
      const current = makeMockTransaction();
      mockPrisma.transaction.findFirst.mockResolvedValue(current);
      mockPrisma.transaction.update.mockResolvedValue({});
      const voidedTx = { ...current, isVoided: true };
      mockPrisma.transaction.create.mockResolvedValue(voidedTx);
      (reverseAccountBalances as jest.Mock).mockResolvedValue({});

      const result = await voidTransaction('tx-1', 'org-1', {
        voidReason: 'Duplicate entry',
      }, 'user-2');

      // Old version closed
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { versionId: 'version-1' },
          data: expect.objectContaining({
            validTo: expect.any(Date),
            systemTo: expect.any(Date),
          }),
        })
      );

      // New voided version created
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'tx-1',
            isVoided: true,
            voidedAt: expect.any(Date),
            voidedBy: 'user-2',
            voidReason: 'Duplicate entry',
            previousVersionId: 'version-1',
          }),
        })
      );

      // Balance reversed
      expect(reverseAccountBalances).toHaveBeenCalledWith(
        mockPrisma,
        'debit-acc-1',
        'credit-acc-1',
        100
      );

      // updateAccountBalances NOT called (voiding removes balance effects, doesn't create new ones)
      expect(updateAccountBalances).not.toHaveBeenCalled();

      expect(result).toEqual(voidedTx);
    });

    it('should throw if transaction not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        voidTransaction('tx-missing', 'org-1', { voidReason: 'Error' }, 'user-2')
      ).rejects.toThrow('Transaction not found or already voided');
    });

    it('should throw if transaction belongs to different org', async () => {
      const current = makeMockTransaction({ organizationId: 'org-other' });
      mockPrisma.transaction.findFirst.mockResolvedValue(current);

      await expect(
        voidTransaction('tx-1', 'org-1', { voidReason: 'Error' }, 'user-2')
      ).rejects.toThrow('Transaction not found or already voided');
    });
  });

  describe('getTransactionHistory()', () => {
    it('should return all versions ordered by systemFrom desc', async () => {
      const versions = [
        makeMockTransaction({ versionId: 'v3', systemFrom: new Date('2024-06-17') }),
        makeMockTransaction({ versionId: 'v2', systemFrom: new Date('2024-06-16') }),
        makeMockTransaction({ versionId: 'v1', systemFrom: new Date('2024-06-15') }),
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(versions);

      const result = await getTransactionHistory('tx-1', 'org-1');

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          id: 'tx-1',
          organizationId: 'org-1',
        },
        orderBy: { systemFrom: 'desc' },
      });

      expect(result).toHaveLength(3);
      expect(result[0].versionId).toBe('v3');
      expect(result[2].versionId).toBe('v1');
    });
  });
});
