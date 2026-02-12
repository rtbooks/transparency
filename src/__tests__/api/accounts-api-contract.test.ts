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
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/services/account.service', () => ({
  findAccountsByOrganization: jest.fn(),
  findActiveAccounts: jest.fn(),
  createAccount: jest.fn(),
  isAccountCodeAvailable: jest.fn(),
  findAccountById: jest.fn(),
}));

jest.mock('@/services/organization.service', () => ({
  findOrganizationBySlug: jest.fn(),
}));

import {
  findAccountsByOrganization,
  findActiveAccounts,
} from '@/services/account.service';
import { findOrganizationBySlug } from '@/services/organization.service';

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
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth mock
    (auth as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
    
    // Default user mock
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      authId: 'clerk-user-123',
      email: 'test@example.com',
    });
    
    // Default organization mock
    (findOrganizationBySlug as jest.Mock).mockResolvedValue({
      id: 'org-123',
      slug: 'test-org',
      name: 'Test Organization',
    });
    
    // Default user access mock
    (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue({
      id: 'org-user-123',
      userId: 'user-123',
      organizationId: 'org-123',
      role: 'ORG_ADMIN',
    });
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
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 403 if user has no access to organization', async () => {
      (prisma.organizationUser.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 404 if organization not found', async () => {
      (findOrganizationBySlug as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/organizations/test-org/accounts');
      const params = Promise.resolve({ slug: 'test-org' });
      const response = await GET(request, { params });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });
});
