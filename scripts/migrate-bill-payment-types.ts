/**
 * One-time migration script: Reclassify bill payment transactions as TRANSFER
 *
 * Bill payment transactions (linked via bill_payments table) move money between
 * balance sheet accounts (Cash ↔ AP/AR) and should be typed TRANSFER, not
 * INCOME/EXPENSE. The accrual transaction already records the income/expense.
 *
 * This script finds all transactions linked to bill_payments that are currently
 * typed INCOME or EXPENSE and updates them to TRANSFER.
 *
 * Usage:
 *   npx tsx scripts/migrate-bill-payment-types.ts
 *
 * Add --dry-run to preview without making changes:
 *   npx tsx scripts/migrate-bill-payment-types.ts --dry-run
 */

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '@/generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Migrating bill payment transaction types to TRANSFER${dryRun ? ' (DRY RUN)' : ''}...`);

  // Find all bill payment links
  const billPayments = await prisma.billPayment.findMany({
    select: { transactionId: true },
  });

  const paymentTransactionIds = [...new Set(billPayments.map(bp => bp.transactionId))];
  console.log(`Found ${paymentTransactionIds.length} unique payment transaction IDs`);

  if (paymentTransactionIds.length === 0) {
    console.log('No bill payment transactions found. Nothing to migrate.');
    return;
  }

  // Find current versions of these transactions that are INCOME or EXPENSE
  const toUpdate = await prisma.transaction.findMany({
    where: {
      id: { in: paymentTransactionIds },
      type: { in: ['INCOME', 'EXPENSE'] as any[] },
      isDeleted: false,
    },
    select: {
      versionId: true,
      id: true,
      type: true,
      description: true,
      amount: true,
    },
  });

  console.log(`Found ${toUpdate.length} transaction versions to reclassify:`);
  for (const tx of toUpdate) {
    console.log(`  ${tx.versionId} (id=${tx.id}) ${tx.type} → TRANSFER  "${tx.description}" $${tx.amount}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. No changes made.');
    return;
  }

  // Update in batches
  let updated = 0;
  for (const tx of toUpdate) {
    await prisma.transaction.update({
      where: { versionId: tx.versionId },
      data: { type: 'TRANSFER' as any },
    });
    updated++;
  }

  console.log(`\nDone. Updated ${updated} transaction versions to TRANSFER.`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
