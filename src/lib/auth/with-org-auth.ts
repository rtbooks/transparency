/**
 * Centralized organization authorization helper
 *
 * Replaces the ~20 lines of boilerplate auth code duplicated in every route:
 *   1. Clerk auth() → clerkUserId
 *   2. User lookup by authId
 *   3. Organization lookup by slug (temporal)
 *   4. OrganizationUser membership check (temporal)
 *   5. Optional role check
 *
 * Usage:
 *   const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });
 *   // ctx.userId, ctx.orgId, ctx.role, etc.
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { UserRole } from '@/generated/prisma/client';
import { hasRole, getRolePermissions, type RolePermissions } from './permissions';

// ── Types ────────────────────────────────────────────────────────────────

export interface OrgAuthContext {
  /** Internal user ID (UUID) */
  userId: string;
  /** Clerk user ID */
  clerkUserId: string;
  /** Organization ID (entity ID, not versionId) */
  orgId: string;
  /** Organization slug */
  slug: string;
  /** User's role in the organization */
  role: UserRole;
  /** Whether user is a platform admin */
  isPlatformAdmin: boolean;
  /** Resolved permission set for the role */
  permissions: RolePermissions;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Main helper ──────────────────────────────────────────────────────────

export interface WithOrgAuthOptions {
  /** Minimum role required. If omitted, any org member is allowed. */
  requiredRole?: UserRole;
}

/**
 * Authenticate and authorize a user for an organization.
 *
 * @throws {AuthError} with appropriate HTTP status code
 */
export async function withOrgAuth(
  slug: string,
  options?: WithOrgAuthOptions
): Promise<OrgAuthContext> {
  // 1. Clerk authentication
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new AuthError('Unauthorized', 401);
  }

  // 2. Resolve internal user
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
    select: { id: true, isPlatformAdmin: true },
  });
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  // 3. Resolve organization (temporal — current version)
  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
    select: { id: true },
  });
  if (!organization) {
    throw new AuthError('Organization not found', 404);
  }

  // 4. Platform admin shortcut — full access to all orgs
  if (user.isPlatformAdmin) {
    return {
      userId: user.id,
      clerkUserId,
      orgId: organization.id,
      slug,
      role: 'PLATFORM_ADMIN',
      isPlatformAdmin: true,
      permissions: getRolePermissions('PLATFORM_ADMIN'),
    };
  }

  // 5. Check org membership (temporal — current version)
  const orgUser = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({
      userId: user.id,
      organizationId: organization.id,
    }),
    select: { role: true },
  });
  if (!orgUser) {
    throw new AuthError('Access denied', 403);
  }

  // 6. Role check (if required)
  if (options?.requiredRole && !hasRole(orgUser.role, options.requiredRole)) {
    throw new AuthError(
      `Insufficient permissions: ${options.requiredRole} role required`,
      403
    );
  }

  return {
    userId: user.id,
    clerkUserId,
    orgId: organization.id,
    slug,
    role: orgUser.role,
    isPlatformAdmin: false,
    permissions: getRolePermissions(orgUser.role),
  };
}

// ── Response helper ──────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

/**
 * Converts an AuthError to a NextResponse. Use in route catch blocks:
 *
 * ```ts
 * try {
 *   const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });
 * } catch (error) {
 *   if (error instanceof AuthError) return authErrorResponse(error);
 *   throw error;
 * }
 * ```
 */
export function authErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json(
    { error: error.message },
    { status: error.statusCode }
  );
}
