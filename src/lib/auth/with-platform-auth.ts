/**
 * Platform-level authentication helper (no org membership required)
 *
 * Like withOrgAuth but does NOT check organization membership.
 * Use for routes where any authenticated platform user should have access,
 * such as making donations or viewing their own donation history.
 *
 * For routes that require org membership (dashboard, settings, etc.),
 * continue to use withOrgAuth.
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { UserRole } from '@/generated/prisma/client';
import { getRolePermissions, type RolePermissions } from './permissions';
import { ensureUserExists } from './ensure-user';
import { AuthError } from './with-org-auth';

export interface PlatformAuthContext {
  /** Internal user ID (UUID) */
  userId: string;
  /** Clerk user ID */
  clerkUserId: string;
  /** Organization ID (entity ID, not versionId) */
  orgId: string;
  /** Organization slug */
  slug: string;
  /** Whether user is a platform admin */
  isPlatformAdmin: boolean;
  /** User's role in the organization, if they are a member (null otherwise) */
  orgRole: UserRole | null;
  /** Resolved permission set (based on org role if member, or PUBLIC if not) */
  permissions: RolePermissions;
}

/**
 * Authenticate a platform user and resolve an organization.
 * Does NOT require org membership — any logged-in user passes.
 *
 * @throws {AuthError} with appropriate HTTP status code
 */
export async function withPlatformAuth(
  slug: string
): Promise<PlatformAuthContext> {
  // 1. Clerk authentication
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new AuthError('Unauthorized', 401);
  }

  // 2. Resolve internal user (auto-creates DB record for new Clerk users)
  let user: { id: string; isPlatformAdmin: boolean };
  try {
    const dbUser = await ensureUserExists(clerkUserId);
    user = { id: dbUser.id, isPlatformAdmin: dbUser.isPlatformAdmin };
  } catch {
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

  // 4. Platform admin shortcut
  if (user.isPlatformAdmin) {
    return {
      userId: user.id,
      clerkUserId,
      orgId: organization.id,
      slug,
      isPlatformAdmin: true,
      orgRole: 'PLATFORM_ADMIN',
      permissions: getRolePermissions('PLATFORM_ADMIN'),
    };
  }

  // 5. Check org membership (optional — for permission resolution)
  const orgUser = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({
      userId: user.id,
      organizationId: organization.id,
    }),
    select: { role: true },
  });

  return {
    userId: user.id,
    clerkUserId,
    orgId: organization.id,
    slug,
    isPlatformAdmin: false,
    orgRole: orgUser?.role ?? null,
    permissions: getRolePermissions(orgUser?.role ?? 'PUBLIC'),
  };
}
