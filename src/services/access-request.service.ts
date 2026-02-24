/**
 * Access Request Service
 * Handles donor self-service access requests to organizations.
 * Standard CRUD — no bitemporal versioning.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';
import type { AccessRequest, PrismaClient } from '@/generated/prisma/client';

export interface CreateAccessRequestInput {
  organizationId: string;
  userId: string;
  message?: string | null;
}

/**
 * Create a new access request. If the organization has AUTO_APPROVE,
 * the request is immediately approved and an OrganizationUser is created.
 */
export async function createAccessRequest(
  input: CreateAccessRequestInput
): Promise<AccessRequest & { autoApproved?: boolean }> {
  const { organizationId, userId, message } = input;

  // Look up the organization to check donor access mode
  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: organizationId }),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  // Check if user already has access
  const existingMembership = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({ organizationId, userId }),
  });

  if (existingMembership) {
    throw new Error('You already have access to this organization');
  }

  // Check for existing pending request
  const existingRequest = await prisma.accessRequest.findFirst({
    where: { organizationId, userId, status: 'PENDING' },
  });

  if (existingRequest) {
    throw new Error('You already have a pending access request for this organization');
  }

  if (organization.donorAccessMode === 'AUTO_APPROVE') {
    // Auto-approve: create request as APPROVED and create membership in one transaction
    return await prisma.$transaction(async (tx) => {
      const request = await tx.accessRequest.create({
        data: {
          organizationId,
          userId,
          message,
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      await createDonorMembership(tx, organizationId, userId);

      return { ...request, autoApproved: true };
    });
  }

  // Require approval: just create the pending request
  return await prisma.accessRequest.create({
    data: {
      organizationId,
      userId,
      message,
    },
  });
}

/**
 * Approve a pending access request and create OrganizationUser with DONOR role.
 */
export async function approveAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<AccessRequest> {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.accessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Access request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Cannot approve a request with status ${request.status}`);
    }

    const updated = await tx.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    await createDonorMembership(tx, request.organizationId, request.userId);

    return updated;
  });
}

/**
 * Deny a pending access request.
 */
export async function denyAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<AccessRequest> {
  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Access request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot deny a request with status ${request.status}`);
  }

  return await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: 'DENIED',
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Get pending access requests for an organization.
 */
export async function getPendingRequests(
  organizationId: string
): Promise<(AccessRequest & { user: { id: string; name: string; email: string } })[]> {
  return await prisma.accessRequest.findMany({
    where: { organizationId, status: 'PENDING' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a user's access request for an organization (any status).
 */
export async function getRequestByUserAndOrg(
  organizationId: string,
  userId: string
): Promise<AccessRequest | null> {
  return await prisma.accessRequest.findFirst({
    where: { organizationId, userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get count of pending access requests for an organization.
 */
export async function getPendingRequestCount(
  organizationId: string
): Promise<number> {
  return await prisma.accessRequest.count({
    where: { organizationId, status: 'PENDING' },
  });
}

// Helper: create an OrganizationUser with DONOR role
async function createDonorMembership(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  organizationId: string,
  userId: string
): Promise<void> {
  await tx.organizationUser.create({
    data: {
      userId,
      organizationId,
      role: 'SUPPORTER',
    },
  });

  // Auto-link contact if one exists with matching email
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (user) {
    const existingContact = await tx.contact.findFirst({
      where: buildCurrentVersionWhere({
        organizationId,
        email: user.email,
      }),
    });

    if (existingContact && !existingContact.userId) {
      // Link the existing contact to the platform user (temporal: close old version, create new)
      const now = new Date();
      await closeVersion(tx.contact, existingContact.versionId, now, 'contact');
      await tx.contact.create({
        data: buildNewVersionData(existingContact, { userId } as any, now) as any,
      });
    }
  }
}
