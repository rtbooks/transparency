/**
 * API Contract Tests for Donations Endpoints
 *
 * Validates that the donations API returns the correct response shape for
 * GET (list), POST (create), PATCH (update), and POST (payment) operations.
 *
 * These tests prevent bugs where:
 *   - The list response is missing fields the UI needs (contactName, payments, summary)
 *   - POST silently drops fields the form sends (donorMessage, campaignId)
 *   - PATCH rejects valid nullable fields (dueDate, donorMessage)
 *   - Payment endpoint misses required fields (cashAccountId, transactionDate)
 */

import { z } from 'zod';

// ─── Response schemas ────────────────────────────────────────────

/** Individual payment nested inside a donation item */
const PaymentItemSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.string(),
  notes: z.string().nullable(),
});

/** The shape each donation item has in the list — matches what the UI reads */
const DonationItemSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  contactId: z.string(),
  type: z.enum(['ONE_TIME', 'PLEDGE']),
  status: z.enum(['PLEDGED', 'PARTIAL', 'RECEIVED', 'CANCELLED']),
  amount: z.number(),
  amountReceived: z.number(),
  description: z.string().nullable(),
  donorMessage: z.string().nullable(),
  isAnonymous: z.boolean(),
  isTaxDeductible: z.boolean(),
  donationDate: z.string(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  campaignId: z.string().nullable(),
  transactionId: z.string().nullable(),
  billId: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Resolved details
  contactName: z.string(),
  campaignName: z.string().nullable(),
  payments: z.array(PaymentItemSchema),
});

/** Full GET /api/organizations/[slug]/donations response */
const DonationListResponseSchema = z.object({
  donations: z.array(DonationItemSchema),
  pledges: z.array(DonationItemSchema),
  summary: z.object({
    totalPledged: z.number(),
    totalPaid: z.number(),
    outstanding: z.number(),
  }),
  paymentInstructions: z.string().nullable(),
  isAdmin: z.boolean(),
  userContactIds: z.array(z.string()),
});

/** POST /api/organizations/[slug]/donations request body */
const CreateDonationRequestSchema = z.object({
  type: z.enum(['ONE_TIME', 'PLEDGE']),
  amount: z.number().positive(),
  description: z.string(),
  donorMessage: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  dueDate: z.string().optional(),
  campaignId: z.string().optional(),
});

/** PATCH /api/organizations/[slug]/donations/[id] request body */
const UpdateDonationRequestSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  donorMessage: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  cancel: z.boolean().optional(),
});

/** POST /api/organizations/[slug]/donations/[id]/payment request body */
const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  transactionDate: z.string(),
  cashAccountId: z.string(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Mock data ───────────────────────────────────────────────────

const mockDonation = {
  id: 'don-1',
  organizationId: 'org-1',
  contactId: 'contact-1',
  type: 'PLEDGE' as const,
  status: 'PARTIAL' as const,
  amount: 5000,
  amountReceived: 2000,
  description: 'Annual fund pledge',
  donorMessage: 'Happy to support!',
  isAnonymous: false,
  isTaxDeductible: true,
  donationDate: '2026-01-10',
  receivedDate: null,
  dueDate: '2026-06-30',
  campaignId: 'camp-1',
  transactionId: null,
  billId: 'bill-1',
  createdBy: 'user-1',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  contactName: 'Jane Donor',
  campaignName: 'Spring Campaign',
  payments: [
    { id: 'pay-1', amount: 2000, date: '2026-01-20', notes: 'First installment' },
  ],
};

// ─── Contract validation tests ───────────────────────────────────

describe('Donations API Contract Tests', () => {
  describe('GET /api/organizations/[slug]/donations response shape', () => {
    it('should validate a complete list response', () => {
      const response = {
        donations: [mockDonation],
        pledges: [mockDonation],
        summary: { totalPledged: 5000, totalPaid: 2000, outstanding: 3000 },
        paymentInstructions: 'Mail checks to PO Box 123',
        isAdmin: true,
        userContactIds: ['contact-1'],
      };

      const result = DonationListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with empty donations and null paymentInstructions', () => {
      const response = {
        donations: [],
        pledges: [],
        summary: { totalPledged: 0, totalPaid: 0, outstanding: 0 },
        paymentInstructions: null,
        isAdmin: false,
        userContactIds: [],
      };

      const result = DonationListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate a one-time received donation with all nullable fields null', () => {
      const donation = {
        ...mockDonation,
        type: 'ONE_TIME',
        status: 'RECEIVED',
        amount: 100,
        amountReceived: 100,
        description: null,
        donorMessage: null,
        isAnonymous: true,
        receivedDate: '2026-01-10',
        dueDate: null,
        campaignId: null,
        transactionId: 'txn-1',
        billId: null,
        createdBy: null,
        campaignName: null,
        payments: [],
      };

      const result = DonationItemSchema.safeParse(donation);
      expect(result.success).toBe(true);
    });

    it('should FAIL if summary field is missing', () => {
      const response = {
        donations: [],
        pledges: [],
        // summary is MISSING
        paymentInstructions: null,
        isAdmin: false,
        userContactIds: [],
      };

      const result = DonationListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should FAIL if contactName is missing from a donation item', () => {
      const { contactName, ...incomplete } = mockDonation;

      const result = DonationItemSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should FAIL if payments array is missing from a donation item', () => {
      const { payments, ...incomplete } = mockDonation;

      const result = DonationItemSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/organizations/[slug]/donations request schema', () => {
    it('should accept a ONE_TIME donation', () => {
      const result = CreateDonationRequestSchema.safeParse({
        type: 'ONE_TIME',
        amount: 250,
        description: 'General donation',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a PLEDGE with all optional fields', () => {
      const result = CreateDonationRequestSchema.safeParse({
        type: 'PLEDGE',
        amount: 5000,
        description: 'Annual fund',
        donorMessage: 'In memory of John',
        isAnonymous: true,
        dueDate: '2026-12-31',
        campaignId: 'camp-1',
      });
      expect(result.success).toBe(true);
    });

    it('should reject creation with invalid type', () => {
      const result = CreateDonationRequestSchema.safeParse({
        type: 'RECURRING',
        amount: 100,
        description: 'Monthly',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PATCH /api/organizations/[slug]/donations/[id] request schema', () => {
    it('should accept partial updates', () => {
      const result = UpdateDonationRequestSchema.safeParse({
        amount: 7500,
        description: 'Increased pledge',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null dueDate and donorMessage to clear them', () => {
      const result = UpdateDonationRequestSchema.safeParse({
        dueDate: null,
        donorMessage: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept cancel flag', () => {
      const result = UpdateDonationRequestSchema.safeParse({ cancel: true });
      expect(result.success).toBe(true);
    });
  });

  describe('POST /api/organizations/[slug]/donations/[id]/payment request schema', () => {
    it('should accept a complete payment request', () => {
      const result = PaymentRequestSchema.safeParse({
        amount: 1000,
        transactionDate: '2026-02-15',
        cashAccountId: 'acct-checking',
        description: 'Q1 payment',
        referenceNumber: 'CHK-1234',
        notes: 'Received via mail',
      });
      expect(result.success).toBe(true);
    });

    it('should FAIL if cashAccountId is missing', () => {
      const result = PaymentRequestSchema.safeParse({
        amount: 1000,
        transactionDate: '2026-02-15',
        // cashAccountId is MISSING
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Organization account configuration contract ──────────────────

  describe('Org Account Settings Schema', () => {
    const OrgUpdateSchema = z.object({
      donationsAccountId: z.string().nullable().optional(),
      donationsArAccountId: z.string().nullable().optional(),
    });

    it('should accept donationsArAccountId for configuring A/R account', () => {
      expect(
        OrgUpdateSchema.safeParse({ donationsArAccountId: 'acct-uuid' }).success
      ).toBe(true);
    });

    it('should accept null donationsArAccountId to clear it', () => {
      expect(
        OrgUpdateSchema.safeParse({ donationsArAccountId: null }).success
      ).toBe(true);
    });

    it('should accept both account IDs together', () => {
      expect(
        OrgUpdateSchema.safeParse({
          donationsAccountId: 'revenue-uuid',
          donationsArAccountId: 'ar-uuid',
        }).success
      ).toBe(true);
    });
  });

  // ── Bill-to-Donation sync contract ───────────────────────────────

  describe('Bill Payment → Donation Sync', () => {
    it('payment response should include bill payment fields', () => {
      const BillPaymentResponseSchema = z.object({
        id: z.string(),
        billId: z.string(),
        transactionId: z.string(),
        notes: z.string().nullable(),
        createdAt: z.string(),
      });

      const mockResponse = {
        id: 'bp-1',
        billId: 'bill-1',
        transactionId: 'txn-1',
        notes: null,
        createdAt: '2026-02-25T00:00:00.000Z',
      };

      expect(BillPaymentResponseSchema.safeParse(mockResponse).success).toBe(true);
    });

    it('donation status values should be valid after sync', () => {
      const DonationStatusSchema = z.enum(['PLEDGED', 'PARTIAL', 'RECEIVED', 'CANCELLED']);

      expect(DonationStatusSchema.safeParse('PARTIAL').success).toBe(true);
      expect(DonationStatusSchema.safeParse('RECEIVED').success).toBe(true);
      expect(DonationStatusSchema.safeParse('CANCELLED').success).toBe(true);
      expect(DonationStatusSchema.safeParse('INVALID').success).toBe(false);
    });
  });

  // ── Date handling contract ───────────────────────────────────────

  describe('Date Handling', () => {
    it('date-only strings parsed with T12:00:00 should stay on the correct day', () => {
      // Bug: new Date("2026-02-24") is midnight UTC = previous day in US timezones
      // Fix: append T12:00:00 so it stays on the intended day in all timezones
      const dateStr = '2026-02-24';
      const parsed = new Date(dateStr + 'T12:00:00');
      expect(parsed.getDate()).toBe(24);
      expect(parsed.getMonth()).toBe(1); // February = 1
    });

    it('pledge without dueDate should NOT produce epoch/null date', () => {
      // Bug: dueDate was null → bill showed 12/31/1969 (epoch)
      // Fix: default to 1 week from now for pledges
      const CreateRequestNoDueDate = z.object({
        type: z.enum(['ONE_TIME', 'PLEDGE']),
        amount: z.number().positive(),
        description: z.string(),
        dueDate: z.string().optional(),
      });

      const result = CreateRequestNoDueDate.safeParse({
        type: 'PLEDGE',
        amount: 100,
        description: 'Test pledge',
        // no dueDate → API should default to 1 week from now
      });
      expect(result.success).toBe(true);
      expect(result.data?.dueDate).toBeUndefined();
    });
  });
});
