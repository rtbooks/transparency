/**
 * API Contract tests for Program Spending endpoints
 *
 * Validates the response schema matches what the UI components expect.
 */

import { z } from 'zod';

// Response schema for list endpoint (GET /program-spending)
const SpendingItemSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  title: z.string(),
  description: z.string(),
  estimatedAmount: z.number(),
  actualTotal: z.number(),
  transactionCount: z.number(),
  targetDate: z.string().nullable(),
  status: z.enum(['PLANNED', 'PURCHASED', 'CANCELLED']),
  createdAt: z.string(),
});

const ListResponseSchema = z.object({
  items: z.array(SpendingItemSchema),
});

// Response schema for detail endpoint (GET /program-spending/[id])
const LinkedTransactionSchema = z.object({
  linkId: z.string(),
  transactionId: z.string(),
  amount: z.number(),
  linkedAt: z.string(),
  transaction: z.object({
    id: z.string(),
    description: z.string(),
    amount: z.number(),
    transactionDate: z.string(),
    type: z.string(),
  }).nullable(),
});

const DetailResponseSchema = SpendingItemSchema.extend({
  actualTotal: z.number(),
  linkedTransactions: z.array(LinkedTransactionSchema),
});

// Response schema for statistics endpoint
const StatisticsResponseSchema = z.object({
  total: z.number(),
  planned: z.number(),
  purchased: z.number(),
  cancelled: z.number(),
  totalEstimated: z.number(),
  totalActual: z.number(),
});

// Request schema for create endpoint (POST)
const CreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string(),
  estimatedAmount: z.number().positive(),
  targetDate: z.string().nullable().optional(),
});

// Request schema for update endpoint (PATCH)
const UpdateRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  estimatedAmount: z.number().positive().optional(),
  targetDate: z.string().nullable().optional(),
  status: z.enum(['PLANNED', 'PURCHASED', 'CANCELLED']).optional(),
});

// Link transaction request schema
const LinkTransactionRequestSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().positive(),
});

describe('Program Spending API Contract', () => {
  describe('List Response Schema', () => {
    const mockListResponse = {
      items: [
        {
          id: 'ps-1',
          versionId: 'v-1',
          title: 'Community Garden Supplies',
          description: 'Seeds and tools for community garden project',
          estimatedAmount: 5000,
          actualTotal: 2500,
          transactionCount: 2,
          targetDate: '2026-06-01T00:00:00.000Z',
          status: 'PURCHASED' as const,
          createdAt: '2026-01-15T10:00:00.000Z',
        },
        {
          id: 'ps-2',
          versionId: 'v-2',
          title: 'Youth Workshop Materials',
          description: 'Art supplies and educational materials',
          estimatedAmount: 1500,
          actualTotal: 0,
          transactionCount: 0,
          targetDate: null,
          status: 'PLANNED' as const,
          createdAt: '2026-02-01T10:00:00.000Z',
        },
      ],
    };

    it('should validate list response with all required fields', () => {
      const result = ListResponseSchema.safeParse(mockListResponse);
      expect(result.success).toBe(true);
    });

    it('should FAIL if items array is missing', () => {
      const result = ListResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should FAIL if title is missing from an item', () => {
      const { title, ...incomplete } = mockListResponse.items[0];
      const result = SpendingItemSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should FAIL if estimatedAmount is missing', () => {
      const { estimatedAmount, ...incomplete } = mockListResponse.items[0];
      const result = SpendingItemSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should FAIL if actualTotal is missing', () => {
      const { actualTotal, ...incomplete } = mockListResponse.items[0];
      const result = SpendingItemSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should validate item with null targetDate', () => {
      const result = SpendingItemSchema.safeParse(mockListResponse.items[1]);
      expect(result.success).toBe(true);
    });
  });

  describe('Detail Response Schema', () => {
    const mockDetailResponse = {
      id: 'ps-1',
      versionId: 'v-1',
      title: 'Community Garden Supplies',
      description: 'Seeds and tools',
      estimatedAmount: 5000,
      actualTotal: 2500,
      transactionCount: 2,
      targetDate: '2026-06-01T00:00:00.000Z',
      status: 'PURCHASED' as const,
      createdAt: '2026-01-15T10:00:00.000Z',
      linkedTransactions: [
        {
          linkId: 'link-1',
          transactionId: 'tx-1',
          amount: 1500,
          linkedAt: '2026-02-20T10:00:00.000Z',
          transaction: {
            id: 'tx-1',
            description: 'Garden supplies purchase',
            amount: 1500,
            transactionDate: '2026-02-20T00:00:00.000Z',
            type: 'EXPENSE',
          },
        },
        {
          linkId: 'link-2',
          transactionId: 'tx-2',
          amount: 1000,
          linkedAt: '2026-03-01T10:00:00.000Z',
          transaction: null,
        },
      ],
    };

    it('should validate detail response with linked transactions', () => {
      const result = DetailResponseSchema.safeParse(mockDetailResponse);
      expect(result.success).toBe(true);
    });

    it('should FAIL if linkedTransactions is missing', () => {
      const { linkedTransactions, ...incomplete } = mockDetailResponse;
      const result = DetailResponseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should accept null transaction in linked transaction', () => {
      const result = LinkedTransactionSchema.safeParse(
        mockDetailResponse.linkedTransactions[1]
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Statistics Response Schema', () => {
    it('should validate statistics response', () => {
      const mockStats = {
        total: 10,
        planned: 3,
        purchased: 6,
        cancelled: 1,
        totalEstimated: 25000,
        totalActual: 12000,
      };
      const result = StatisticsResponseSchema.safeParse(mockStats);
      expect(result.success).toBe(true);
    });

    it('should FAIL if totalActual is missing', () => {
      const result = StatisticsResponseSchema.safeParse({
        total: 10,
        planned: 3,
        purchased: 6,
        cancelled: 1,
        totalEstimated: 25000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Create Request Schema', () => {
    it('should accept valid create request', () => {
      const result = CreateRequestSchema.safeParse({
        title: 'Community Garden Supplies',
        description: 'Seeds and tools',
        estimatedAmount: 5000,
        targetDate: '2026-06-01',
      });
      expect(result.success).toBe(true);
    });

    it('should accept create request without optional fields', () => {
      const result = CreateRequestSchema.safeParse({
        title: 'Test Item',
        description: '',
        estimatedAmount: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should FAIL if title is empty', () => {
      const result = CreateRequestSchema.safeParse({
        title: '',
        description: '',
        estimatedAmount: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should FAIL if estimatedAmount is zero or negative', () => {
      const result = CreateRequestSchema.safeParse({
        title: 'Test',
        description: '',
        estimatedAmount: 0,
      });
      expect(result.success).toBe(false);
    });

  });

  describe('Update Request Schema', () => {
    it('should accept partial update with only title', () => {
      const result = UpdateRequestSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
    });

    it('should accept status change', () => {
      const result = UpdateRequestSchema.safeParse({ status: 'PURCHASED' });
      expect(result.success).toBe(true);
    });

    it('should accept null targetDate to clear it', () => {
      const result = UpdateRequestSchema.safeParse({ targetDate: null });
      expect(result.success).toBe(true);
    });

    it('should FAIL with invalid status', () => {
      const result = UpdateRequestSchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(false);
    });
  });

  describe('Link Transaction Request Schema', () => {
    it('should accept valid link request', () => {
      const result = LinkTransactionRequestSchema.safeParse({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 1500,
      });
      expect(result.success).toBe(true);
    });

    it('should FAIL if transactionId is not a UUID', () => {
      const result = LinkTransactionRequestSchema.safeParse({
        transactionId: 'not-a-uuid',
        amount: 1500,
      });
      expect(result.success).toBe(false);
    });

    it('should FAIL if amount is not positive', () => {
      const result = LinkTransactionRequestSchema.safeParse({
        transactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: -100,
      });
      expect(result.success).toBe(false);
    });
  });
});
