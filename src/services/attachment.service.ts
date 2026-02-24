/**
 * Attachment Service
 * File attachment operations backed by Vercel Blob storage.
 */

import { prisma } from '@/lib/prisma';
import { put, del } from '@vercel/blob';
import type { Attachment } from '@/generated/prisma/client';

// ── Constants ──────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const MAX_FILE_SIZE = 250 * 1024; // 250 KB
export const MAX_ATTACHMENTS_PER_ENTITY = 10;

export type AttachmentEntityType = 'TRANSACTION' | 'BILL' | 'PROGRAM_SPENDING';

// ── Validation ─────────────────────────────────────────────

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttachmentValidationError';
  }
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new AttachmentValidationError(
      `File size ${file.size} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (250 KB)`
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    throw new AttachmentValidationError(
      `File type "${file.type}" is not allowed. Accepted types: PDF, PNG, JPG, WEBP`
    );
  }
}

// ── Service Functions ──────────────────────────────────────

export async function uploadAttachment(
  organizationId: string,
  entityType: AttachmentEntityType,
  entityId: string,
  file: File,
  uploadedBy?: string
): Promise<Attachment> {
  // Validate file
  validateFile(file);

  // Check attachment count limit
  const existingCount = await prisma.attachment.count({
    where: { organizationId, entityType, entityId },
  });

  if (existingCount >= MAX_ATTACHMENTS_PER_ENTITY) {
    throw new AttachmentValidationError(
      `Maximum of ${MAX_ATTACHMENTS_PER_ENTITY} attachments per entity reached`
    );
  }

  // Upload to Vercel Blob
  const blob = await put(
    `attachments/${organizationId}/${entityType.toLowerCase()}/${entityId}/${file.name}`,
    file,
    { access: 'private', addRandomSuffix: true }
  );

  // Create database record
  return prisma.attachment.create({
    data: {
      organizationId,
      entityType,
      entityId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      blobUrl: blob.url,
      uploadedBy,
    },
  });
}

export async function listAttachments(
  organizationId: string,
  entityType: AttachmentEntityType,
  entityId: string
): Promise<Attachment[]> {
  return prisma.attachment.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function getAttachment(
  organizationId: string,
  attachmentId: string
): Promise<Attachment | null> {
  return prisma.attachment.findFirst({
    where: { id: attachmentId, organizationId },
  });
}

export async function deleteAttachment(
  organizationId: string,
  attachmentId: string
): Promise<void> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, organizationId },
  });

  if (!attachment) {
    throw new AttachmentValidationError('Attachment not found');
  }

  // Delete from Vercel Blob
  await del(attachment.blobUrl);

  // Delete database record
  await prisma.attachment.delete({
    where: { id: attachmentId },
  });
}

export async function countAttachments(
  organizationId: string,
  entityType: AttachmentEntityType,
  entityIds: string[]
): Promise<Record<string, number>> {
  if (entityIds.length === 0) return {};

  const counts = await prisma.attachment.groupBy({
    by: ['entityId'],
    where: { organizationId, entityType, entityId: { in: entityIds } },
    _count: { id: true },
  });

  return Object.fromEntries(
    counts.map((c) => [c.entityId, c._count.id])
  );
}
