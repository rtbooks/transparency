/**
 * Contact Service
 * CRUD operations for contacts with bi-temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { Contact } from '@/generated/prisma/client';

export interface CreateContactInput {
  organizationId: string;
  name: string;
  type?: 'INDIVIDUAL' | 'ORGANIZATION';
  roles: ('DONOR' | 'VENDOR')[];
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  userId?: string | null;
  createdBy?: string;
}

export interface UpdateContactInput {
  name?: string;
  type?: 'INDIVIDUAL' | 'ORGANIZATION';
  roles?: ('DONOR' | 'VENDOR')[];
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

/**
 * Create a new contact (initial version)
 */
export async function createContact(
  input: CreateContactInput
): Promise<Contact> {
  const now = new Date();

  return await prisma.contact.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      type: input.type ?? 'INDIVIDUAL',
      roles: input.roles,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      userId: input.userId ?? null,
      isActive: true,

      // Temporal fields (initial version)
      versionId: crypto.randomUUID(),
      previousVersionId: null,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
      isDeleted: false,
      changedBy: input.createdBy ?? null,
    },
  });
}

/**
 * Update a contact (close old version, create new version)
 */
export async function updateContact(
  id: string,
  orgId: string,
  updates: UpdateContactInput,
  userId: string,
  reason?: string
): Promise<Contact> {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const current = await tx.contact.findFirst({
      where: buildCurrentVersionWhere({ id, organizationId: orgId }),
    });

    if (!current) {
      throw new Error('Contact not found');
    }

    // Close current version
    await tx.contact.update({
      where: { versionId: current.versionId },
      data: {
        validTo: now,
        systemTo: now,
      },
    });

    // Create new version
    return await tx.contact.create({
      data: {
        id: current.id,
        organizationId: current.organizationId,
        name: updates.name ?? current.name,
        type: updates.type ?? current.type,
        roles: updates.roles ?? current.roles,
        email: updates.email !== undefined ? updates.email : current.email,
        phone: updates.phone !== undefined ? updates.phone : current.phone,
        address: updates.address !== undefined ? updates.address : current.address,
        notes: updates.notes !== undefined ? updates.notes : current.notes,
        userId: current.userId,
        isActive: updates.isActive ?? current.isActive,

        versionId: crypto.randomUUID(),
        previousVersionId: current.versionId,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        changedBy: userId,
        changeReason: reason ?? null,
      },
    });
  });
}

/**
 * Find existing contact linked to a user in an org, or create one with DONOR role
 */
export async function findOrCreateForUser(
  orgId: string,
  userId: string,
  name: string,
  email?: string
): Promise<Contact> {
  const existing = await prisma.contact.findFirst({
    where: buildCurrentVersionWhere({
      organizationId: orgId,
      userId,
    }),
  });

  if (existing) {
    return existing;
  }

  return await createContact({
    organizationId: orgId,
    name,
    roles: ['DONOR'],
    email: email ?? null,
    userId,
    createdBy: userId,
  });
}

/**
 * Get current version of a contact by id and org
 */
export async function getContact(
  id: string,
  orgId: string
): Promise<Contact | null> {
  return await prisma.contact.findFirst({
    where: buildCurrentVersionWhere({ id, organizationId: orgId }),
  });
}

/**
 * List contacts with filtering and pagination
 */
export async function listContacts(
  orgId: string,
  options?: {
    role?: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<{ contacts: Contact[]; totalCount: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where = buildCurrentVersionWhere({
    organizationId: orgId,
    ...(options?.isActive !== undefined && { isActive: options.isActive }),
    ...(options?.role && { roles: { has: options.role as any } }),
    ...(options?.search && {
      OR: [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ],
    }),
  });

  const [contacts, totalCount] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return { contacts, totalCount };
}

/**
 * Soft delete a contact (temporal: set isDeleted, close version)
 */
export async function deleteContact(
  id: string,
  orgId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  const current = await prisma.contact.findFirst({
    where: buildCurrentVersionWhere({ id, organizationId: orgId }),
  });

  if (!current) {
    throw new Error('Contact not found');
  }

  await prisma.contact.update({
    where: { versionId: current.versionId },
    data: {
      validTo: now,
      systemTo: now,
      isDeleted: true,
      deletedAt: now,
      deletedBy: userId,
    },
  });
}
