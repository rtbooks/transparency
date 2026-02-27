# ADR-004: Vercel Blob for File Attachments

**Status:** Accepted

**Date:** 2026-02-22

## Context

Users need to attach receipts, invoices, and PDFs to transactions and bills for audit purposes. We needed a file storage solution that:

1. Supports private access (only authenticated org members can view files)
2. Integrates well with our Vercel deployment
3. Handles common document formats (PDF, PNG, JPG, WEBP)
4. Provides reasonable cost at our scale

## Decision

We chose **Vercel Blob** configured as a **private store**.

Key design:
- Files uploaded server-side via `put()` with `access: 'private'`
- Download URLs generated on-demand via `getDownloadUrl()` with short expiry
- `Attachment` model in Prisma links blobs to transactions/bills via `entityType` + `entityId`
- File validation: whitelist of 4 MIME types, 250KB max size, max 10 attachments per entity
- Random suffixes appended to filenames to prevent collisions
- Path structure: `attachments/{orgId}/{entityType}/{entityId}/{filename}`

API routes:
- `POST /api/organizations/[slug]/attachments` — upload
- `GET /api/organizations/[slug]/attachments?entityType=...&entityId=...` — list
- `GET /api/organizations/[slug]/attachments/[id]/download` — get signed download URL
- `DELETE /api/organizations/[slug]/attachments/[id]` — delete blob + DB record

## Consequences

### Positive
- Private access by default — no public URLs for financial documents
- Vercel-native — no separate cloud storage configuration needed
- Signed download URLs prevent unauthorized access
- File size and type restrictions prevent abuse
- Clean separation: blob storage for files, Prisma for metadata

### Negative
- Vercel Blob has storage limits on free/hobby plans
- 250KB limit is restrictive for some scanned documents (may need to increase)
- Private store requires server-side download URL generation (no direct CDN caching)
- Vendor lock-in to Vercel's blob storage API
