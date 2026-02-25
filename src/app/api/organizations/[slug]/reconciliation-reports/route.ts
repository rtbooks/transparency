import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

/**
 * GET /api/organizations/[slug]/reconciliation-reports
 * Returns reconciliation summary data:
 * - unreconciledTransactions: transactions not yet matched to any statement
 * - reconciliationHistory: completed reconciliations per bank account
 * - bankAccountSummaries: per-account stats (total txns, reconciled, unreconciled)
 *
 * Query params:
 *   ?bankAccountId=<id>   - filter to specific bank account
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

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bankAccountIdFilter = request.nextUrl.searchParams.get('bankAccountId');

    // Get bank accounts for this org
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: organization.id, isActive: true },
    });
    const bankAccountIds = bankAccountIdFilter
      ? [bankAccountIdFilter]
      : bankAccounts.map((ba) => ba.id);
    const accountIds = bankAccounts.map((ba) => ba.accountId);

    // Get account names
    const accounts = await prisma.account.findMany({
      where: buildCurrentVersionWhere({ id: { in: accountIds } }),
      select: { id: true, name: true, code: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Get all transactions for these accounts (current versions only)
    const transactions = await prisma.transaction.findMany({
      where: {
        ...buildCurrentVersionWhere({ organizationId: organization.id }),
        OR: [
          { debitAccountId: { in: accountIds } },
          { creditAccountId: { in: accountIds } },
        ],
      },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amount: true,
        referenceNumber: true,
        type: true,
        reconciled: true,
        reconciledAt: true,
        debitAccountId: true,
        creditAccountId: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    const unreconciledTransactions = transactions.filter((t) => !t.reconciled);
    const reconciledTransactions = transactions.filter((t) => t.reconciled);

    // Reconciliation history — completed statements
    const completedStatements = await prisma.bankStatement.findMany({
      where: {
        organizationId: organization.id,
        bankAccountId: { in: bankAccountIds },
        status: 'COMPLETED',
      },
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { reconciledAt: 'desc' },
    });

    // Build per-bank-account summaries
    const bankAccountSummaries = bankAccounts
      .filter((ba) => bankAccountIds.includes(ba.id))
      .map((ba) => {
        const acct = accountMap.get(ba.accountId);
        const acctTxns = transactions.filter(
          (t) => t.debitAccountId === ba.accountId || t.creditAccountId === ba.accountId
        );
        const reconciled = acctTxns.filter((t) => t.reconciled).length;
        const unreconciled = acctTxns.filter((t) => !t.reconciled).length;
        const stmts = completedStatements.filter((s) => s.bankAccountId === ba.id);
        const lastReconciled = stmts.length > 0 ? stmts[0].reconciledAt : null;

        return {
          bankAccountId: ba.id,
          bankName: ba.bankName,
          accountNumberLast4: ba.accountNumberLast4,
          accountName: acct?.name || 'Unknown',
          accountCode: acct?.code || '',
          totalTransactions: acctTxns.length,
          reconciled,
          unreconciled,
          completedReconciliations: stmts.length,
          lastReconciledAt: lastReconciled,
        };
      });

    return NextResponse.json({
      bankAccountSummaries,
      unreconciledTransactions: unreconciledTransactions.slice(0, 100).map((t) => ({
        id: t.id,
        transactionDate: t.transactionDate,
        description: t.description,
        amount: t.amount,
        referenceNumber: t.referenceNumber,
        type: t.type,
        debitAccountId: t.debitAccountId,
        creditAccountId: t.creditAccountId,
      })),
      unreconciledCount: unreconciledTransactions.length,
      reconciledCount: reconciledTransactions.length,
      reconciliationHistory: completedStatements.map((s) => ({
        id: s.id,
        bankAccountId: s.bankAccountId,
        statementDate: s.statementDate,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        openingBalance: s.openingBalance,
        closingBalance: s.closingBalance,
        fileName: s.fileName,
        reconciledAt: s.reconciledAt,
        lineCount: s._count.lines,
      })),
    });
  } catch (error) {
    console.error('Error fetching reconciliation reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
