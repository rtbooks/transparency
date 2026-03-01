import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkOrganizationAccess } from '@/lib/organization-access';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import { closeVersion } from '@/lib/temporal/temporal-utils';

/**
 * POST - Recalculate all account balances from transaction history.
 * Admin-only. Detects and optionally fixes discrepancies between
 * stored current_balance and the balance computed from transactions.
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

    const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

    if (!userAccess || (userAccess.role !== 'ORG_ADMIN' && !user.isPlatformAdmin)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default to dry run

    // Get all current accounts
    const accounts = await prisma.account.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id }),
      orderBy: { code: 'asc' },
    });

    // Get all current non-voided transactions
    const transactions = await prisma.transaction.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, isVoided: false }),
      select: { debitAccountId: true, creditAccountId: true, amount: true },
    });

    // Compute expected balances from transactions
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      debitTotals.set(tx.debitAccountId, (debitTotals.get(tx.debitAccountId) || 0) + amount);
      creditTotals.set(tx.creditAccountId, (creditTotals.get(tx.creditAccountId) || 0) + amount);
    }

    const discrepancies: Array<{
      accountId: string;
      code: string;
      name: string;
      type: string;
      storedBalance: number;
      expectedBalance: number;
      difference: number;
    }> = [];

    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) || 0;
      const totalCredits = creditTotals.get(account.id) || 0;

      let expectedBalance: number;
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        expectedBalance = totalDebits - totalCredits;
      } else {
        expectedBalance = totalCredits - totalDebits;
      }

      const storedBalance = Number(account.currentBalance);
      const difference = Math.abs(storedBalance - expectedBalance);

      if (difference > 0.005) {
        discrepancies.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          storedBalance,
          expectedBalance,
          difference: storedBalance - expectedBalance,
        });
      }
    }

    if (!dryRun && discrepancies.length > 0) {
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        for (const d of discrepancies) {
          const account = accounts.find(a => a.id === d.accountId)!;

          // Close current version
          await closeVersion(tx.account, account.versionId, now, 'Account');

          // Create new version with corrected balance
          const { versionId: _vId, ...rest } = account;
          await tx.account.create({
            data: {
              ...rest,
              currentBalance: d.expectedBalance,
              versionId: crypto.randomUUID(),
              previousVersionId: account.versionId,
              validFrom: now,
              validTo: MAX_DATE,
              systemFrom: now,
              systemTo: MAX_DATE,
              changedBy: user.id,
            },
          });
        }
      });
    }

    return NextResponse.json({
      totalAccounts: accounts.length,
      discrepanciesFound: discrepancies.length,
      discrepancies,
      applied: !dryRun && discrepancies.length > 0,
      dryRun,
    });
  } catch (error) {
    console.error('Error recalculating balances:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
