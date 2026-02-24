/**
 * Unit tests for Donation Service
 *
 * Tests donation creation (pledge & one-time), updates, cancellation,
 * payment recording, and campaign summaries. Prevents regressions in:
 *   - Accounting entry creation for pledge vs one-time paths
 *   - Update guards (status and payment checks)
 *   - Amount propagation to linked transaction + bill
 *   - Cancel lifecycle (donation + bill + soft-delete transaction)
 *   - Payment status transitions (PARTIAL → RECEIVED)
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE, buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

// ── mockTx must be declared before jest.mock so the factory can close over it ─
const mockTx = {
  transaction: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  bill: {
    create: jest.fn(),
    update: jest.fn(),
  },
  donation: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    donation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    bill: {
      findUnique: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
    billPayment: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/accounting/balance-calculator', () => ({
  updateAccountBalances: jest.fn(),
}));

import {
  createPledgeDonation,
  createOneTimeDonation,
  updateDonation,
  cancelDonation,
  recordDonationPayment,
  syncDonationFromBill,
  getCampaignDonationSummary,
  type CreateDonationInput,
} from '@/services/donation.service';

// ── Helpers ─────────────────────────────────────────────────────────────

const baseInput: CreateDonationInput = {
  organizationId: 'org-1',
  contactId: 'contact-1',
  type: 'PLEDGE',
  amount: 500,
  description: 'Annual pledge',
  donorMessage: 'Happy to help',
  isAnonymous: false,
  isTaxDeductible: true,
  donationDate: new Date('2026-03-01'),
  dueDate: new Date('2026-06-01'),
  campaignId: 'campaign-1',
  arAccountId: 'ar-acct',
  revenueAccountId: 'rev-acct',
  createdBy: 'user-1',
};

const baseDonation = {
  id: 'donation-1',
  organizationId: 'org-1',
  contactId: 'contact-1',
  type: 'PLEDGE',
  status: 'PLEDGED',
  amount: 500,
  amountReceived: 0,
  description: 'Annual pledge',
  donorMessage: 'Happy to help',
  isAnonymous: false,
  isTaxDeductible: true,
  donationDate: new Date('2026-03-01'),
  dueDate: new Date('2026-06-01'),
  campaignId: 'campaign-1',
  transactionId: 'txn-1',
  billId: 'bill-1',
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('Donation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createPledgeDonation ──────────────────────────────────────────────

  describe('createPledgeDonation', () => {
    it('should create transaction + bill + donation correctly', async () => {
      const createdTxn = { id: 'txn-new', amount: 500 };
      const createdBill = { id: 'bill-new' };
      const createdDonation = { id: 'donation-new', type: 'PLEDGE', status: 'PLEDGED' };

      mockTx.transaction.create.mockResolvedValue(createdTxn);
      mockTx.bill.create.mockResolvedValue(createdBill);
      mockTx.donation.create.mockResolvedValue(createdDonation);

      const result = await createPledgeDonation(baseInput);

      expect(result).toEqual(createdDonation);

      // Transaction: DR AR, CR Revenue
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          amount: 500,
          type: 'INCOME',
          debitAccountId: 'ar-acct',
          creditAccountId: 'rev-acct',
          transactionDate: baseInput.donationDate,
          description: 'Annual pledge',
          contactId: 'contact-1',
          validTo: MAX_DATE,
          systemTo: MAX_DATE,
        }),
      });

      // Balance update
      expect(updateAccountBalances).toHaveBeenCalledWith(mockTx, 'ar-acct', 'rev-acct', 500);

      // Bill: RECEIVABLE, PENDING
      expect(mockTx.bill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          contactId: 'contact-1',
          direction: 'RECEIVABLE',
          status: 'PENDING',
          amount: 500,
          amountPaid: 0,
          dueDate: baseInput.dueDate,
          accrualTransactionId: 'txn-new',
          createdBy: 'user-1',
        }),
      });

      // Donation record
      expect(mockTx.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PLEDGE',
          status: 'PLEDGED',
          amount: 500,
          amountReceived: 0,
          transactionId: 'txn-new',
          billId: 'bill-new',
          campaignId: 'campaign-1',
          isAnonymous: false,
          isTaxDeductible: true,
        }),
      });
    });
  });

  // ── createOneTimeDonation ─────────────────────────────────────────────

  describe('createOneTimeDonation', () => {
    const oneTimeInput: CreateDonationInput = {
      ...baseInput,
      type: 'ONE_TIME',
      cashAccountId: 'cash-acct',
    };

    it('should create transaction + donation (no bill), status RECEIVED', async () => {
      const createdTxn = { id: 'txn-ot' };
      const createdDonation = { id: 'donation-ot', type: 'ONE_TIME', status: 'RECEIVED' };

      mockTx.transaction.create.mockResolvedValue(createdTxn);
      mockTx.donation.create.mockResolvedValue(createdDonation);

      const result = await createOneTimeDonation(oneTimeInput);

      expect(result).toEqual(createdDonation);

      // DR Cash, CR Revenue
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          debitAccountId: 'cash-acct',
          creditAccountId: 'rev-acct',
          amount: 500,
        }),
      });

      expect(updateAccountBalances).toHaveBeenCalledWith(mockTx, 'cash-acct', 'rev-acct', 500);

      // Donation: RECEIVED immediately, no bill
      expect(mockTx.donation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'ONE_TIME',
          status: 'RECEIVED',
          amount: 500,
          amountReceived: 500,
          receivedDate: baseInput.donationDate,
          billId: null,
          transactionId: 'txn-ot',
        }),
      });

      // No bill created
      expect(mockTx.bill.create).not.toHaveBeenCalled();
    });

    it('should throw if no cashAccountId provided', async () => {
      const noCashInput: CreateDonationInput = { ...baseInput, type: 'ONE_TIME' };
      delete (noCashInput as any).cashAccountId;

      await expect(createOneTimeDonation(noCashInput)).rejects.toThrow(
        'Cash account ID is required for one-time donations'
      );
    });
  });

  // ── updateDonation ────────────────────────────────────────────────────

  describe('updateDonation', () => {
    it('should update description field', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({ ...baseDonation });
      const updatedDonation = { ...baseDonation, description: 'Updated pledge' };
      mockTx.donation.update.mockResolvedValue(updatedDonation);
      mockTx.bill.update.mockResolvedValue({});

      const result = await updateDonation('donation-1', 'org-1', { description: 'Updated pledge' });

      expect(result).toEqual(updatedDonation);
      expect(mockTx.donation.update).toHaveBeenCalledWith({
        where: { id: 'donation-1' },
        data: expect.objectContaining({ description: 'Updated pledge' }),
      });
    });

    it('should update amount and propagate to transaction + bill', async () => {
      const accrualTx = { id: 'txn-1', versionId: 'v-txn-1', amount: 500 };
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({ ...baseDonation });
      mockTx.transaction.findFirst.mockResolvedValue(accrualTx);
      mockTx.transaction.update.mockResolvedValue({});
      mockTx.bill.update.mockResolvedValue({});
      mockTx.donation.update.mockResolvedValue({ ...baseDonation, amount: 750 });

      const result = await updateDonation('donation-1', 'org-1', { amount: 750 });

      expect(result.amount).toBe(750);

      // Transaction amount updated
      expect(mockTx.transaction.update).toHaveBeenCalledWith({
        where: { versionId: 'v-txn-1' },
        data: { amount: 750 },
      });

      // Bill amount updated
      expect(mockTx.bill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bill-1' },
          data: expect.objectContaining({ amount: 750 }),
        })
      );
    });

    it('should throw when status is RECEIVED', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        ...baseDonation,
        status: 'RECEIVED',
      });

      await expect(
        updateDonation('donation-1', 'org-1', { description: 'Nope' })
      ).rejects.toThrow('Cannot modify a donation that is received');
    });

    it('should throw when payments have been received', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        ...baseDonation,
        status: 'PARTIAL',
        amountReceived: 100,
      });

      await expect(
        updateDonation('donation-1', 'org-1', { amount: 600 })
      ).rejects.toThrow('Cannot modify a donation that has received payments');
    });
  });

  // ── cancelDonation ────────────────────────────────────────────────────

  describe('cancelDonation', () => {
    it('should cancel donation + bill + soft-delete transaction', async () => {
      const accrualTx = { id: 'txn-1', versionId: 'v-txn-1' };
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({ ...baseDonation });
      mockTx.transaction.findFirst.mockResolvedValue(accrualTx);
      mockTx.transaction.update.mockResolvedValue({});
      mockTx.bill.update.mockResolvedValue({});
      mockTx.donation.update.mockResolvedValue({ ...baseDonation, status: 'CANCELLED' });

      const result = await cancelDonation('donation-1', 'org-1', 'admin-1');

      expect(result.status).toBe('CANCELLED');

      // Soft-delete transaction
      expect(mockTx.transaction.update).toHaveBeenCalledWith({
        where: { versionId: 'v-txn-1' },
        data: expect.objectContaining({
          isDeleted: true,
          deletedBy: 'admin-1',
        }),
      });

      // Cancel bill
      expect(mockTx.bill.update).toHaveBeenCalledWith({
        where: { id: 'bill-1' },
        data: { status: 'CANCELLED' },
      });

      // Cancel donation
      expect(mockTx.donation.update).toHaveBeenCalledWith({
        where: { id: 'donation-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw when status is CANCELLED', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        ...baseDonation,
        status: 'CANCELLED',
      });

      await expect(
        cancelDonation('donation-1', 'org-1', 'admin-1')
      ).rejects.toThrow('Cannot cancel a donation that is cancelled');
    });

    it('should throw when payments have been received', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        ...baseDonation,
        status: 'PARTIAL',
        amountReceived: 200,
      });

      await expect(
        cancelDonation('donation-1', 'org-1', 'admin-1')
      ).rejects.toThrow('Cannot cancel a donation that has received payments');
    });
  });

  // ── recordDonationPayment ─────────────────────────────────────────────

  describe('recordDonationPayment', () => {
    it('should update amountReceived and set status to PARTIAL', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({ ...baseDonation });
      (prisma.donation.update as jest.Mock).mockResolvedValue({
        ...baseDonation,
        amountReceived: 200,
        status: 'PARTIAL',
      });

      const result = await recordDonationPayment('donation-1', 'org-1', 200);

      expect(result.status).toBe('PARTIAL');
      expect(result.amountReceived).toBe(200);

      expect(prisma.donation.update).toHaveBeenCalledWith({
        where: { id: 'donation-1' },
        data: {
          amountReceived: 200,
          status: 'PARTIAL',
          receivedDate: undefined,
        },
      });
    });

    it('should set status to RECEIVED when fully paid', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({ ...baseDonation });
      (prisma.donation.update as jest.Mock).mockResolvedValue({
        ...baseDonation,
        amountReceived: 500,
        status: 'RECEIVED',
        receivedDate: expect.any(Date),
      });

      const result = await recordDonationPayment('donation-1', 'org-1', 500);

      expect(result.status).toBe('RECEIVED');

      expect(prisma.donation.update).toHaveBeenCalledWith({
        where: { id: 'donation-1' },
        data: expect.objectContaining({
          amountReceived: 500,
          status: 'RECEIVED',
          receivedDate: expect.any(Date),
        }),
      });
    });
  });

  // ── getCampaignDonationSummary ────────────────────────────────────────

  describe('getCampaignDonationSummary', () => {
    it('should return correct aggregates', async () => {
      (prisma.donation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 1500, amountReceived: 800 },
        _count: { id: 5 },
      });

      const result = await getCampaignDonationSummary('campaign-1');

      expect(result).toEqual({
        totalPledged: 1500,
        totalReceived: 800,
        donationCount: 5,
      });

      expect(prisma.donation.aggregate).toHaveBeenCalledWith({
        where: {
          campaignId: 'campaign-1',
          status: { not: 'CANCELLED' },
        },
        _sum: { amount: true, amountReceived: true },
        _count: { id: true },
      });
    });
  });

  // ── syncDonationFromBill ───────────────────────────────────────────────

  describe('syncDonationFromBill', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should be a no-op when bill has no linked donation', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue(null);

      await syncDonationFromBill('bill-1');

      expect(prisma.donation.findFirst).toHaveBeenCalledWith({
        where: { billId: 'bill-1' },
      });
      expect(prisma.donation.update).not.toHaveBeenCalled();
    });

    it('should update donation to PARTIAL when bill is partially paid', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        id: 'don-1',
        billId: 'bill-1',
        amount: 500,
        amountReceived: 0,
        status: 'PLEDGED',
        receivedDate: null,
      });
      (prisma.bill.findUnique as jest.Mock).mockResolvedValue({
        id: 'bill-1',
        amount: 500,
        amountPaid: 200,
        status: 'PARTIAL',
      });

      await syncDonationFromBill('bill-1');

      expect(prisma.donation.update).toHaveBeenCalledWith({
        where: { id: 'don-1' },
        data: expect.objectContaining({
          status: 'PARTIAL',
          receivedDate: null,
        }),
      });
    });

    it('should update donation to RECEIVED when bill is fully paid', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        id: 'don-1',
        billId: 'bill-1',
        amount: 500,
        amountReceived: 200,
        status: 'PARTIAL',
        receivedDate: null,
      });
      (prisma.bill.findUnique as jest.Mock).mockResolvedValue({
        id: 'bill-1',
        amount: 500,
        amountPaid: 500,
        status: 'PAID',
      });

      await syncDonationFromBill('bill-1');

      expect(prisma.donation.update).toHaveBeenCalledWith({
        where: { id: 'don-1' },
        data: expect.objectContaining({
          status: 'RECEIVED',
          receivedDate: expect.any(Date),
        }),
      });
    });

    it('should not update donation when nothing changed', async () => {
      (prisma.donation.findFirst as jest.Mock).mockResolvedValue({
        id: 'don-1',
        billId: 'bill-1',
        amount: 500,
        amountReceived: 200,
        status: 'PARTIAL',
        receivedDate: null,
      });
      (prisma.bill.findUnique as jest.Mock).mockResolvedValue({
        id: 'bill-1',
        amount: 500,
        amountPaid: 200,
        status: 'PARTIAL',
      });

      await syncDonationFromBill('bill-1');

      expect(prisma.donation.update).not.toHaveBeenCalled();
    });
  });
});
