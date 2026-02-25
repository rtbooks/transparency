/**
 * Reconciliation API Contract Tests
 *
 * Validates request/response schemas for the reconciliation APIs.
 */

import { z } from 'zod';

// ── Statement Upload Schema ─────────────────────────────────────────────

const UploadSchema = z.object({
  statementDate: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  fileName: z.string(),
  fileContent: z.string(),
  columnMapping: z.object({
    date: z.number(),
    description: z.number(),
    amount: z.number().optional(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    reference: z.number().optional(),
    category: z.number().optional(),
    balance: z.number().optional(),
    hasHeader: z.boolean(),
  }).optional(),
});

// ── Statement Response Schema ───────────────────────────────────────────

const StatementResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  bankAccountId: z.string(),
  statementDate: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  openingBalance: z.any(), // Decimal comes as string
  closingBalance: z.any(),
  fileName: z.string(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

// ── Statement Line Response Schema ──────────────────────────────────────

const StatementLineSchema = z.object({
  id: z.string(),
  bankStatementId: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  amount: z.any(),
  matchedTransactionId: z.string().nullable(),
  matchConfidence: z.enum(['AUTO_EXACT', 'AUTO_FUZZY', 'MANUAL', 'UNMATCHED']),
  status: z.enum(['UNMATCHED', 'MATCHED', 'CONFIRMED', 'SKIPPED']),
});

// ── Auto-Match Response Schema ──────────────────────────────────────────

const AutoMatchResponseSchema = z.object({
  total: z.number(),
  exactMatches: z.number(),
  fuzzyMatches: z.number(),
  unmatched: z.number(),
  matches: z.array(z.object({
    statementLineId: z.string(),
    transactionId: z.string(),
    confidence: z.enum(['AUTO_EXACT', 'AUTO_FUZZY']),
    reason: z.string(),
  })),
});

// ── Line Action Schema ──────────────────────────────────────────────────

const LineActionSchema = z.object({
  action: z.enum(['match', 'unmatch', 'skip']),
  transactionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('Reconciliation API Contracts', () => {
  describe('Statement Upload', () => {
    it('should accept valid upload payload', () => {
      const payload = {
        statementDate: '2026-01-31',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        openingBalance: 5000.00,
        closingBalance: 4850.00,
        fileName: 'january-2026.csv',
        fileContent: 'Date,Description,Amount\n01/15/2026,Test,100',
      };
      expect(UploadSchema.safeParse(payload).success).toBe(true);
    });

    it('should accept upload with explicit column mapping', () => {
      const payload = {
        statementDate: '2026-01-31',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        openingBalance: 5000,
        closingBalance: 4850,
        fileName: 'statement.csv',
        fileContent: 'A,B,C\n01/15/2026,Test,100',
        columnMapping: {
          date: 0,
          description: 1,
          amount: 2,
          hasHeader: true,
        },
      };
      expect(UploadSchema.safeParse(payload).success).toBe(true);
    });

    it('should reject upload missing required fields', () => {
      expect(UploadSchema.safeParse({ fileName: 'test.csv' }).success).toBe(false);
    });
  });

  describe('Statement Response', () => {
    it('should validate statement response shape', () => {
      const response = {
        id: 'stmt-1',
        organizationId: 'org-1',
        bankAccountId: 'ba-1',
        statementDate: '2026-01-31T12:00:00.000Z',
        periodStart: '2026-01-01T12:00:00.000Z',
        periodEnd: '2026-01-31T12:00:00.000Z',
        openingBalance: '5000.00',
        closingBalance: '4850.00',
        fileName: 'january.csv',
        status: 'DRAFT',
      };
      expect(StatementResponseSchema.safeParse(response).success).toBe(true);
    });

    it('should validate all reconciliation statuses', () => {
      for (const status of ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) {
        const response = {
          id: 'stmt-1', organizationId: 'org-1', bankAccountId: 'ba-1',
          statementDate: '2026-01-31T12:00:00.000Z', periodStart: '2026-01-01T12:00:00.000Z',
          periodEnd: '2026-01-31T12:00:00.000Z', openingBalance: '0', closingBalance: '0',
          fileName: 'test.csv', status,
        };
        expect(StatementResponseSchema.safeParse(response).success).toBe(true);
      }
    });
  });

  describe('Statement Line', () => {
    it('should validate unmatched line', () => {
      const line = {
        id: 'line-1', bankStatementId: 'stmt-1',
        transactionDate: '2026-01-15T12:00:00.000Z',
        description: 'Electric Bill', amount: '-150.00',
        matchedTransactionId: null, matchConfidence: 'UNMATCHED', status: 'UNMATCHED',
      };
      expect(StatementLineSchema.safeParse(line).success).toBe(true);
    });

    it('should validate matched line', () => {
      const line = {
        id: 'line-1', bankStatementId: 'stmt-1',
        transactionDate: '2026-01-15T12:00:00.000Z',
        description: 'Payment', amount: '-500.00',
        matchedTransactionId: 'txn-1', matchConfidence: 'AUTO_EXACT', status: 'MATCHED',
      };
      expect(StatementLineSchema.safeParse(line).success).toBe(true);
    });
  });

  describe('Auto-Match Response', () => {
    it('should validate auto-match summary', () => {
      const response = {
        total: 10,
        exactMatches: 5,
        fuzzyMatches: 3,
        unmatched: 2,
        matches: [
          { statementLineId: 'line-1', transactionId: 'txn-1', confidence: 'AUTO_EXACT', reason: 'Match' },
          { statementLineId: 'line-2', transactionId: 'txn-2', confidence: 'AUTO_FUZZY', reason: 'Fuzzy' },
        ],
      };
      expect(AutoMatchResponseSchema.safeParse(response).success).toBe(true);
    });
  });

  describe('Line Actions', () => {
    it('should accept match action with transactionId', () => {
      const action = { action: 'match', transactionId: '550e8400-e29b-41d4-a716-446655440000' };
      expect(LineActionSchema.safeParse(action).success).toBe(true);
    });

    it('should accept unmatch action', () => {
      expect(LineActionSchema.safeParse({ action: 'unmatch' }).success).toBe(true);
    });

    it('should accept skip action with notes', () => {
      const action = { action: 'skip', notes: 'Bank fee' };
      expect(LineActionSchema.safeParse(action).success).toBe(true);
    });

    it('should reject invalid action', () => {
      expect(LineActionSchema.safeParse({ action: 'delete' }).success).toBe(false);
    });
  });
});
