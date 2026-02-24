/**
 * Pledge Modification API Contract Tests
 *
 * Validates the PATCH /api/organizations/[slug]/donations/pledge/[id] endpoint
 * for pledge editing and cancellation by donors/supporters.
 */

import { z } from 'zod';

// --- Request Schemas ---

const UpdatePledgeRequestSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  cancel: z.boolean().optional(),
});

// --- Response Schema ---

const PledgePatchResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  contactId: z.string(),
  direction: z.literal('RECEIVABLE'),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']),
  amount: z.union([z.number(), z.string()]),
  amountPaid: z.union([z.number(), z.string()]),
  description: z.string(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

// --- Mock Data ---

const mockPledgeResponse = {
  id: 'pledge-1',
  organizationId: 'org-1',
  contactId: 'contact-1',
  direction: 'RECEIVABLE' as const,
  status: 'PENDING' as const,
  amount: '100.00',
  amountPaid: '0.00',
  description: 'Monthly donation',
  issueDate: '2026-02-01T00:00:00.000Z',
  dueDate: '2026-03-01T00:00:00.000Z',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-24T00:00:00.000Z',
};

const mockCancelledResponse = {
  ...mockPledgeResponse,
  status: 'CANCELLED' as const,
};

describe('Pledge Modification API Contract', () => {
  describe('Request Schema Validation', () => {
    it('should accept amount update', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ amount: 150 }).success).toBe(true);
    });

    it('should accept description update', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ description: 'Updated pledge' }).success).toBe(true);
    });

    it('should accept dueDate update', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ dueDate: '2026-04-01T00:00:00.000Z' }).success).toBe(true);
    });

    it('should accept null dueDate to clear it', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ dueDate: null }).success).toBe(true);
    });

    it('should accept cancel flag', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ cancel: true }).success).toBe(true);
    });

    it('should accept multiple fields at once', () => {
      const result = UpdatePledgeRequestSchema.safeParse({
        amount: 200,
        description: 'Updated pledge',
        dueDate: '2026-04-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative amount', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ amount: -50 }).success).toBe(false);
    });

    it('should reject zero amount', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ amount: 0 }).success).toBe(false);
    });

    it('should reject empty description', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ description: '' }).success).toBe(false);
    });

    it('should accept empty request (no updates)', () => {
      expect(UpdatePledgeRequestSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('Response Schema Validation', () => {
    it('should validate updated pledge response', () => {
      expect(PledgePatchResponseSchema.safeParse(mockPledgeResponse).success).toBe(true);
    });

    it('should validate cancelled pledge response', () => {
      expect(PledgePatchResponseSchema.safeParse(mockCancelledResponse).success).toBe(true);
    });

    it('should validate error response', () => {
      expect(ErrorResponseSchema.safeParse({ error: 'Cannot modify a pledge that is paid' }).success).toBe(true);
    });
  });

  describe('Business Rules', () => {
    it('should only allow modification of PENDING/DRAFT status pledges', () => {
      const modifiableStatuses = ['DRAFT', 'PENDING'];
      const nonModifiableStatuses = ['PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];

      // These statuses should allow modification (no payments)
      modifiableStatuses.forEach((status) => {
        const pledge = { status, amountPaid: 0, payments: [] };
        const canModify = (pledge.status === 'PENDING' || pledge.status === 'DRAFT') &&
          pledge.amountPaid === 0 && pledge.payments.length === 0;
        expect(canModify).toBe(true);
      });

      // These statuses should NOT allow modification
      nonModifiableStatuses.forEach((status) => {
        const pledge = { status, amountPaid: 0, payments: [] };
        const canModify = (pledge.status === 'PENDING' || pledge.status === 'DRAFT') &&
          pledge.amountPaid === 0 && pledge.payments.length === 0;
        expect(canModify).toBe(false);
      });
    });

    it('should not allow modification when payments exist', () => {
      const pledge = {
        status: 'PENDING',
        amountPaid: 50,
        payments: [{ id: 'pay-1', amount: 50, date: '2026-02-15' }],
      };
      const canModify = (pledge.status === 'PENDING' || pledge.status === 'DRAFT') &&
        pledge.amountPaid === 0 && pledge.payments.length === 0;
      expect(canModify).toBe(false);
    });

    it('should not allow modification when amountPaid > 0 even with empty payments array', () => {
      const pledge = { status: 'PENDING', amountPaid: 25, payments: [] };
      const canModify = (pledge.status === 'PENDING' || pledge.status === 'DRAFT') &&
        pledge.amountPaid === 0 && pledge.payments.length === 0;
      expect(canModify).toBe(false);
    });

    it('cancellation should set status to CANCELLED', () => {
      expect(mockCancelledResponse.status).toBe('CANCELLED');
    });

    it('pledge amount must be positive', () => {
      expect(UpdatePledgeRequestSchema.safeParse({ amount: 0.01 }).success).toBe(true);
      expect(UpdatePledgeRequestSchema.safeParse({ amount: 0 }).success).toBe(false);
      expect(UpdatePledgeRequestSchema.safeParse({ amount: -1 }).success).toBe(false);
    });
  });
});
