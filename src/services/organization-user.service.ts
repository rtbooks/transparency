/**
 * OrganizationUser Service
 * Business logic for organization user/membership operations with temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { OrganizationUser, UserRole } from '@/generated/prisma/client';

const orgUserRepo = new TemporalRepository<OrganizationUser>(prisma, 'organizationUser');

export interface CreateOrganizationUserInput {
  userId: string;
  organizationId: string;
  role?: UserRole;
  anonymousDonor?: boolean;
  showInHighlights?: boolean;
  createdByUserId: string;
}

export interface UpdateOrganizationUserInput {
  role?: UserRole;
  anonymousDonor?: boolean;
  showInHighlights?: boolean;
}

/**
 * Create a new organization user membership (initial version)
 */
export async function createOrganizationUser(
  input: CreateOrganizationUserInput
): Promise<OrganizationUser> {
  const now = new Date();

  return await prisma.organizationUser.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role || 'DONOR',
      anonymousDonor: input.anonymousDonor ?? false,
      showInHighlights: input.showInHighlights ?? true,
      
      // Temporal fields (initial version)
      versionId: crypto.randomUUID(),
      previousVersionId: null,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
      isDeleted: false,
      changedBy: input.createdByUserId,
    },
  });
}

/**
 * Find current version of organization user by ID
 */
export async function findOrganizationUserById(
  id: string
): Promise<OrganizationUser | null> {
  return await orgUserRepo.findCurrentById(id);
}

/**
 * Find current organization user by userId and organizationId
 */
export async function findOrganizationUserByUserAndOrg(
  userId: string,
  organizationId: string
): Promise<OrganizationUser | null> {
  return await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({
      userId,
      organizationId,
    }),
  });
}

/**
 * Find all current users for an organization
 */
export async function findUsersForOrganization(
  organizationId: string
): Promise<OrganizationUser[]> {
  return await orgUserRepo.findAllCurrent({ organizationId });
}

/**
 * Find all current organizations for a user
 */
export async function findOrganizationsForUser(
  userId: string
): Promise<OrganizationUser[]> {
  return await orgUserRepo.findAllCurrent({ userId });
}

/**
 * Update organization user (creates new version)
 */
export async function updateOrganizationUser(
  id: string,
  updates: UpdateOrganizationUserInput,
  changedByUserId: string
): Promise<OrganizationUser> {
  return await orgUserRepo.update(id, updates, changedByUserId);
}

/**
 * Update user role (creates new version)
 */
export async function updateUserRole(
  userId: string,
  organizationId: string,
  newRole: UserRole,
  changedByUserId: string
): Promise<OrganizationUser> {
  const orgUser = await findOrganizationUserByUserAndOrg(userId, organizationId);
  if (!orgUser) {
    throw new Error('Organization user not found');
  }

  return await orgUserRepo.update(orgUser.id, { role: newRole }, changedByUserId);
}

/**
 * Remove user from organization (soft delete)
 */
export async function removeUserFromOrganization(
  userId: string,
  organizationId: string,
  removedByUserId: string
): Promise<OrganizationUser> {
  const orgUser = await findOrganizationUserByUserAndOrg(userId, organizationId);
  if (!orgUser) {
    throw new Error('Organization user not found');
  }

  return await orgUserRepo.softDelete(orgUser.id, removedByUserId);
}

/**
 * Get organization user version history
 */
export async function getOrganizationUserHistory(
  id: string
): Promise<OrganizationUser[]> {
  return await orgUserRepo.findHistory(id);
}

/**
 * Get organization user as it was at a specific date
 */
export async function getOrganizationUserAsOf(
  id: string,
  asOfDate: Date
): Promise<OrganizationUser | null> {
  return await orgUserRepo.findAsOf(id, asOfDate);
}

/**
 * Check if user has specific role in organization (current version)
 */
export async function hasRole(
  userId: string,
  organizationId: string,
  role: UserRole | UserRole[]
): Promise<boolean> {
  const orgUser = await findOrganizationUserByUserAndOrg(userId, organizationId);
  if (!orgUser) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(orgUser.role);
}

/**
 * Check if user is admin of organization
 */
export async function isOrgAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return await hasRole(userId, organizationId, 'ORG_ADMIN');
}

/**
 * Get active donors for an organization (for donor highlights)
 */
export async function getActiveDonors(
  organizationId: string
): Promise<OrganizationUser[]> {
  return await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      role: 'DONOR',
      showInHighlights: true,
      anonymousDonor: false,
    }),
    include: {
      user: true,
    },
  });
}

export const OrganizationUserService = {
  create: createOrganizationUser,
  findById: findOrganizationUserById,
  findByUserAndOrg: findOrganizationUserByUserAndOrg,
  findByOrganization: findUsersForOrganization,
  findByUser: findOrganizationsForUser,
  update: updateOrganizationUser,
  updateRole: updateUserRole,
  remove: removeUserFromOrganization,
  
  // Temporal queries
  findHistory: getOrganizationUserHistory,
  findAsOf: getOrganizationUserAsOf,
  
  // Utility methods
  hasRole,
  isOrgAdmin,
  getActiveDonors,
};
