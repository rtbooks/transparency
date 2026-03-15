/**
 * RBAC Authorization Tests
 *
 * Verifies that write endpoints correctly enforce ORG_ADMIN role
 * and that the withOrgAuth integration works end-to-end in route handlers.
 *
 * Tests representative routes from each category:
 * - Admin-only write endpoints (bills, accounts, transactions)
 * - Member-accessible endpoints (donations)
 * - The previously zero-auth endpoint (campaign tiers)
 */

import { NextRequest, NextResponse } from 'next/server';

// ── withOrgAuth mock ────────────────────────────────────────────────────

const mockWithOrgAuth = jest.fn();
const mockWithPlatformAuth = jest.fn();

jest.mock('@/lib/auth/with-org-auth', () => {
  class AuthErrorImpl extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  }
  return {
    withOrgAuth: (...args: unknown[]) => mockWithOrgAuth(...args),
    AuthError: AuthErrorImpl,
    authErrorResponse: (error: { message: string; statusCode: number }) =>
      NextResponse.json({ error: error.message }, { status: error.statusCode }),
  };
});

jest.mock('@/lib/auth/with-platform-auth', () => ({
  withPlatformAuth: (...args: unknown[]) => mockWithPlatformAuth(...args),
}));

// Import the mocked AuthError for use in tests
const { AuthError: MockAuthError } = jest.requireMock('@/lib/auth/with-org-auth');

// ── Service/dependency mocks ────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaignTier: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    campaign: { findUnique: jest.fn() },
    account: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/services/bill.service', () => ({
  createBill: jest.fn(),
  listBills: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/account.service', () => ({
  findAccountsByOrganization: jest.fn().mockResolvedValue([]),
  findActiveAccounts: jest.fn().mockResolvedValue([]),
  createAccount: jest.fn(),
  isAccountCodeAvailable: jest.fn(),
  findAccountById: jest.fn(),
}));

jest.mock('@/services/transaction.service', () => ({
  createTransaction: jest.fn(),
  listTransactions: jest.fn().mockResolvedValue({ transactions: [], total: 0 }),
  findTransactionById: jest.fn(),
  editTransaction: jest.fn(),
  voidTransaction: jest.fn(),
}));

jest.mock('@/services/donation.service', () => ({
  createPledgeDonation: jest.fn(),
  createOneTimeDonation: jest.fn(),
  listDonations: jest.fn().mockResolvedValue({ donations: [], total: 0, page: 1, pageSize: 50 }),
}));

jest.mock('@/services/contact.service', () => ({
  createContact: jest.fn(),
  listContacts: jest.fn().mockResolvedValue([]),
  findContactById: jest.fn(),
}));

jest.mock('@/services/reconciliation.service', () => ({
  startReconciliation: jest.fn(),
  listReconciliations: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/temporal/temporal-utils', () => ({
  buildCurrentVersionWhere: (where: Record<string, unknown>) => where,
  MAX_DATE: new Date('9999-12-31T23:59:59.999Z'),
}));

// ── Route imports (AFTER mocks) ─────────────────────────────────────────

import { POST as billsPost } from '@/app/api/organizations/[slug]/bills/route';
import { POST as tiersPost } from '@/app/api/organizations/[slug]/campaigns/[id]/tiers/route';
import { POST as contactsPost } from '@/app/api/organizations/[slug]/contacts/route';
import { POST as donationsPost } from '@/app/api/organizations/[slug]/donations/route';
import { POST as reconciliationsPost } from '@/app/api/organizations/[slug]/reconciliations/route';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeAdminCtx() {
  return {
    userId: 'user-1',
    clerkUserId: 'clerk_1',
    orgId: 'org-1',
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
}

function makeSupporterCtx() {
  return {
    ...makeAdminCtx(),
    role: 'SUPPORTER' as const,
    permissions: {
      viewOrganization: true, editOrganization: false, deleteOrganization: false,
      viewAccounts: true, createAccounts: false, editAccounts: false, deleteAccounts: false,
      viewTransactions: true, createTransactions: false, editTransactions: false, deleteTransactions: false,
      viewUsers: false, inviteUsers: false, editUserRoles: false, removeUsers: false,
      viewBalances: true, exportData: false, viewPublicDashboard: true,
    },
  };
}

function makePlatformAuthCtx(overrides?: Partial<{ orgRole: string | null }>) {
  return {
    userId: 'user-1',
    clerkUserId: 'clerk_1',
    orgId: 'org-1',
    slug: 'test-org',
    isPlatformAdmin: false,
    orgRole: overrides?.orgRole ?? null,
    permissions: {
      viewOrganization: true, editOrganization: false, deleteOrganization: false,
      viewAccounts: false, createAccounts: false, editAccounts: false, deleteAccounts: false,
      viewTransactions: false, createTransactions: false, editTransactions: false, deleteTransactions: false,
      viewUsers: false, inviteUsers: false, editUserRoles: false, removeUsers: false,
      viewBalances: false, exportData: false, viewPublicDashboard: true,
    },
  };
}

function makeReq(url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RBAC enforcement on admin-only endpoints', () => {
  const slugParams = Promise.resolve({ slug: 'test-org' });

  it('bills POST returns 403 for SUPPORTER', async () => {
    mockWithOrgAuth.mockRejectedValue(new MockAuthError('Insufficient permissions: ORG_ADMIN role required', 403));

    const req = makeReq('http://localhost/api/organizations/test-org/bills', {
      contactId: '00000000-0000-0000-0000-000000000001',
      direction: 'PAYABLE',
      amount: 100,
      issueDate: '2026-01-01',
      liabilityOrAssetAccountId: '00000000-0000-0000-0000-000000000002',
      expenseOrRevenueAccountId: '00000000-0000-0000-0000-000000000003',
    });
    const res = await billsPost(req, { params: slugParams });

    expect(res.status).toBe(403);
    expect(mockWithOrgAuth).toHaveBeenCalledWith('test-org', { requiredRole: 'ORG_ADMIN' });
  });

  it('bills POST passes auth for ORG_ADMIN (reaches business logic)', async () => {
    mockWithOrgAuth.mockResolvedValue(makeAdminCtx());

    const req = makeReq('http://localhost/api/organizations/test-org/bills', {
      contactId: '00000000-0000-0000-0000-000000000001',
      direction: 'PAYABLE',
      amount: 100,
      issueDate: '2026-01-01',
      liabilityOrAssetAccountId: '00000000-0000-0000-0000-000000000002',
      expenseOrRevenueAccountId: '00000000-0000-0000-0000-000000000003',
    });
    const res = await billsPost(req, { params: slugParams });

    // Auth passed — withOrgAuth was called and did NOT throw
    expect(mockWithOrgAuth).toHaveBeenCalledWith('test-org', { requiredRole: 'ORG_ADMIN' });
    // Response is NOT 401 or 403 (auth succeeded, any other status is business logic)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('contacts POST returns 403 for SUPPORTER', async () => {
    mockWithOrgAuth.mockRejectedValue(new MockAuthError('Insufficient permissions: ORG_ADMIN role required', 403));

    const req = makeReq('http://localhost/api/organizations/test-org/contacts', {
      name: 'Test Contact',
      type: 'VENDOR',
    });
    const res = await contactsPost(req, { params: slugParams });

    expect(res.status).toBe(403);
    expect(mockWithOrgAuth).toHaveBeenCalledWith('test-org', { requiredRole: 'ORG_ADMIN' });
  });

  it('reconciliations POST returns 403 for SUPPORTER', async () => {
    mockWithOrgAuth.mockRejectedValue(new MockAuthError('Insufficient permissions: ORG_ADMIN role required', 403));

    const req = makeReq('http://localhost/api/organizations/test-org/reconciliations', {
      accountId: '00000000-0000-0000-0000-000000000001',
      periodEnd: '2026-01-31',
      endingBalance: 5000,
    });
    const res = await reconciliationsPost(req, { params: slugParams });

    expect(res.status).toBe(403);
    expect(mockWithOrgAuth).toHaveBeenCalledWith('test-org', { requiredRole: 'ORG_ADMIN' });
  });
});

describe('RBAC enforcement on previously zero-auth endpoint', () => {
  it('campaign tiers POST returns 403 for SUPPORTER', async () => {
    mockWithOrgAuth.mockRejectedValue(new MockAuthError('Insufficient permissions: ORG_ADMIN role required', 403));

    const req = makeReq('http://localhost/api/organizations/test-org/campaigns/c1/tiers', {
      name: 'Gold',
      amount: 100,
    });
    const params = Promise.resolve({ slug: 'test-org', id: 'c1' });
    const res = await tiersPost(req, { params });

    expect(res.status).toBe(403);
    expect(mockWithOrgAuth).toHaveBeenCalledWith('test-org', { requiredRole: 'ORG_ADMIN' });
  });

  it('campaign tiers POST returns 401 for unauthenticated user', async () => {
    mockWithOrgAuth.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const req = makeReq('http://localhost/api/organizations/test-org/campaigns/c1/tiers', {
      name: 'Gold',
      amount: 100,
    });
    const params = Promise.resolve({ slug: 'test-org', id: 'c1' });
    const res = await tiersPost(req, { params });

    expect(res.status).toBe(401);
  });
});

describe('RBAC on member-accessible endpoints', () => {
  it('donations POST allows any authenticated user (no org membership required)', async () => {
    mockWithPlatformAuth.mockResolvedValue(makePlatformAuthCtx());
    const { createOneTimeDonation } = require('@/services/donation.service');
    createOneTimeDonation.mockResolvedValue({ id: 'donation-1' });

    const req = makeReq('http://localhost/api/organizations/test-org/donations', {
      type: 'ONE_TIME',
      amount: 50,
      campaignId: 'campaign-1',
    });
    const res = await donationsPost(req, { params: Promise.resolve({ slug: 'test-org' }) });

    // Should use withPlatformAuth (not withOrgAuth) — no membership required
    expect(mockWithPlatformAuth).toHaveBeenCalledWith('test-org');
    expect(mockWithOrgAuth).not.toHaveBeenCalled();
    expect(res.status).not.toBe(403);
  });

  it('donations POST returns 401 for unauthenticated user', async () => {
    mockWithPlatformAuth.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const req = makeReq('http://localhost/api/organizations/test-org/donations', {
      type: 'ONE_TIME',
      amount: 50,
    });
    const res = await donationsPost(req, { params: Promise.resolve({ slug: 'test-org' }) });

    expect(res.status).toBe(401);
  });
});

describe('withOrgAuth call patterns', () => {
  it('admin write endpoints pass requiredRole: ORG_ADMIN', async () => {
    mockWithOrgAuth.mockResolvedValue(makeAdminCtx());
    const { createBill } = require('@/services/bill.service');
    createBill.mockResolvedValue({ id: 'b1' });

    const req = makeReq('http://localhost/api/organizations/my-org/bills', {
      contactId: '00000000-0000-0000-0000-000000000001',
      direction: 'PAYABLE',
      amount: 100,
      issueDate: '2026-01-01',
      liabilityOrAssetAccountId: '00000000-0000-0000-0000-000000000002',
      expenseOrRevenueAccountId: '00000000-0000-0000-0000-000000000003',
    });
    await billsPost(req, { params: Promise.resolve({ slug: 'my-org' }) });

    // Verify slug is passed correctly
    expect(mockWithOrgAuth).toHaveBeenCalledWith('my-org', { requiredRole: 'ORG_ADMIN' });
  });

  it('donation endpoints use withPlatformAuth (no org membership required)', async () => {
    mockWithPlatformAuth.mockResolvedValue(makePlatformAuthCtx());
    const { createOneTimeDonation } = require('@/services/donation.service');
    createOneTimeDonation.mockResolvedValue({ id: 'd1' });

    const req = makeReq('http://localhost/api/organizations/my-org/donations', {
      type: 'ONE_TIME',
      amount: 25,
      campaignId: 'c1',
    });
    await donationsPost(req, { params: Promise.resolve({ slug: 'my-org' }) });

    // Verify withPlatformAuth is called (not withOrgAuth)
    expect(mockWithPlatformAuth).toHaveBeenCalledWith('my-org');
    expect(mockWithOrgAuth).not.toHaveBeenCalled();
  });
});
