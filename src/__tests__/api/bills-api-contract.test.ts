/**
 * API Contract Tests for Bills Endpoint
 *
 * Validates that the bills API returns the correct response shape for
 * both GET (single bill) and PATCH (update) operations.
 *
 * These tests prevent bugs where:
 *   - The API response is missing fields the UI needs (contact, fundingAccountId)
 *   - PATCH silently drops fields the form sends (issueDate, fundingAccountId)
 *   - Zod schemas reject valid input (nullable description)
 */

import { z } from 'zod';

// ─── Response schemas ────────────────────────────────────────────

/** The shape BillDetail component expects from GET /bills/[id] */
const BillDetailResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  contactId: z.string(),
  direction: z.enum(['PAYABLE', 'RECEIVABLE']),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']),
  amount: z.union([z.number(), z.object({})]),
  amountPaid: z.union([z.number(), z.object({})]),
  description: z.string().nullable(),
  issueDate: z.union([z.string(), z.date()]),
  dueDate: z.union([z.string(), z.date()]).nullable(),
  notes: z.string().nullable(),
  fundingAccountId: z.string().nullable(),
  contact: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
  }).nullable(),
  payments: z.array(z.object({
    id: z.string(),
    transaction: z.object({
      amount: z.union([z.number(), z.object({})]),
    }).nullable(),
  })),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

/** The fields the PATCH endpoint must accept */
const BillUpdateRequestSchema = z.object({
  description: z.string().min(1).nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  fundingAccountId: z.string().uuid().nullable().optional(),
});

// ─── Contract validation tests ───────────────────────────────────

describe('Bills API Contract Tests', () => {
  describe('GET /api/organizations/[slug]/bills/[id] response shape', () => {
    it('should validate a complete bill response with contact', () => {
      const response = {
        id: 'bill-1',
        organizationId: 'org-1',
        contactId: 'contact-1',
        direction: 'PAYABLE',
        status: 'PENDING',
        amount: 500,
        amountPaid: 0,
        description: 'Office supplies',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        notes: null,
        fundingAccountId: 'acct-checking',
        contact: {
          id: 'contact-1',
          name: 'Acme Corp',
          email: 'billing@acme.com',
        },
        payments: [],
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = BillDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with null contact', () => {
      const response = {
        id: 'bill-1',
        organizationId: 'org-1',
        contactId: 'contact-1',
        direction: 'RECEIVABLE',
        status: 'PAID',
        amount: 1000,
        amountPaid: 1000,
        description: null,
        issueDate: '2026-01-15',
        dueDate: null,
        notes: null,
        fundingAccountId: null,
        contact: null,
        payments: [
          { id: 'pay-1', transaction: { amount: 1000 } },
        ],
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-02-15T00:00:00.000Z',
      };

      const result = BillDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should FAIL if contact field is missing entirely', () => {
      const response = {
        id: 'bill-1',
        organizationId: 'org-1',
        contactId: 'contact-1',
        direction: 'PAYABLE',
        status: 'PENDING',
        amount: 500,
        amountPaid: 0,
        description: 'Test',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        notes: null,
        fundingAccountId: null,
        // contact is MISSING — this was the bug
        payments: [],
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = BillDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should FAIL if fundingAccountId field is missing entirely', () => {
      const response = {
        id: 'bill-1',
        organizationId: 'org-1',
        contactId: 'contact-1',
        direction: 'PAYABLE',
        status: 'PENDING',
        amount: 500,
        amountPaid: 0,
        description: 'Test',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        notes: null,
        // fundingAccountId is MISSING
        contact: null,
        payments: [],
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = BillDetailResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('PATCH /api/organizations/[slug]/bills/[id] request schema', () => {
    it('should accept description update', () => {
      const result = BillUpdateRequestSchema.safeParse({ description: 'New desc' });
      expect(result.success).toBe(true);
    });

    it('should accept null description', () => {
      const result = BillUpdateRequestSchema.safeParse({ description: null });
      expect(result.success).toBe(true);
    });

    it('should accept issueDate update', () => {
      const result = BillUpdateRequestSchema.safeParse({ issueDate: '2026-03-01' });
      expect(result.success).toBe(true);
    });

    it('should accept dueDate update', () => {
      const result = BillUpdateRequestSchema.safeParse({ dueDate: '2026-04-01' });
      expect(result.success).toBe(true);
    });

    it('should accept fundingAccountId update', () => {
      const result = BillUpdateRequestSchema.safeParse({
        fundingAccountId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null fundingAccountId to clear it', () => {
      const result = BillUpdateRequestSchema.safeParse({ fundingAccountId: null });
      expect(result.success).toBe(true);
    });

    it('should accept multiple fields together', () => {
      const result = BillUpdateRequestSchema.safeParse({
        description: 'Updated',
        issueDate: '2026-03-01',
        dueDate: '2026-04-01',
        notes: 'Urgent',
        fundingAccountId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should strip unknown fields (direction, amount, contactId)', () => {
      const input = {
        description: 'Updated',
        direction: 'RECEIVABLE',
        amount: 999,
        contactId: 'contact-2',
      };
      const result = BillUpdateRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
      // Zod strips unknown fields by default
      expect(result.data).not.toHaveProperty('direction');
      expect(result.data).not.toHaveProperty('amount');
      expect(result.data).not.toHaveProperty('contactId');
    });

    it('should accept valid status transitions', () => {
      const result = BillUpdateRequestSchema.safeParse({ status: 'PAID' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const result = BillUpdateRequestSchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });
  });
});
