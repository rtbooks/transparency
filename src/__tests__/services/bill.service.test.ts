/**
 * Unit tests for Bill Service
 *
 * Tests bill CRUD, contact resolution, field persistence on updates,
 * and status lifecycle management. These tests directly prevent the
 * class of bugs where:
 *   - Related entities (contacts) are not resolved on read
 *   - New fields are added to the model but not wired into update logic
 *   - Status transitions violate business rules
 */

import { prisma } from '@/lib/prisma';
import { MAX_DATE, buildCurrentVersionWhere, buildEntitiesWhere, buildEntityMap } from '@/lib/temporal/temporal-utils';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    bill: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    billPayment: {
      findMany: jest.fn(),
    },
  },
}));

// Mock balance calculator
jest.mock('@/lib/accounting/balance-calculator', () => ({
  updateAccountBalances: jest.fn(),
}));

const mockTx = {
  bill: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  billPayment: {
    findMany: jest.fn(),
  },
};

import { getBill, updateBill, cancelBill, type UpdateBillInput } from '@/services/bill.service';

describe('Bill Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBill', () => {
    const baseBill = {
      id: 'bill-1',
      organizationId: 'org-1',
      contactId: 'contact-1',
      direction: 'PAYABLE',
      status: 'PENDING',
      amount: 500,
      amountPaid: 0,
      description: 'Office supplies',
      issueDate: new Date('2026-01-15'),
      dueDate: new Date('2026-02-15'),
      notes: null,
      fundingAccountId: 'acct-checking',
      accrualTransactionId: 'txn-1',
      createdBy: 'user-1',
      paidInFullDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      payments: [],
    };

    it('should resolve contact from bitemporal storage', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
        id: 'contact-1',
        name: 'Acme Corp',
        email: 'billing@acme.com',
      });
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getBill('bill-1', 'org-1');

      expect(result).not.toBeNull();
      expect(result!.contact).toEqual({
        id: 'contact-1',
        name: 'Acme Corp',
        email: 'billing@acme.com',
      });
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: buildCurrentVersionWhere({ id: 'contact-1' }),
        select: { id: true, name: true, email: true },
      });
    });

    it('should return null contact when contactId has no matching entity', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getBill('bill-1', 'org-1');

      expect(result!.contact).toBeNull();
    });

    it('should return fundingAccountId in response', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getBill('bill-1', 'org-1');

      expect(result!.fundingAccountId).toBe('acct-checking');
    });

    it('should return all bill fields needed by the UI', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getBill('bill-1', 'org-1');

      // Verify every field the BillDetail component needs is present
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('amountPaid');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('issueDate');
      expect(result).toHaveProperty('dueDate');
      expect(result).toHaveProperty('notes');
      expect(result).toHaveProperty('contactId');
      expect(result).toHaveProperty('contact');
      expect(result).toHaveProperty('payments');
      expect(result).toHaveProperty('fundingAccountId');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should resolve payment transactions from bitemporal storage', async () => {
      const billWithPayments = {
        ...baseBill,
        payments: [
          { id: 'pay-1', billId: 'bill-1', transactionId: 'txn-pay-1', notes: null, createdAt: new Date() },
        ],
      };

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(billWithPayments);
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        { id: 'txn-pay-1', amount: 200, transactionDate: new Date('2026-02-01') },
      ]);

      const result = await getBill('bill-1', 'org-1');

      expect(result!.payments[0].transaction).toBeTruthy();
      expect(result!.payments[0].transaction!.amount).toBe(200);
    });

    it('should return null for non-existent bill', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getBill('nonexistent', 'org-1');

      expect(result).toBeNull();
    });
  });

  describe('updateBill', () => {
    const existingBill = {
      id: 'bill-1',
      organizationId: 'org-1',
      status: 'PENDING',
    };

    beforeEach(() => {
      mockTx.bill.findFirst.mockResolvedValue(existingBill);
      mockTx.bill.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existingBill, ...data })
      );
    });

    it('should persist description changes', async () => {
      await updateBill('bill-1', 'org-1', { description: 'Updated desc' });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ description: 'Updated desc' }),
      });
    });

    it('should persist issueDate changes', async () => {
      const newDate = new Date('2026-03-01');
      await updateBill('bill-1', 'org-1', { issueDate: newDate });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ issueDate: newDate }),
      });
    });

    it('should persist dueDate changes', async () => {
      const newDate = new Date('2026-04-01');
      await updateBill('bill-1', 'org-1', { dueDate: newDate });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ dueDate: newDate }),
      });
    });

    it('should persist fundingAccountId changes', async () => {
      await updateBill('bill-1', 'org-1', { fundingAccountId: 'acct-new' });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ fundingAccountId: 'acct-new' }),
      });
    });

    it('should persist fundingAccountId as null to clear it', async () => {
      await updateBill('bill-1', 'org-1', { fundingAccountId: null });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ fundingAccountId: null }),
      });
    });

    it('should persist notes changes', async () => {
      await updateBill('bill-1', 'org-1', { notes: 'Payment due soon' });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ notes: 'Payment due soon' }),
      });
    });

    it('should persist multiple fields in a single update', async () => {
      const updates: UpdateBillInput = {
        description: 'New desc',
        issueDate: new Date('2026-03-01'),
        dueDate: new Date('2026-04-01'),
        notes: 'Urgent',
        fundingAccountId: 'acct-savings',
      };

      await updateBill('bill-1', 'org-1', updates);

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({
          description: 'New desc',
          issueDate: updates.issueDate,
          dueDate: updates.dueDate,
          notes: 'Urgent',
          fundingAccountId: 'acct-savings',
        }),
      });
    });

    it('should NOT include fields that were not provided', async () => {
      await updateBill('bill-1', 'org-1', { description: 'Only this' });

      const callData = mockTx.bill.update.mock.calls[0][0].data;
      expect(callData).toEqual({ description: 'Only this' });
      expect(callData).not.toHaveProperty('issueDate');
      expect(callData).not.toHaveProperty('dueDate');
      expect(callData).not.toHaveProperty('fundingAccountId');
      expect(callData).not.toHaveProperty('notes');
    });

    it('should reject invalid status transitions', async () => {
      await expect(
        updateBill('bill-1', 'org-1', { status: 'DRAFT' })
      ).rejects.toThrow('Invalid status transition from PENDING to DRAFT');
    });

    it('should allow valid status transitions', async () => {
      await updateBill('bill-1', 'org-1', { status: 'PAID' });

      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      });
    });

    it('should throw when bill not found', async () => {
      mockTx.bill.findFirst.mockResolvedValue(null);

      await expect(
        updateBill('nonexistent', 'org-1', { description: 'x' })
      ).rejects.toThrow('Bill not found');
    });
  });

  describe('cancelBill', () => {
    it('should reject cancelling a PAID bill', async () => {
      mockTx.bill.findFirst.mockResolvedValue({
        id: 'bill-1',
        organizationId: 'org-1',
        status: 'PAID',
      });

      await expect(cancelBill('bill-1', 'org-1')).rejects.toThrow(
        'Cannot cancel a bill that is already PAID'
      );
    });

    it('should reject cancelling an already CANCELLED bill', async () => {
      mockTx.bill.findFirst.mockResolvedValue({
        id: 'bill-1',
        organizationId: 'org-1',
        status: 'CANCELLED',
      });

      await expect(cancelBill('bill-1', 'org-1')).rejects.toThrow(
        'Bill is already cancelled'
      );
    });

    it('should cancel a PENDING bill', async () => {
      mockTx.bill.findFirst.mockResolvedValue({
        id: 'bill-1',
        organizationId: 'org-1',
        status: 'PENDING',
      });
      mockTx.bill.update.mockResolvedValue({
        id: 'bill-1',
        status: 'CANCELLED',
      });

      const result = await cancelBill('bill-1', 'org-1');

      expect(result.status).toBe('CANCELLED');
    });
  });
});
