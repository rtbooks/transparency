/**
 * One-time migration script: receiptUrl → Attachment model
 *
 * Reads all Transaction versions with a non-null receiptUrl and creates
 * corresponding Attachment rows. Run this ONCE after deploying the
 * attachments migration, then drop the receiptUrl column in a follow-up migration.
 *
 * Usage:
 *   npx tsx scripts/migrate-receipt-urls.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '@/generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting receiptUrl → Attachment migration...');

  // Find distinct (id, receiptUrl) pairs from current transaction versions
  const transactions = await prisma.transaction.findMany({
    where: {
      receiptUrl: { not: null },
      isDeleted: false,
    },
    select: {
      id: true,
      organizationId: true,
      receiptUrl: true,
    },
    distinct: ['id'],
  });

  console.log(`Found ${transactions.length} transactions with receiptUrl`);

  let created = 0;
  let skipped = 0;

  for (const txn of transactions) {
    if (!txn.receiptUrl) continue;

    // Check if an attachment already exists for this URL (idempotent)
    const existing = await prisma.attachment.findFirst({
      where: {
        organizationId: txn.organizationId,
        entityType: 'TRANSACTION',
        entityId: txn.id,
        blobUrl: txn.receiptUrl,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Infer file metadata from URL
    const fileName = txn.receiptUrl.split('/').pop() || 'receipt';
    const mimeType = inferMimeType(fileName);

    await prisma.attachment.create({
      data: {
        organizationId: txn.organizationId,
        entityType: 'TRANSACTION',
        entityId: txn.id,
        fileName,
        fileSize: 0, // Unknown for legacy URLs
        mimeType,
        blobUrl: txn.receiptUrl,
      },
    });

    created++;
  }

  console.log(`Migration complete: ${created} created, ${skipped} skipped (already migrated)`);
}

function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
