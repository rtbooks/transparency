/**
 * Database Test Helper
 *
 * Provides utilities for integration tests that run against a real Postgres database.
 * Creates isolated test organizations with a standard chart of accounts.
 *
 * Usage:
 *   const helper = new DbTestHelper();
 *   beforeAll(() => helper.setup());
 *   afterAll(() => helper.teardown());
 */

import { PrismaClient, AccountType } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');

/** Standard chart of accounts created for each test org */
export interface TestAccounts {
  checking: string;   // ASSET - Operating Checking
  ar: string;         // ASSET - Accounts Receivable
  ap: string;         // LIABILITY - Accounts Payable
  revenue: string;    // REVENUE - Donation Revenue
  expense: string;    // EXPENSE - General Expense
  equity: string;     // EQUITY - Fund Balance
  clearing: string;   // ASSET - Stripe Clearing
}

export class DbTestHelper {
  prisma!: PrismaClient;
  orgId!: string;
  orgSlug!: string;
  userId!: string;
  contactId!: string;
  accounts!: TestAccounts;

  async setup() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    this.prisma = new PrismaClient({ adapter });

    const suffix = crypto.randomUUID().slice(0, 8);
    this.orgSlug = `test-org-${suffix}`;

    // Create test user
    const user = await this.prisma.user.create({
      data: {
        email: `test-${suffix}@integration.test`,
        name: 'Integration Test User',
        authId: `test-auth-${suffix}`,
      },
    });
    this.userId = user.id;

    // Create test organization
    const now = new Date();
    const org = await this.prisma.organization.create({
      data: {
        name: `Test Org ${suffix}`,
        slug: this.orgSlug,
        verificationStatus: 'VERIFIED',
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: user.id,
      },
    });
    this.orgId = org.id;

    // Create contact for bills/donations
    const contact = await this.prisma.contact.create({
      data: {
        name: 'Test Contact',
        type: 'INDIVIDUAL',
        roles: ['DONOR'],
        organizationId: this.orgId,
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: user.id,
      },
    });
    this.contactId = contact.id;

    // Create standard chart of accounts
    const accountDefs: Array<{ code: string; name: string; type: AccountType; key: keyof TestAccounts }> = [
      { code: '1010', name: 'Test Checking', type: 'ASSET', key: 'checking' },
      { code: '1200', name: 'Test AR', type: 'ASSET', key: 'ar' },
      { code: '1300', name: 'Test Clearing', type: 'ASSET', key: 'clearing' },
      { code: '2010', name: 'Test AP', type: 'LIABILITY', key: 'ap' },
      { code: '3010', name: 'Test Fund Balance', type: 'EQUITY', key: 'equity' },
      { code: '4010', name: 'Test Revenue', type: 'REVENUE', key: 'revenue' },
      { code: '5010', name: 'Test Expense', type: 'EXPENSE', key: 'expense' },
    ];

    const accounts = {} as TestAccounts;
    for (const def of accountDefs) {
      const acct = await this.prisma.account.create({
        data: {
          organizationId: this.orgId,
          code: def.code,
          name: def.name,
          type: def.type,
          currentBalance: 0,
          versionId: crypto.randomUUID(),
          validFrom: now,
          validTo: MAX_DATE,
          systemFrom: now,
          systemTo: MAX_DATE,
          changedBy: user.id,
        },
      });
      accounts[def.key] = acct.id;
    }
    this.accounts = accounts;
  }

  async teardown() {
    if (!this.prisma) return;

    try {
      // Delete in dependency order — BillPayment cascades from Bill via onDelete: Cascade
      await this.prisma.donation.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.bill.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.fiscalPeriod.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.transaction.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.account.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.contact.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.organizationUser.deleteMany({ where: { organizationId: this.orgId } });
      await this.prisma.organization.deleteMany({ where: { id: this.orgId } });
      await this.prisma.user.delete({ where: { id: this.userId } });
    } catch {
      // Best-effort cleanup
    }

    await this.prisma.$disconnect();

    // Also disconnect the singleton prisma used by services
    const { prisma: servicePrisma } = await import('@/lib/prisma');
    await servicePrisma.$disconnect();
  }

  /** Get current balance for an account from the database */
  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, validTo: MAX_DATE, isDeleted: false },
      select: { currentBalance: true },
    });
    if (!account) throw new Error(`Account ${accountId} not found`);
    return Number(account.currentBalance);
  }

  /** Assert that an account has the expected balance (within rounding tolerance) */
  async assertBalance(accountId: string, expected: number, label?: string) {
    const actual = await this.getAccountBalance(accountId);
    const msg = label ? `${label}: ` : '';
    expect(actual).toBeCloseTo(expected, 2);
    if (Math.abs(actual - expected) > 0.005) {
      throw new Error(`${msg}Expected balance ${expected}, got ${actual}`);
    }
  }

  /** Assert all accounts are at zero balance */
  async assertAllZero() {
    for (const [key, id] of Object.entries(this.accounts)) {
      await this.assertBalance(id, 0, key);
    }
  }

  /** Link the org's fundBalanceAccountId so fiscal close tests work.
   *  Uses bitemporal close+create pattern since org table has immutability triggers. */
  async setFundBalanceAccount(accountId: string) {
    const { closeVersion } = await import('@/lib/temporal/temporal-utils');
    const now = new Date();

    // Find the current org version
    const current = await this.prisma.organization.findFirst({
      where: { id: this.orgId, validTo: MAX_DATE },
    });
    if (!current) throw new Error('Org not found');

    // Close current version
    await closeVersion(this.prisma.organization, current.versionId, now, 'organization');

    // Create new version with fundBalanceAccountId set
    await this.prisma.organization.create({
      data: {
        id: current.id,
        name: current.name,
        slug: current.slug,
        verificationStatus: current.verificationStatus,
        fundBalanceAccountId: accountId,
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: this.userId,
      },
    });
  }

  /** Deactivate an account (for error path testing) — uses bitemporal close+create */
  async deactivateAccount(accountId: string) {
    const { closeVersion } = await import('@/lib/temporal/temporal-utils');
    const now = new Date();
    const current = await this.prisma.account.findFirst({
      where: { id: accountId, validTo: MAX_DATE },
    });
    if (!current) throw new Error(`Account ${accountId} not found`);
    await closeVersion(this.prisma.account, current.versionId, now, 'account');
    await this.prisma.account.create({
      data: {
        id: current.id,
        organizationId: current.organizationId,
        code: current.code,
        name: current.name,
        type: current.type,
        currentBalance: current.currentBalance,
        isActive: false,
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: this.userId,
      },
    });
  }

  /** Re-activate an account */
  async activateAccount(accountId: string) {
    const { closeVersion } = await import('@/lib/temporal/temporal-utils');
    const now = new Date();
    const current = await this.prisma.account.findFirst({
      where: { id: accountId, validTo: MAX_DATE },
    });
    if (!current) throw new Error(`Account ${accountId} not found`);
    await closeVersion(this.prisma.account, current.versionId, now, 'account');
    await this.prisma.account.create({
      data: {
        id: current.id,
        organizationId: current.organizationId,
        code: current.code,
        name: current.name,
        type: current.type,
        currentBalance: current.currentBalance,
        isActive: true,
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: this.userId,
      },
    });
  }
}
