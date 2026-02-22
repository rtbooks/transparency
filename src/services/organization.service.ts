/**
 * Organization Service
 * Business logic for organization operations with temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { Organization, OrganizationStatus, SubscriptionTier } from '@/generated/prisma/client';

const orgRepo = new TemporalRepository<Organization>(prisma, 'organization');

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  ein: string | null;
  mission?: string | null;
  fiscalYearStart: Date;
  officialWebsite?: string;
  createdByUserId: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  ein?: string | null;
  mission?: string | null;
  fiscalYearStart?: Date;
  logoUrl?: string | null;
  status?: OrganizationStatus;
  subscriptionTier?: SubscriptionTier;
}

/**
 * Create a new organization (initial version)
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        ein: input.ein,
        mission: input.mission,
        fiscalYearStart: input.fiscalYearStart,
        officialWebsite: input.officialWebsite,
        einVerifiedAt: input.ein ? now : null,
        
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

    // Create the founding user as ORG_ADMIN (separate query — no @relation)
    await tx.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: input.createdByUserId,
        role: 'ORG_ADMIN',
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

    return org;
  });
}

/**
 * Find current version of organization by slug
 */
export async function findOrganizationBySlug(
  slug: string
): Promise<Organization | null> {
  return await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
}

/**
 * Find current version of organization by ID
 */
export async function findOrganizationById(
  id: string
): Promise<Organization | null> {
  return await orgRepo.findCurrentById(id);
}

/**
 * Find all current organizations
 */
export async function findAllOrganizations(): Promise<Organization[]> {
  return await orgRepo.findAllCurrent();
}

/**
 * Update organization (creates new version)
 */
export async function updateOrganization(
  id: string,
  updates: UpdateOrganizationInput,
  userId: string
): Promise<Organization> {
  return await orgRepo.update(id, updates, userId);
}

/**
 * Soft delete organization
 */
export async function deleteOrganization(
  id: string,
  userId: string
): Promise<Organization> {
  return await orgRepo.softDelete(id, userId);
}

/**
 * Get organization version history
 */
export async function getOrganizationHistory(
  id: string
): Promise<Organization[]> {
  return await orgRepo.findHistory(id);
}

/**
 * Get organization as it was at a specific date
 */
export async function getOrganizationAsOf(
  id: string,
  asOfDate: Date
): Promise<Organization | null> {
  return await orgRepo.findAsOf(id, asOfDate);
}

/**
 * Check if slug is available (not used by current organizations)
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const existing = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
  return !existing;
}

/**
 * Get organizations for a user (current versions only)
 */
export async function getOrganizationsForUser(userId: string) {
  const orgUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ userId }),
  });

  // Resolve organizations (bitemporal entities)
  const orgIds = [...new Set(orgUsers.map(ou => ou.organizationId))];
  const orgs = orgIds.length > 0
    ? await prisma.organization.findMany({
        where: {
          id: { in: orgIds },
          validTo: MAX_DATE,
          isDeleted: false,
        },
      })
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o]));

  return orgUsers
    .filter(ou => orgMap.has(ou.organizationId))
    .map(ou => ({
      ...orgMap.get(ou.organizationId)!,
      role: ou.role,
    }));
}

export const OrganizationService = {
  create: createOrganization,
  findBySlug: findOrganizationBySlug,
  findById: findOrganizationById,
  findAll: findAllOrganizations,
  update: updateOrganization,
  delete: deleteOrganization,
  
  // Temporal queries
  findHistory: async (slug: string): Promise<Organization[]> => {
    return await prisma.organization.findMany({
      where: { slug },
      orderBy: { validFrom: 'desc' },
    });
  },
  
  findAsOf: async (slug: string, asOfDate: Date): Promise<Organization | null> => {
    return await prisma.organization.findFirst({
      where: {
        slug,
        validFrom: { lte: asOfDate },
        validTo: { gt: asOfDate },
      },
    });
  },
  
  findChangesInRange: async (
    slug: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Organization[]> => {
    return await prisma.organization.findMany({
      where: {
        slug,
        systemFrom: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { systemFrom: 'desc' },
    });
  },
  
  // Utility methods
  isSlugAvailable,
  getOrganizationsForUser,
};
