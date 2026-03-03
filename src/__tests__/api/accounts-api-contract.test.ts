/**
 * API Contract Tests for Accounts Endpoint
 * 
 * These tests validate that the accounts API returns the correct shape
 * and field names that the frontend expects. This catches integration bugs
 * like field name mismatches (e.g., 'balance' vs 'currentBalance').
 * 
 * CRITICAL: These tests prevent bugs where backend and frontend evolve
 * independently and break the contract between them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/organizations/[slug]/accounts/route';
import { z } from 'zod';

// Mock withOrgAuth
const mockWithOrgAuth = jest.fn();
jest.mock('@/lib/auth/with-org-auth', () => ({
  withOrgAuth: (...args: unknown[]) => mockWithOrgAuth(...args),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
  authErrorResponse: (error: { message: string; statusCode: number }) => {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  },
}));

jest.mock('@/services/account.service', () => ({
  findAccountsByOrganization: jest.fn(),
  findActiveAccounts: jest.fn(),
  createAccount: jest.fn(),
  isAccountCodeAvailable: jest.fn(),
  findAccountById: jest.fn(),
}));

import {
  findAccountsByOrganization,
  findActiveAccounts,
} from '@/services/account.service';

import { AuthError } from '@/lib/auth/with-org-auth';

// Define the expected Account response schema
const AccountResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  currentBalance: z.union([z.number(), z.object({})]), // Can be number or Prisma Decimal
  initialBalance: z.union([z.number(), z.object({})]),
  parentAccountId: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  // Temporal fields (dates get serialized as strings in JSON responses)
  validFrom: z.union([z.string(), z.date()]),
  validTo: z.union([z.string(), z.date()]),
  systemFrom: z.union([z.string(), z.date()]),
  systemTo: z.union([z.string(), z.date(), z.null()]),
  isDeleted: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

type AccountResponse = z.infer<typeof AccountResponseSchema>;

describe('Accounts API Contract Tests', () => {
  const defaultCtx = {
    userId: 'user-123',
    clerkUserId: 'clerk-user-123',
    orgId: 'org-123',
    slug: 'test-org',
    role: 'ORG_ADMIN' as const,
    isPlatformAdmin: false,
    permissions: {
      viewOrganization: true, editOrganization: true, deleteOrganization: true,
      viewAccounts: true, createAccounts: true, editAccounts: true, deleteAccounts: true,
      viewTransactions: true, createTransactions: true, editTransactions: true, deleteTransactions: true,
      viewUsers: true, inviteUsers: true, editUserRoles: true, removeUsers: true,
      viewBalances: true, exportData: true, viewPublicDashboard: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWithOrgAuth.mockResolvedValue(defaultCtx);
  });

  describe('GET /api/organizations/[slug]/accounts', () => {
    it('should return array of accounts with correct shape', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Checking Account',
          type: 'ASSET',
          currentBalance: 5000.00, // CRITICAL: Must be currentBalance, not balance
          initialBalance: 0,
          parentAccountId: null,
          description: 'Main checking account',
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'account-2',
          organizationId: 'org-123',
          code: '4000',
          name: 'Donation Revenue',
          type: 'REVENUE',
          currentBalance: 5000.00,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);

      // Validate each account matches schema
      data.forEach((account: unknown) => {
        const result = AccountResponseSchema.safeParse(account);
        if (!result.success) {
          console.error('Schema validation failed:', JSON.stringify(result.error, null, 2));
        }
        expect(result.success).toBe(true);
      });
    });

    it('should return accounts with currentBalance field (NOT balance)', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Checking Account',
          type: 'ASSET',
          currentBalance: 1000.00,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();
      const account = data[0];

      // CRITICAL: Must have currentBalance, not balance
      expect(account).toHaveProperty('currentBalance');
      expect(account.currentBalance).toBe(1000.00);
      
      // CRITICAL: Should NOT have deprecated 'balance' field
      expect(account).not.toHaveProperty('balance');
    });

    it('should return accounts with all required fields', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Checking Account',
          type: 'ASSET',
          currentBalance: 0,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();
      const account = data[0];

      // Verify all required fields are present
      expect(account).toHaveProperty('id');
      expect(account).toHaveProperty('organizationId');
      expect(account).toHaveProperty('code');
      expect(account).toHaveProperty('name');
      expect(account).toHaveProperty('type');
      expect(account).toHaveProperty('currentBalance');
      expect(account).toHaveProperty('initialBalance');
      expect(account).toHaveProperty('isActive');
      expect(account).toHaveProperty('validFrom');
      expect(account).toHaveProperty('validTo');
      expect(account).toHaveProperty('systemFrom');
      expect(account).toHaveProperty('isDeleted');
    });

    it('should return accounts with valid account types', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Asset Account',
          type: 'ASSET',
          currentBalance: 0,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'account-2',
          organizationId: 'org-123',
          code: '2000',
          name: 'Liability Account',
          type: 'LIABILITY',
          currentBalance: 0,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();

      // Verify account types are valid enums
      const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
      data.forEach((account: AccountResponse) => {
        expect(validTypes).toContain(account.type);
      });
    });

    it('should return accounts with temporal fields for versioning', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Checking Account',
          type: 'ASSET',
          currentBalance: 0,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();
      const account = data[0];

      // Verify temporal fields are present
      expect(account).toHaveProperty('validFrom');
      expect(account).toHaveProperty('validTo');
      expect(account).toHaveProperty('systemFrom');
      expect(account).toHaveProperty('systemTo');
      expect(account).toHaveProperty('isDeleted');

      // Verify temporal fields are dates
      expect(account.validFrom).toBeDefined();
      expect(account.validTo).toBeDefined();
      expect(account.systemFrom).toBeDefined();
      expect(account.isDeleted).toBe(false);
    });

    it('should handle parent-child account relationships', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-parent',
          organizationId: 'org-123',
          code: '1000',
          name: 'Assets',
          type: 'ASSET',
          currentBalance: 5000.00,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'account-child',
          organizationId: 'org-123',
          code: '1100',
          name: 'Current Assets',
          type: 'ASSET',
          currentBalance: 3000.00,
          initialBalance: 0,
          parentAccountId: 'account-parent',
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();
      
      const parent = data.find((a: AccountResponse) => a.id === 'account-parent');
      const child = data.find((a: AccountResponse) => a.id === 'account-child');

      expect(parent.parentAccountId).toBeNull();
      expect(child.parentAccountId).toBe('account-parent');
    });

    it('should handle zero and negative balances correctly', async () => {
      const mockAccounts: AccountResponse[] = [
        {
          id: 'account-1',
          organizationId: 'org-123',
          code: '1000',
          name: 'Zero Balance Account',
          type: 'ASSET',
          currentBalance: 0,
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'account-2',
          organizationId: 'org-123',
          code: '2000',
          name: 'Liability Account',
          type: 'LIABILITY',
          currentBalance: -1000.00, // Negative balance for liability
          initialBalance: 0,
          parentAccountId: null,
          description: null,
          isActive: true,
          validFrom: new Date('2024-01-01'),
          validTo: new Date('9999-12-31'),
          systemFrom: new Date('2024-01-01'),
          systemTo: null,
          isDeleted: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (findActiveAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      const data = await response.json();

      expect(data[0].currentBalance).toBe(0);
      expect(data[1].currentBalance).toBe(-1000.00);
    });

    it('should return 401 if user not authenticated', async () => {
      mockWithOrgAuth.mockRejectedValue(new AuthError('Unauthorized', 401));

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 403 if user has no access to organization', async () => {
      mockWithOrgAuth.mockRejectedValue(new AuthError('Access denied', 403));

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 404 if organization not found', async () => {
      mockWithOrgAuth.mockRejectedValue(new AuthError('Organization not found', 404));

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});
