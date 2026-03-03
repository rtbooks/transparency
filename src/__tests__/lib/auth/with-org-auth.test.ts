/**
 * Tests for withOrgAuth helper
 */
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import type { OrgAuthContext } from '@/lib/auth/with-org-auth';

// ── Mocks ────────────────────────────────────────────────────────────────

// Clerk auth mock
const mockAuth = jest.fn();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Prisma mock
const mockUserFindUnique = jest.fn();
const mockOrgFindFirst = jest.fn();
const mockOrgUserFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    organization: { findFirst: (...args: unknown[]) => mockOrgFindFirst(...args) },
    organizationUser: { findFirst: (...args: unknown[]) => mockOrgUserFindFirst(...args) },
  },
}));

jest.mock('@/lib/temporal/temporal-utils', () => ({
  buildCurrentVersionWhere: (where: Record<string, unknown>) => where,
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function setupAuth(clerkUserId: string | null) {
  mockAuth.mockResolvedValue({ userId: clerkUserId });
}

function setupUser(user: { id: string; isPlatformAdmin: boolean } | null) {
  mockUserFindUnique.mockResolvedValue(user);
}

function setupOrg(org: { id: string } | null) {
  mockOrgFindFirst.mockResolvedValue(org);
}

function setupOrgUser(orgUser: { role: string } | null) {
  mockOrgUserFindFirst.mockResolvedValue(orgUser);
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('withOrgAuth', () => {
  describe('error paths', () => {
    it('throws 401 when not authenticated', async () => {
      setupAuth(null);

      await expect(withOrgAuth('test-org')).rejects.toThrow(AuthError);
      await expect(withOrgAuth('test-org')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      });
    });

    it('throws 404 when user not in database', async () => {
      setupAuth('clerk_123');
      setupUser(null);

      await expect(withOrgAuth('test-org')).rejects.toMatchObject({
        statusCode: 404,
        message: 'User not found',
      });
    });

    it('throws 404 when organization not found', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg(null);

      await expect(withOrgAuth('test-org')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Organization not found',
      });
    });

    it('throws 403 when user is not a member', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser(null);

      await expect(withOrgAuth('test-org')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Access denied',
      });
    });

    it('throws 403 when role is insufficient', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser({ role: 'SUPPORTER' });

      await expect(
        withOrgAuth('test-org', { requiredRole: 'ORG_ADMIN' })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('ORG_ADMIN'),
      });
    });
  });

  describe('success paths', () => {
    it('returns context for ORG_ADMIN', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser({ role: 'ORG_ADMIN' });

      const ctx: OrgAuthContext = await withOrgAuth('test-org', {
        requiredRole: 'ORG_ADMIN',
      });

      expect(ctx).toEqual({
        userId: 'user-1',
        clerkUserId: 'clerk_123',
        orgId: 'org-1',
        slug: 'test-org',
        role: 'ORG_ADMIN',
        isPlatformAdmin: false,
        permissions: expect.objectContaining({
          createAccounts: true,
          editTransactions: true,
        }),
      });
    });

    it('allows SUPPORTER when no role required (membership only)', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser({ role: 'SUPPORTER' });

      const ctx = await withOrgAuth('test-org');

      expect(ctx.role).toBe('SUPPORTER');
      expect(ctx.permissions.viewOrganization).toBe(true);
      expect(ctx.permissions.createAccounts).toBe(false);
    });

    it('grants PLATFORM_ADMIN full access without membership', async () => {
      setupAuth('clerk_admin');
      setupUser({ id: 'admin-1', isPlatformAdmin: true });
      setupOrg({ id: 'org-1' });
      // Note: orgUser lookup is never reached for platform admins

      const ctx = await withOrgAuth('test-org', {
        requiredRole: 'ORG_ADMIN',
      });

      expect(ctx.role).toBe('PLATFORM_ADMIN');
      expect(ctx.isPlatformAdmin).toBe(true);
      expect(ctx.permissions.editOrganization).toBe(true);
      // Should NOT have called organizationUser.findFirst
      expect(mockOrgUserFindFirst).not.toHaveBeenCalled();
    });

    it('SUPPORTER can access endpoint requiring SUPPORTER role', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser({ role: 'SUPPORTER' });

      const ctx = await withOrgAuth('test-org', {
        requiredRole: 'SUPPORTER',
      });
      expect(ctx.role).toBe('SUPPORTER');
    });

    it('ORG_ADMIN satisfies SUPPORTER requirement', async () => {
      setupAuth('clerk_123');
      setupUser({ id: 'user-1', isPlatformAdmin: false });
      setupOrg({ id: 'org-1' });
      setupOrgUser({ role: 'ORG_ADMIN' });

      const ctx = await withOrgAuth('test-org', {
        requiredRole: 'SUPPORTER',
      });
      expect(ctx.role).toBe('ORG_ADMIN');
    });
  });
});

describe('AuthError', () => {
  it('is an instance of Error', () => {
    const err = new AuthError('test', 403);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AuthError');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('test');
  });
});

describe('authErrorResponse', () => {
  it('returns a NextResponse with status code and message', () => {
    const err = new AuthError('Forbidden', 403);
    const res = authErrorResponse(err);
    expect(res.status).toBe(403);
  });
});
