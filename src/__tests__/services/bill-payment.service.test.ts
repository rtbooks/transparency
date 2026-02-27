/**
 * Unit tests for BillPayment Service
 *
 * Tests payment recording, linking/unlinking, and reversal.
 * Prevents bugs where:
 *   - Double-entry transactions use wrong debit/credit accounts
 *   - Overpayments are allowed past the remaining balance
 *   - Bill status is not recalculated after payment changes
 *   - Payments on PAID/CANCELLED bills are accepted
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';

// Must be declared before jest.mock so the factory can reference it
const mockTx = {
  transaction: {
    create: jest.fn(),
  },
  billPayment: {
    create: jest.fn(),
  },
};

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    bill: {
      findFirst: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
    billPayment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock balance calculator
jest.mock('@/lib/accounting/balance-calculator', () => ({
  updateAccountBalances: jest.fn(),
}));

// Mock bill.service (recalculateBillStatus)
jest.mock('@/services/bill.service', () => ({
  recalculateBillStatus: jest.fn(),
}));

import {
  recordPayment,
  linkPayment,
  unlinkPayment,
  reversePaymentsForTransaction,
} from '@/services/bill-payment.service';
import { recalculateBillStatus } from '@/services/bill.service';

describe('BillPayment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Shared fixtures ─────────────────────────────────────────────
  const baseBill = {
    id: 'bill-1',
    organizationId: 'org-1',
    contactId: 'contact-1',
    direction: 'PAYABLE',
    status: 'PENDING',
    amount: 500,
    amountPaid: 0,
    description: 'Office supplies',
    accrualTransactionId: 'txn-accrual-1',
  };

  const accrualTransaction = {
    id: 'txn-accrual-1',
    debitAccountId: 'acct-expense',
    creditAccountId: 'acct-ap',
    amount: 500,
  };

  // ─── recordPayment ───────────────────────────────────────────────
  describe('recordPayment', () => {
    const baseInput = {
      billId: 'bill-1',
      organizationId: 'org-1',
      amount: 200,
      transactionDate: new Date('2026-02-01'),
      cashAccountId: 'acct-cash',
      description: 'Partial payment',
      referenceNumber: 'REF-001',
      notes: 'First instalment',
      createdBy: 'user-1',
    };

    it('should create a partial payment with correct double-entry accounts (PAYABLE)', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(accrualTransaction);

      const createdTxn = { id: 'txn-pay-1', amount: 200 };
      mockTx.transaction.create.mockResolvedValue(createdTxn);

      const createdBp = {
        id: 'bp-1',
        billId: 'bill-1',
        transactionId: 'txn-pay-1',
        notes: 'First instalment',
      };
      mockTx.billPayment.create.mockResolvedValue(createdBp);

      const result = await recordPayment(baseInput);

      expect(result).toEqual(createdBp);

      // PAYABLE: debit AP (creditAccountId of accrual), credit Cash
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          amount: 200,
          debitAccountId: 'acct-ap',       // AP account
          creditAccountId: 'acct-cash',    // Cash account
          type: 'TRANSFER',
          contactId: 'contact-1',
          referenceNumber: 'REF-001',
          createdBy: 'user-1',
        }),
      });

      // Balance update called with correct accounts
      expect(updateAccountBalances).toHaveBeenCalledWith(
        mockTx,
        'acct-ap',
        'acct-cash',
        200,
      );

      // BillPayment link created
      expect(mockTx.billPayment.create).toHaveBeenCalledWith({
        data: {
          billId: 'bill-1',
          transactionId: 'txn-pay-1',
          notes: 'First instalment',
        },
      });
    });

    it('should create a full payment (amount equals remaining)', async () => {
      const fullInput = { ...baseInput, amount: 500 };

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(accrualTransaction);

      const createdTxn = { id: 'txn-pay-2', amount: 500 };
      mockTx.transaction.create.mockResolvedValue(createdTxn);
      mockTx.billPayment.create.mockResolvedValue({
        id: 'bp-2',
        billId: 'bill-1',
        transactionId: 'txn-pay-2',
        notes: 'First instalment',
      });

      const result = await recordPayment(fullInput);

      expect(result.transactionId).toBe('txn-pay-2');
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 500 }),
      });
    });

    it('should use correct double-entry for RECEIVABLE bills (DR Cash, CR AR)', async () => {
      const receivableBill = { ...baseBill, direction: 'RECEIVABLE' };
      const receivableAccrual = {
        ...accrualTransaction,
        debitAccountId: 'acct-ar',
        creditAccountId: 'acct-revenue',
      };

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(receivableBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(receivableAccrual);

      mockTx.transaction.create.mockResolvedValue({ id: 'txn-pay-3', amount: 200 });
      mockTx.billPayment.create.mockResolvedValue({
        id: 'bp-3',
        billId: 'bill-1',
        transactionId: 'txn-pay-3',
        notes: 'First instalment',
      });

      await recordPayment(baseInput);

      // RECEIVABLE: debit Cash, credit AR (debitAccountId of accrual)
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          debitAccountId: 'acct-cash',
          creditAccountId: 'acct-ar',
        }),
      });
    });

    it('should default description from bill when not provided', async () => {
      const { description, ...inputNoDesc } = baseInput;

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(accrualTransaction);
      mockTx.transaction.create.mockResolvedValue({ id: 'txn-x', amount: 200 });
      mockTx.billPayment.create.mockResolvedValue({ id: 'bp-x', billId: 'bill-1', transactionId: 'txn-x', notes: null });

      await recordPayment(inputNoDesc as any);

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Payment: Office supplies',
        }),
      });
    });

    it('should set notes to null when not provided', async () => {
      const { notes, ...inputNoNotes } = baseInput;

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(accrualTransaction);
      mockTx.transaction.create.mockResolvedValue({ id: 'txn-y', amount: 200 });
      mockTx.billPayment.create.mockResolvedValue({ id: 'bp-y', billId: 'bill-1', transactionId: 'txn-y', notes: null });

      await recordPayment(inputNoNotes as any);

      expect(mockTx.billPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ notes: null }),
      });
    });

    // ─── Error cases ────────────────────────────────────────────

    it('should throw when bill is not found', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(recordPayment(baseInput)).rejects.toThrow('Bill not found');
    });

    it('should throw when bill is already PAID', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({ ...baseBill, status: 'PAID' });

      await expect(recordPayment(baseInput)).rejects.toThrow(
        'Cannot record payment on paid bill'
      );
    });

    it('should throw when bill is CANCELLED', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({ ...baseBill, status: 'CANCELLED' });

      await expect(recordPayment(baseInput)).rejects.toThrow(
        'Cannot record payment on cancelled bill'
      );
    });

    it('should throw when payment exceeds remaining balance', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({
        ...baseBill,
        amountPaid: 400,
      });

      await expect(recordPayment(baseInput)).rejects.toThrow(
        'Payment amount (200) exceeds remaining balance (100)'
      );
    });

    it('should throw when bill has no accrual transaction', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({
        ...baseBill,
        accrualTransactionId: null,
      });

      await expect(recordPayment(baseInput)).rejects.toThrow(
        'Bill has no accrual transaction'
      );
    });
  });

  // ─── linkPayment ──────────────────────────────────────────────────
  describe('linkPayment', () => {
    const linkInput = {
      billId: 'bill-1',
      transactionId: 'txn-existing-1',
      notes: 'Link note',
    };

    it('should link an existing transaction to a bill', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'txn-existing-1',
        amount: 200,
        organizationId: 'org-1',
      });

      const createdBp = {
        id: 'bp-link-1',
        billId: 'bill-1',
        transactionId: 'txn-existing-1',
        notes: 'Link note',
      };
      (prisma.billPayment.create as jest.Mock).mockResolvedValue(createdBp);
      (recalculateBillStatus as jest.Mock).mockResolvedValue({ id: 'bill-1', status: 'PARTIAL' });

      const result = await linkPayment(linkInput, 'org-1');

      expect(result).toEqual(createdBp);
      expect(prisma.billPayment.create).toHaveBeenCalledWith({
        data: {
          billId: 'bill-1',
          transactionId: 'txn-existing-1',
          notes: 'Link note',
        },
      });
      expect(recalculateBillStatus).toHaveBeenCalledWith('bill-1');
    });

    it('should throw when bill is not found', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({ id: 'txn-1', amount: 100 });

      await expect(linkPayment(linkInput, 'org-1')).rejects.toThrow('Bill not found');
    });

    it('should throw when transaction is not found', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(linkPayment(linkInput, 'org-1')).rejects.toThrow('Transaction not found');
    });

    it('should throw when bill is already PAID', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({ ...baseBill, status: 'PAID' });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({ id: 'txn-1', amount: 100 });

      await expect(linkPayment(linkInput, 'org-1')).rejects.toThrow(
        'Cannot link payment to paid bill'
      );
    });

    it('should throw when transaction amount exceeds remaining balance', async () => {
      (prisma.bill.findFirst as jest.Mock).mockResolvedValue({
        ...baseBill,
        amountPaid: 400,
      });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'txn-existing-1',
        amount: 200,
        organizationId: 'org-1',
      });

      await expect(linkPayment(linkInput, 'org-1')).rejects.toThrow(
        /exceeds remaining balance/
      );
    });

    it('should set notes to null when not provided', async () => {
      const linkNoNotes = { billId: 'bill-1', transactionId: 'txn-existing-1' };

      (prisma.bill.findFirst as jest.Mock).mockResolvedValue(baseBill);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'txn-existing-1',
        amount: 100,
        organizationId: 'org-1',
      });
      (prisma.billPayment.create as jest.Mock).mockResolvedValue({
        id: 'bp-2',
        billId: 'bill-1',
        transactionId: 'txn-existing-1',
        notes: null,
      });
      (recalculateBillStatus as jest.Mock).mockResolvedValue({});

      await linkPayment(linkNoNotes, 'org-1');

      expect(prisma.billPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ notes: null }),
      });
    });
  });

  // ─── unlinkPayment ────────────────────────────────────────────────
  describe('unlinkPayment', () => {
    it('should delete the bill payment and recalculate status', async () => {
      (prisma.billPayment.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-1',
        billId: 'bill-1',
        transactionId: 'txn-1',
      });
      (prisma.billPayment.delete as jest.Mock).mockResolvedValue({});
      (recalculateBillStatus as jest.Mock).mockResolvedValue({});

      await unlinkPayment('bp-1');

      expect(prisma.billPayment.delete).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
      });
      expect(recalculateBillStatus).toHaveBeenCalledWith('bill-1');
    });

    it('should throw when bill payment is not found', async () => {
      (prisma.billPayment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(unlinkPayment('nonexistent')).rejects.toThrow(
        'Bill payment not found'
      );
    });
  });

  // ─── reversePaymentsForTransaction ────────────────────────────────
  describe('reversePaymentsForTransaction', () => {
    it('should delete all payment links and recalculate each bill', async () => {
      (prisma.billPayment.findMany as jest.Mock).mockResolvedValue([
        { id: 'bp-1', billId: 'bill-1', transactionId: 'txn-voided' },
        { id: 'bp-2', billId: 'bill-2', transactionId: 'txn-voided' },
      ]);
      (prisma.billPayment.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (recalculateBillStatus as jest.Mock).mockResolvedValue({});

      await reversePaymentsForTransaction('txn-voided');

      expect(prisma.billPayment.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: 'txn-voided' },
      });
      expect(recalculateBillStatus).toHaveBeenCalledWith('bill-1');
      expect(recalculateBillStatus).toHaveBeenCalledWith('bill-2');
      expect(recalculateBillStatus).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate bill IDs when same bill has multiple payments from one transaction', async () => {
      (prisma.billPayment.findMany as jest.Mock).mockResolvedValue([
        { id: 'bp-1', billId: 'bill-1', transactionId: 'txn-voided' },
        { id: 'bp-2', billId: 'bill-1', transactionId: 'txn-voided' },
      ]);
      (prisma.billPayment.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (recalculateBillStatus as jest.Mock).mockResolvedValue({});

      await reversePaymentsForTransaction('txn-voided');

      // Should only recalculate once for the deduplicated bill
      expect(recalculateBillStatus).toHaveBeenCalledTimes(1);
      expect(recalculateBillStatus).toHaveBeenCalledWith('bill-1');
    });

    it('should be a no-op when no payments exist for the transaction', async () => {
      (prisma.billPayment.findMany as jest.Mock).mockResolvedValue([]);

      await reversePaymentsForTransaction('txn-none');

      expect(prisma.billPayment.deleteMany).not.toHaveBeenCalled();
      expect(recalculateBillStatus).not.toHaveBeenCalled();
    });
  });
});
