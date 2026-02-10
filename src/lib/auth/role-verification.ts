/**
 * Server-side role verification utilities
 * 
 * Use these in API routes and server components to verify user permissions
 */

import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { hasRole, hasPermission, RolePermissions, getRolePermissions } from './permissions';

export interface UserOrgAccess {
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: RolePermissions;
}

/**
 * Get user's role and permissions for an organization
 * Returns null if user doesn't have access
 */
export async function getUserOrgAccess(
  clerkUserId: string,
  organizationSlug: string
): Promise<UserOrgAccess | null> {
  // Find user in database
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    return null;
  }

  // Find organization and user's access
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    include: {
      organizationUsers: {
        where: { userId: user.id },
      },
    },
  });

  if (!organization || organization.organizationUsers.length === 0) {
    return null;
  }

  const orgUser = organization.organizationUsers[0];
  const permissions = getRolePermissions(orgUser.role);

  return {
    userId: user.id,
    organizationId: organization.id,
    role: orgUser.role,
    permissions,
  };
}

/**
 * Verify user has minimum required role for an organization
 * Throws error if access denied
 */
export async function requireOrgRole(
  clerkUserId: string,
  organizationSlug: string,
  requiredRole: UserRole
): Promise<UserOrgAccess> {
  const access = await getUserOrgAccess(clerkUserId, organizationSlug);

  if (!access) {
    throw new Error('Access denied: User not found or not a member of this organization');
  }

  if (!hasRole(access.role, requiredRole)) {
    throw new Error(`Access denied: ${requiredRole} role required`);
  }

  return access;
}

/**
 * Verify user has specific permission for an organization
 * Throws error if access denied
 */
export async function requireOrgPermission(
  clerkUserId: string,
  organizationSlug: string,
  permission: keyof RolePermissions
): Promise<UserOrgAccess> {
  const access = await getUserOrgAccess(clerkUserId, organizationSlug);

  if (!access) {
    throw new Error('Access denied: User not found or not a member of this organization');
  }

  if (!hasPermission(access.role, permission)) {
    throw new Error(`Access denied: ${permission} permission required`);
  }

  return access;
}

/**
 * Check if user is ORG_ADMIN or higher for an organization
 */
export async function isOrgAdminRole(
  clerkUserId: string,
  organizationSlug: string
): Promise<boolean> {
  const access = await getUserOrgAccess(clerkUserId, organizationSlug);
  return access ? hasRole(access.role, 'ORG_ADMIN') : false;
}

/**
 * Check if user is PLATFORM_ADMIN
 * Platform admin is a system-wide flag, not tied to organization membership
 */
export async function isPlatformAdminRole(clerkUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
    select: { isPlatformAdmin: true },
  });

  return user?.isPlatformAdmin ?? false;
}

/**
 * Get user's org access or check if platform admin
 * Platform admins have full access to all organizations
 */
export async function getUserOrgAccessOrPlatformAdmin(
  clerkUserId: string,
  organizationSlug: string
): Promise<UserOrgAccess | null> {
  // Find user in database
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
    select: { id: true, isPlatformAdmin: true },
  });

  if (!user) {
    return null;
  }

  // Platform admins have full access
  if (user.isPlatformAdmin) {
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true },
    });

    if (!organization) {
      return null;
    }

    return {
      userId: user.id,
      organizationId: organization.id,
      role: 'PLATFORM_ADMIN' as UserRole,
      permissions: getRolePermissions('PLATFORM_ADMIN'),
    };
  }

  // Otherwise check organization membership
  return getUserOrgAccess(clerkUserId, organizationSlug);
}
