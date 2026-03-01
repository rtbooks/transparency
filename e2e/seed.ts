/**
 * E2E Test Seed Script
 *
 * Creates test data for Playwright E2E tests. Designed to be run before
 * the E2E test suite to populate the database with a known test organization.
 *
 * Required env var:
 *   E2E_CLERK_USER_ID  - The Clerk user ID of the test account
 *
 * Optional env vars:
 *   DATABASE_URL       - Database connection string (uses .env.local default)
 *
 * Usage:
 *   npx tsx e2e/seed.ts
 */

import { PrismaClient, type AccountType } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load env from .env.local
config({ path: '.env.local' });

const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');
const E2E_ORG_SLUG = 'e2e-test-org';
const E2E_ORG_NAME = 'E2E Test Organization';

async function seed() {
  const clerkUserId = process.env.E2E_CLERK_USER_ID;
  if (!clerkUserId) {
    console.error('E2E_CLERK_USER_ID env var is required. Set it to the Clerk user ID of your test account.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🌱 Seeding E2E test data...');

    // Clean up existing E2E data if present
    const existingOrg = await prisma.organization.findFirst({
      where: { slug: E2E_ORG_SLUG, validTo: MAX_DATE },
    });

    if (existingOrg) {
      console.log('  Cleaning up existing E2E data...');
      await cleanupOrg(prisma, existingOrg.id);
    }

    // Clean up any existing user with this authId
    const existingUser = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    const now = new Date();

    // Create or reuse the user
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      console.log(`  Using existing user: ${existingUser.email} (${userId})`);
    } else {
      const user = await prisma.user.create({
        data: {
          email: `e2e-test@radbooks.org`,
          name: 'E2E Test Admin',
          authId: clerkUserId,
        },
      });
      userId = user.id;
      console.log(`  Created user: ${user.email} (${userId})`);
    }

    // Create organization
    const orgId = randomUUID();
    await prisma.organization.create({
      data: {
        versionId: randomUUID(),
        id: orgId,
        name: E2E_ORG_NAME,
        slug: E2E_ORG_SLUG,
        ein: '12-3456789',
        mission: 'A test organization for E2E testing of RadBooks platform.',
        verificationStatus: 'VERIFIED',
        publicTransparency: true,
        donorAccessMode: 'AUTO_APPROVE',
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId,
      },
    });
    console.log(`  Created organization: ${E2E_ORG_NAME} (${E2E_ORG_SLUG})`);

    // Add user as ORG_ADMIN
    await prisma.organizationUser.create({
      data: {
        versionId: randomUUID(),
        userId,
        organizationId: orgId,
        role: 'ORG_ADMIN',
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId,
      },
    });
    console.log('  Added user as ORG_ADMIN');

    // Create chart of accounts (with pre-calculated balances from seed transactions)
    const accountDefs: Array<{ code: string; name: string; type: AccountType; key: string; balance: number }> = [
      { code: '1010', name: 'Operating Checking', type: 'ASSET', key: 'checking', balance: 3500 },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', key: 'ar', balance: 0 },
      { code: '1300', name: 'Stripe Clearing', type: 'ASSET', key: 'clearing', balance: 0 },
      { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', key: 'ap', balance: 0 },
      { code: '3010', name: 'Fund Balance', type: 'EQUITY', key: 'equity', balance: 0 },
      { code: '4010', name: 'Donation Revenue', type: 'REVENUE', key: 'revenue', balance: 6000 },
      { code: '4020', name: 'Program Revenue', type: 'REVENUE', key: 'programRevenue', balance: 0 },
      { code: '5010', name: 'Program Expenses', type: 'EXPENSE', key: 'expense', balance: 2000 },
      { code: '5020', name: 'Administrative Expenses', type: 'EXPENSE', key: 'adminExpense', balance: 500 },
    ];

    const accounts: Record<string, string> = {};
    for (const def of accountDefs) {
      const acct = await prisma.account.create({
        data: {
          organizationId: orgId,
          code: def.code,
          name: def.name,
          type: def.type,
          currentBalance: def.balance,
          versionId: randomUUID(),
          validFrom: now,
          validTo: MAX_DATE,
          systemFrom: now,
          systemTo: MAX_DATE,
          changedBy: userId,
        },
      });
      accounts[def.key] = acct.id;
    }
    console.log(`  Created ${accountDefs.length} accounts`);

    // Update org with donations and fund balance accounts
    // Use bitemporal close+create pattern
    const currentOrg = await prisma.organization.findFirst({
      where: { id: orgId, validTo: MAX_DATE },
    });
    if (currentOrg) {
      const closeTime = new Date(now.getTime() + 1);
      await prisma.organization.update({
        where: { versionId: currentOrg.versionId },
        data: { validTo: closeTime, systemTo: closeTime },
      });
      await prisma.organization.create({
        data: {
          ...currentOrg,
          versionId: randomUUID(),
          previousVersionId: currentOrg.versionId,
          donationsAccountId: accounts.ar,
          fundBalanceAccountId: accounts.equity,
          validFrom: closeTime,
          validTo: MAX_DATE,
          systemFrom: closeTime,
          systemTo: MAX_DATE,
        },
      });
    }

    // Create contacts
    const donor = await prisma.contact.create({
      data: {
        name: 'Jane Donor',
        email: 'jane@example.com',
        type: 'INDIVIDUAL',
        roles: ['DONOR'],
        organizationId: orgId,
        versionId: randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId,
      },
    });

    const vendor = await prisma.contact.create({
      data: {
        name: 'Office Supply Co',
        email: 'billing@officesupply.com',
        type: 'ORGANIZATION',
        roles: ['VENDOR'],
        organizationId: orgId,
        versionId: randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId,
      },
    });
    console.log('  Created 2 contacts');

    // Create sample transactions
    const txDate = new Date('2025-01-15');
    const transactions = [
      {
        type: 'INCOME' as const,
        amount: 5000,
        description: 'Annual Gala Donation',
        debitAccountId: accounts.checking,
        creditAccountId: accounts.revenue,
        contactId: donor.id,
      },
      {
        type: 'INCOME' as const,
        amount: 1000,
        description: 'Monthly Supporter Donation',
        debitAccountId: accounts.checking,
        creditAccountId: accounts.revenue,
        contactId: donor.id,
      },
      {
        type: 'EXPENSE' as const,
        amount: 500,
        description: 'Office Supplies',
        debitAccountId: accounts.adminExpense,
        creditAccountId: accounts.checking,
        contactId: vendor.id,
      },
      {
        type: 'EXPENSE' as const,
        amount: 2000,
        description: 'Youth Program Equipment',
        debitAccountId: accounts.expense,
        creditAccountId: accounts.checking,
        contactId: vendor.id,
      },
    ];

    for (const tx of transactions) {
      await prisma.transaction.create({
        data: {
          organizationId: orgId,
          transactionDate: txDate,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          debitAccountId: tx.debitAccountId,
          creditAccountId: tx.creditAccountId,
          contactId: tx.contactId,
          paymentMethod: 'CHECK',
          versionId: randomUUID(),
          validFrom: now,
          validTo: MAX_DATE,
          systemFrom: now,
          systemTo: MAX_DATE,
          changedBy: userId,
        },
      });
    }

    console.log(`  Created ${transactions.length} transactions`);

    // Create a campaign
    await prisma.campaign.create({
      data: {
        organizationId: orgId,
        accountId: accounts.revenue,
        name: 'Spring Fundraiser',
        description: 'Annual spring fundraising campaign for youth programs.',
        targetAmount: 10000,
        status: 'ACTIVE',
        campaignType: 'OPEN',
        startDate: new Date('2025-01-01'),
        createdBy: userId,
      },
    });
    console.log('  Created 1 campaign');

    // Create program spending
    await prisma.programSpending.create({
      data: {
        versionId: randomUUID(),
        organizationId: orgId,
        title: 'Basketball Equipment',
        description: 'New basketballs and training equipment for the youth program.',
        estimatedAmount: 1500,
        status: 'PURCHASED',
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId,
        createdBy: userId,
      },
    });
    console.log('  Created 1 program spending item');

    // Create fiscal period
    await prisma.fiscalPeriod.create({
      data: {
        organizationId: orgId,
        name: 'FY 2025',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'OPEN',
      },
    });
    console.log('  Created 1 fiscal period');

    console.log('✅ E2E seed data created successfully!');
    console.log(`   Org slug: ${E2E_ORG_SLUG}`);
    console.log(`   Accounts: ${Object.keys(accounts).length}`);
    console.log(`   Use E2E_ORG_SLUG=${E2E_ORG_SLUG} in your E2E tests`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function cleanupOrg(prisma: PrismaClient, orgId: string) {
  try {
    await prisma.programSpending.deleteMany({ where: { organizationId: orgId } });
    await prisma.campaign.deleteMany({ where: { organizationId: orgId } });
    await prisma.donation.deleteMany({ where: { organizationId: orgId } });
    await prisma.bill.deleteMany({ where: { organizationId: orgId } });
    await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
    await prisma.transaction.deleteMany({ where: { organizationId: orgId } });
    await prisma.account.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationUser.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  } catch {
    // Best-effort cleanup
  }
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
