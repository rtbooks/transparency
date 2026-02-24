import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';
import {
  recalculateAccountBalance,
  verifyAccountBalance,
  verifyDoubleEntryIntegrity,
} from '@/lib/accounting/balance-verification';

/**
 * Verify all account balances for an organization
 * Returns list of accounts with balance discrepancies
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Find organization and check access
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all accounts and transactions
    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id }),
        orderBy: { code: 'asc' },
      }),
      prisma.transaction.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id }),
        orderBy: { transactionDate: 'asc' },
      }),
    ]);

    // Verify double-entry integrity
    const integrityCheck = verifyDoubleEntryIntegrity(transactions);

    // Verify each account's balance
    const accountVerifications = accounts.map((account) => {
      const accountTransactions = transactions.filter(
        (t) =>
          t.debitAccountId === account.id || t.creditAccountId === account.id
      );

      const calculatedBalance = recalculateAccountBalance(
        accountTransactions,
        account.id,
        account.type,
        0 // Initial balance is 0 for all accounts
      );

      const verification = verifyAccountBalance(
        account.currentBalance,
        calculatedBalance
      );

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        storedBalance: Number(account.currentBalance),
        calculatedBalance,
        isCorrect: verification.isCorrect,
        difference: verification.difference,
        transactionCount: accountTransactions.length,
      };
    });

    // Find accounts with discrepancies
    const discrepancies = accountVerifications.filter((v) => !v.isCorrect);

    return NextResponse.json({
      integrityCheck,
      totalAccounts: accounts.length,
      accountsWithDiscrepancies: discrepancies.length,
      discrepancies,
      allAccountBalances: accountVerifications,
    });
  } catch (error) {
    console.error('Error verifying balances:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Fix account balances by recalculating from transactions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Find organization and check access (must be ORG_ADMIN or PLATFORM_ADMIN)
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role !== 'ORG_ADMIN') {
      return NextResponse.json(
        { error: 'Only organization admins can fix balances' },
        { status: 403 }
      );
    }

    // Get all accounts and transactions
    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id }),
      }),
      prisma.transaction.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id }),
        orderBy: { transactionDate: 'asc' },
      }),
    ]);

    // Recalculate and update each account's balance
    const updates = await Promise.all(
      accounts.map(async (account) => {
        const accountTransactions = transactions.filter(
          (t) =>
            t.debitAccountId === account.id || t.creditAccountId === account.id
        );

        const calculatedBalance = recalculateAccountBalance(
          accountTransactions,
          account.id,
          account.type,
          0
        );

        const oldBalance = Number(account.currentBalance);
        const balanceChanged = Math.abs(oldBalance - calculatedBalance) >= 0.01;

        if (balanceChanged) {
          const now = new Date();
          await closeVersion(prisma.account, account.versionId, now, 'account');
          await prisma.account.create({
            data: buildNewVersionData(account, { currentBalance: calculatedBalance } as any, now) as any,
          });
        }

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          oldBalance,
          newBalance: calculatedBalance,
          balanceChanged,
        };
      })
    );

    const accountsFixed = updates.filter((u) => u.balanceChanged).length;

    return NextResponse.json({
      success: true,
      totalAccounts: accounts.length,
      accountsFixed,
      updates,
    });
  } catch (error) {
    console.error('Error fixing balances:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
