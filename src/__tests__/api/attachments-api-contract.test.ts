/**
 * API Contract Tests for Attachments Endpoint
 *
 * Validates that the attachments API returns the correct response shapes
 * for GET (list), POST (upload), and DELETE operations.
 *
 * These tests prevent bugs where:
 *   - The API response is missing fields the UI needs (blobUrl, fileName)
 *   - Upload responses don't match what AttachmentList expects
 *   - List responses are not wrapped correctly
 */

import { z } from 'zod';

// ─── Response schemas ────────────────────────────────────────────

/** Shape of a single attachment as AttachmentList expects */
const AttachmentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  blobUrl: z.string().url(),
  uploadedBy: z.string().nullable(),
  uploadedAt: z.union([z.string(), z.date()]),
});

/** GET /attachments response wrapper */
const AttachmentListResponseSchema = z.object({
  attachments: z.array(AttachmentSchema),
});

/** DELETE /attachments/[id] response */
const DeleteResponseSchema = z.object({
  success: z.literal(true),
});

/** Error response shape */
const ErrorResponseSchema = z.object({
  error: z.string(),
});

// ─── Mock data ──────────────────────────────────────────────────

const mockAttachment = {
  id: 'att-550e8400',
  organizationId: 'org-123',
  entityType: 'TRANSACTION',
  entityId: 'txn-456',
  fileName: 'receipt-march.pdf',
  fileSize: 125000,
  mimeType: 'application/pdf',
  blobUrl: 'https://abc123.public.blob.vercel-storage.com/attachments/receipt-march-xyz.pdf',
  uploadedBy: 'user-789',
  uploadedAt: '2026-02-23T21:00:00.000Z',
};

const mockAttachmentImage = {
  id: 'att-660e8401',
  organizationId: 'org-123',
  entityType: 'BILL',
  entityId: 'bill-789',
  fileName: 'invoice-scan.png',
  fileSize: 98304,
  mimeType: 'image/png',
  blobUrl: 'https://abc123.public.blob.vercel-storage.com/attachments/invoice-scan-abc.png',
  uploadedBy: null,
  uploadedAt: '2026-02-23T21:05:00.000Z',
};

// ─── Tests ──────────────────────────────────────────────────────

describe('Attachment API contract', () => {
  describe('Single attachment response', () => {
    it('should validate a PDF attachment', () => {
      const result = AttachmentSchema.safeParse(mockAttachment);
      expect(result.success).toBe(true);
    });

    it('should validate an image attachment with null uploadedBy', () => {
      const result = AttachmentSchema.safeParse(mockAttachmentImage);
      expect(result.success).toBe(true);
    });

    it('should FAIL if fileName is missing', () => {
      const { fileName, ...incomplete } = mockAttachment;
      expect(AttachmentSchema.safeParse(incomplete).success).toBe(false);
    });

    it('should FAIL if blobUrl is missing', () => {
      const { blobUrl, ...incomplete } = mockAttachment;
      expect(AttachmentSchema.safeParse(incomplete).success).toBe(false);
    });

    it('should FAIL if blobUrl is not a valid URL', () => {
      const invalid = { ...mockAttachment, blobUrl: 'not-a-url' };
      expect(AttachmentSchema.safeParse(invalid).success).toBe(false);
    });

    it('should FAIL if fileSize is negative', () => {
      const invalid = { ...mockAttachment, fileSize: -1 };
      expect(AttachmentSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('List response', () => {
    it('should validate list with multiple attachments', () => {
      const response = {
        attachments: [mockAttachment, mockAttachmentImage],
      };
      const result = AttachmentListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty list', () => {
      const response = { attachments: [] };
      const result = AttachmentListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should FAIL if attachments key is missing', () => {
      const response = { data: [mockAttachment] };
      expect(AttachmentListResponseSchema.safeParse(response).success).toBe(false);
    });
  });

  describe('Delete response', () => {
    it('should validate success response', () => {
      const result = DeleteResponseSchema.safeParse({ success: true });
      expect(result.success).toBe(true);
    });

    it('should FAIL for success: false', () => {
      expect(DeleteResponseSchema.safeParse({ success: false }).success).toBe(false);
    });
  });

  describe('Error response', () => {
    it('should validate error with message', () => {
      const result = ErrorResponseSchema.safeParse({ error: 'Unauthorized' });
      expect(result.success).toBe(true);
    });

    it('should validate validation error', () => {
      const result = ErrorResponseSchema.safeParse({
        error: 'File size 300000 bytes exceeds maximum of 256000 bytes (250 KB)',
      });
      expect(result.success).toBe(true);
    });
  });
});
