/**
 * Unit tests for Attachment Service
 *
 * Tests upload validation, CRUD operations, count limits,
 * organization scoping, and Vercel Blob integration.
 */

import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    attachment: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test-file-abc123.pdf' }),
  del: jest.fn().mockResolvedValue(undefined),
}));

import {
  uploadAttachment,
  listAttachments,
  getAttachment,
  deleteAttachment,
  countAttachments,
  AttachmentValidationError,
  MAX_FILE_SIZE,
  MAX_ATTACHMENTS_PER_ENTITY,
  ALLOWED_MIME_TYPES,
} from '@/services/attachment.service';
import { put, del } from '@vercel/blob';

// Helper to create a mock File
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

const ORG_ID = 'org-123';
const ENTITY_TYPE = 'TRANSACTION' as const;
const ENTITY_ID = 'txn-456';
const USER_ID = 'user-789';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('uploadAttachment', () => {
  it('should upload a valid PDF file', async () => {
    const file = createMockFile('receipt.pdf', 100_000, 'application/pdf');
    (prisma.attachment.count as jest.Mock).mockResolvedValue(0);
    (prisma.attachment.create as jest.Mock).mockResolvedValue({
      id: 'att-1',
      organizationId: ORG_ID,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      fileName: 'receipt.pdf',
      fileSize: 100_000,
      mimeType: 'application/pdf',
      blobUrl: 'https://blob.vercel-storage.com/test-file-abc123.pdf',
      uploadedBy: USER_ID,
      uploadedAt: new Date(),
    });

    const result = await uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file, USER_ID);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining('attachments/org-123/transaction/txn-456/'),
      file,
      { access: 'public', addRandomSuffix: true }
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        entityType: ENTITY_TYPE,
        entityId: ENTITY_ID,
        fileName: 'receipt.pdf',
        fileSize: 100_000,
        mimeType: 'application/pdf',
        uploadedBy: USER_ID,
      }),
    });
    expect(result.id).toBe('att-1');
  });

  it('should upload a valid PNG image', async () => {
    const file = createMockFile('scan.png', 50_000, 'image/png');
    (prisma.attachment.count as jest.Mock).mockResolvedValue(0);
    (prisma.attachment.create as jest.Mock).mockResolvedValue({
      id: 'att-2',
      fileName: 'scan.png',
      mimeType: 'image/png',
    });

    await uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file);
    expect(prisma.attachment.create).toHaveBeenCalled();
  });

  it('should reject file exceeding 250 KB', async () => {
    const file = createMockFile('big.pdf', MAX_FILE_SIZE + 1, 'application/pdf');

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(AttachmentValidationError);

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(/exceeds maximum/);
  });

  it('should reject disallowed MIME type', async () => {
    const file = createMockFile('script.js', 100, 'application/javascript');

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(AttachmentValidationError);

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(/not allowed/);
  });

  it('should reject when attachment count limit reached', async () => {
    const file = createMockFile('receipt.pdf', 1000, 'application/pdf');
    (prisma.attachment.count as jest.Mock).mockResolvedValue(MAX_ATTACHMENTS_PER_ENTITY);

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(AttachmentValidationError);

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow(/Maximum/);
  });

  it('should NOT call blob upload if validation fails', async () => {
    const file = createMockFile('big.pdf', MAX_FILE_SIZE + 1, 'application/pdf');

    await expect(
      uploadAttachment(ORG_ID, ENTITY_TYPE, ENTITY_ID, file)
    ).rejects.toThrow();

    expect(put).not.toHaveBeenCalled();
  });
});

describe('listAttachments', () => {
  it('should return attachments for the specified entity', async () => {
    const mockAttachments = [
      { id: 'att-1', entityId: ENTITY_ID, fileName: 'a.pdf' },
      { id: 'att-2', entityId: ENTITY_ID, fileName: 'b.png' },
    ];
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue(mockAttachments);

    const result = await listAttachments(ORG_ID, ENTITY_TYPE, ENTITY_ID);

    expect(prisma.attachment.findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, entityType: ENTITY_TYPE, entityId: ENTITY_ID },
      orderBy: { uploadedAt: 'desc' },
    });
    expect(result).toHaveLength(2);
  });
});

describe('getAttachment', () => {
  it('should return attachment scoped to organization', async () => {
    (prisma.attachment.findFirst as jest.Mock).mockResolvedValue({
      id: 'att-1',
      organizationId: ORG_ID,
    });

    const result = await getAttachment(ORG_ID, 'att-1');

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'att-1', organizationId: ORG_ID },
    });
    expect(result).toBeTruthy();
  });

  it('should return null for non-existent attachment', async () => {
    (prisma.attachment.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getAttachment(ORG_ID, 'att-999');
    expect(result).toBeNull();
  });
});

describe('deleteAttachment', () => {
  it('should delete both blob and database record', async () => {
    (prisma.attachment.findFirst as jest.Mock).mockResolvedValue({
      id: 'att-1',
      organizationId: ORG_ID,
      blobUrl: 'https://blob.vercel-storage.com/test.pdf',
    });

    await deleteAttachment(ORG_ID, 'att-1');

    expect(del).toHaveBeenCalledWith('https://blob.vercel-storage.com/test.pdf');
    expect(prisma.attachment.delete).toHaveBeenCalledWith({
      where: { id: 'att-1' },
    });
  });

  it('should throw if attachment not found', async () => {
    (prisma.attachment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(deleteAttachment(ORG_ID, 'att-999')).rejects.toThrow(
      AttachmentValidationError
    );
    expect(del).not.toHaveBeenCalled();
  });

  it('should scope lookup by organization', async () => {
    (prisma.attachment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(deleteAttachment('other-org', 'att-1')).rejects.toThrow();

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'att-1', organizationId: 'other-org' },
    });
  });
});

describe('countAttachments', () => {
  it('should return counts grouped by entityId', async () => {
    (prisma.attachment.groupBy as jest.Mock).mockResolvedValue([
      { entityId: 'txn-1', _count: { id: 3 } },
      { entityId: 'txn-2', _count: { id: 1 } },
    ]);

    const result = await countAttachments(ORG_ID, ENTITY_TYPE, ['txn-1', 'txn-2', 'txn-3']);

    expect(result).toEqual({ 'txn-1': 3, 'txn-2': 1 });
  });

  it('should return empty object for empty input', async () => {
    const result = await countAttachments(ORG_ID, ENTITY_TYPE, []);
    expect(result).toEqual({});
    expect(prisma.attachment.groupBy).not.toHaveBeenCalled();
  });
});

describe('constants', () => {
  it('should have correct max file size (250 KB)', () => {
    expect(MAX_FILE_SIZE).toBe(256000);
  });

  it('should have correct max attachments per entity', () => {
    expect(MAX_ATTACHMENTS_PER_ENTITY).toBe(10);
  });

  it('should allow PDF, PNG, JPG, and WEBP', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    expect(ALLOWED_MIME_TYPES).toHaveLength(4);
  });
});
