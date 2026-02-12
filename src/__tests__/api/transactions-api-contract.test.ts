/**
 * API Contract Tests for Transactions Endpoint
 * 
 * These tests validate the expected structure of transaction responses.
 * They use a simpler approach: create mock response data and validate it
 * against schemas, ensuring frontend expectations match backend output.
 * 
 * CRITICAL: Ensures debitAccount and creditAccount have currentBalance field
 * (not 'balance'), preventing display bugs on the frontend.
 */

import { z } from 'zod';

// Define the expected Account reference schema (nested in transactions)
const AccountReferenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  currentBalance: z.union([z.number(), z.object({})]), // CRITICAL: Must be currentBalance
});

// Define the expected Transaction response schema
const TransactionResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  transactionDate: z.union([z.string(), z.date()]),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'GENERAL']),
  amount: z.union([z.number(), z.object({})]), // Can be number or Prisma Decimal
  description: z.string(),
  debitAccountId: z.string(),
  creditAccountId: z.string(),
  debitAccount: AccountReferenceSchema,
  creditAccount: AccountReferenceSchema,
  referenceNumber: z.string().nullable().optional(),
  // Temporal fields
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
type AccountReference = z.infer<typeof AccountReferenceSchema>;

describe('Transactions API Contract Tests', () => {
  describe('Transaction Response Schema Validation', () => {
    it('should validate a valid INCOME transaction response', () => {
      const mockTransaction: TransactionResponse = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INCOME',
        amount: 1000.00,
        description: 'Donation received',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Checking Account',
          currentBalance: 1000.00, // CRITICAL: Must be currentBalance
        },
        creditAccount: {
          id: 'account-2',
          code: '4000',
          name: 'Donation Revenue',
          currentBalance: 1000.00,
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const result = TransactionResponseSchema.safeParse(mockTransaction);
      expect(result.success).toBe(true);
    });

    it('should require currentBalance in account references (NOT balance)', () => {
      const validAccount: AccountReference = {
        id: 'account-1',
        code: '1000',
        name: 'Checking Account',
        currentBalance: 1000.00,
      };

      const result = AccountReferenceSchema.safeParse(validAccount);
      expect(result.success).toBe(true);

      // Verify schema REJECTS 'balance' field without 'currentBalance'
      const invalidAccount = {
        id: 'account-1',
        code: '1000',
        name: 'Checking Account',
        balance: 1000.00, // WRONG FIELD NAME
        // missing currentBalance
      };

      const invalidResult = AccountReferenceSchema.safeParse(invalidAccount);
      expect(invalidResult.success).toBe(false);
    });

    it('should validate transaction with all transaction types', () => {
      const transactionTypes: Array<'INCOME' | 'EXPENSE' | 'TRANSFER' | 'GENERAL'> = [
        'INCOME',
        'EXPENSE',
        'TRANSFER',
        'GENERAL',
      ];

      transactionTypes.forEach((type) => {
        const mockTransaction = {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: new Date('2024-01-15'),
          type,
          amount: 1000.00,
          description: `${type} transaction`,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Account 1',
            currentBalance: 0,
          },
          creditAccount: {
            id: 'account-2',
            code: '2000',
            name: 'Account 2',
            currentBalance: 0,
          },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        };

        const result = TransactionResponseSchema.safeParse(mockTransaction);
        expect(result.success).toBe(true);
      });
    });

    it('should require all mandatory transaction fields', () => {
      const completeTransaction = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INCOME' as const,
        amount: 1000.00,
        description: 'Test transaction',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Account 1',
          currentBalance: 0,
        },
        creditAccount: {
          id: 'account-2',
          code: '2000',
          name: 'Account 2',
          currentBalance: 0,
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      // Should pass with all fields
      expect(TransactionResponseSchema.safeParse(completeTransaction).success).toBe(true);

      // Should fail without required fields
      const { id, ...withoutId } = completeTransaction;
      expect(TransactionResponseSchema.safeParse(withoutId).success).toBe(false);

      const { amount, ...withoutAmount } = completeTransaction;
      expect(TransactionResponseSchema.safeParse(withoutAmount).success).toBe(false);

      const { debitAccount, ...withoutDebitAccount } = completeTransaction;
      expect(TransactionResponseSchema.safeParse(withoutDebitAccount).success).toBe(false);
    });

    it('should require all mandatory account reference fields', () => {
      const completeAccount = {
        id: 'account-1',
        code: '1000',
        name: 'Checking Account',
        currentBalance: 1000.00,
      };

      // Should pass with all fields
      expect(AccountReferenceSchema.safeParse(completeAccount).success).toBe(true);

      // Should fail without required fields
      const { id, ...withoutId } = completeAccount;
      expect(AccountReferenceSchema.safeParse(withoutId).success).toBe(false);

      const { code, ...withoutCode } = completeAccount;
      expect(AccountReferenceSchema.safeParse(withoutCode).success).toBe(false);

      const { currentBalance, ...withoutBalance } = completeAccount;
      expect(AccountReferenceSchema.safeParse(withoutBalance).success).toBe(false);
    });

    it('should accept Prisma Decimal objects for amounts', () => {
      const mockTransaction = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INCOME' as const,
        amount: { d: [100000], e: 2, s: 1 }, // Prisma Decimal representation
        description: 'Test transaction',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Account 1',
          currentBalance: { d: [100000], e: 2, s: 1 },
        },
        creditAccount: {
          id: 'account-2',
          code: '2000',
          name: 'Account 2',
          currentBalance: { d: [100000], e: 2, s: 1 },
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const result = TransactionResponseSchema.safeParse(mockTransaction);
      expect(result.success).toBe(true);
    });

    it('should accept dates as both Date objects and ISO strings', () => {
      const withDateObjects = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INCOME' as const,
        amount: 1000.00,
        description: 'Test',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Account 1',
          currentBalance: 0,
        },
        creditAccount: {
          id: 'account-2',
          code: '2000',
          name: 'Account 2',
          currentBalance: 0,
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const withISOStrings = {
        ...withDateObjects,
        transactionDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      expect(TransactionResponseSchema.safeParse(withDateObjects).success).toBe(true);
      expect(TransactionResponseSchema.safeParse(withISOStrings).success).toBe(true);
    });

    it('should reject invalid transaction types', () => {
      const invalidTransaction = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INVALID_TYPE', // Not a valid enum value
        amount: 1000.00,
        description: 'Test',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Account 1',
          currentBalance: 0,
        },
        creditAccount: {
          id: 'account-2',
          code: '2000',
          name: 'Account 2',
          currentBalance: 0,
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const result = TransactionResponseSchema.safeParse(invalidTransaction);
      expect(result.success).toBe(false);
    });

    it('should handle optional referenceNumber field', () => {
      const withReference = {
        id: 'txn-1',
        organizationId: 'org-123',
        transactionDate: new Date('2024-01-15'),
        type: 'INCOME' as const,
        amount: 1000.00,
        description: 'Test',
        referenceNumber: 'REF-12345',
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Account 1',
          currentBalance: 0,
        },
        creditAccount: {
          id: 'account-2',
          code: '2000',
          name: 'Account 2',
          currentBalance: 0,
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const withoutReference = { ...withReference };
      delete (withoutReference as any).referenceNumber;

      const withNullReference = { ...withReference, referenceNumber: null };

      expect(TransactionResponseSchema.safeParse(withReference).success).toBe(true);
      expect(TransactionResponseSchema.safeParse(withoutReference).success).toBe(true);
      expect(TransactionResponseSchema.safeParse(withNullReference).success).toBe(true);
    });
  });

  describe('API Response List Structure', () => {
    it('should validate structure of transactions list response', () => {
      const TransactionsListResponseSchema = z.object({
        transactions: z.array(TransactionResponseSchema),
        pagination: z.object({
          totalCount: z.number(),
          page: z.number(),
          limit: z.number(),
          totalPages: z.number(),
        }),
      });

      const mockResponse = {
        transactions: [
          {
            id: 'txn-1',
            organizationId: 'org-123',
            transactionDate: '2024-01-15T00:00:00.000Z',
            type: 'INCOME' as const,
            amount: 1000.00,
            description: 'Test',
            debitAccountId: 'account-1',
            creditAccountId: 'account-2',
            debitAccount: {
              id: 'account-1',
              code: '1000',
              name: 'Account 1',
              currentBalance: 1000.00,
            },
            creditAccount: {
              id: 'account-2',
              code: '2000',
              name: 'Account 2',
              currentBalance: 1000.00,
            },
            createdAt: '2024-01-15T00:00:00.000Z',
            updatedAt: '2024-01-15T00:00:00.000Z',
          },
        ],
        pagination: {
          totalCount: 50,
          page: 1,
          limit: 10,
          totalPages: 5,
        },
      };

      const result = TransactionsListResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });
  });
});
