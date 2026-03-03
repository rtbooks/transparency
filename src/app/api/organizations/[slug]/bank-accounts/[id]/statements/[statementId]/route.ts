import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

/**
 * GET /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]
 * Get statement detail with all lines.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; statementId: string }> }
) {
  try {
    const { slug, statementId } = await params;
    const ctx = await withOrgAuth(slug);

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        lines: {
          orderBy: { transactionDate: 'asc' },
          include: { matches: true },
        },
        bankAccount: true,
      },
    });

    if (!statement || statement.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    // Get unreconciled transactions for the side panel
    const bankAccount = statement.bankAccount;
    const periodStart = new Date(statement.periodStart);
    const periodEnd = new Date(statement.periodEnd);
    periodStart.setDate(periodStart.getDate() - 3); // tolerance
    periodEnd.setDate(periodEnd.getDate() + 3);

    const unreconciledTransactions = await prisma.transaction.findMany({
      where: {
        ...buildCurrentVersionWhere({ organizationId: ctx.orgId }),
        reconciled: false,
        transactionDate: { gte: periodStart, lte: periodEnd },
        OR: [
          { debitAccountId: bankAccount.accountId },
          { creditAccountId: bankAccount.accountId },
        ],
      },
      orderBy: { transactionDate: 'asc' },
    });

    return NextResponse.json({
      ...statement,
      unreconciledTransactions,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error fetching statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]
 * Delete a draft statement.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; statementId: string }> }
) {
  try {
    const { slug, statementId } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const statement = await prisma.bankStatement.findUnique({ where: { id: statementId } });
    if (!statement || statement.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    if (statement.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot delete a completed reconciliation' }, { status: 400 });
    }

    // Cascade deletes lines
    await prisma.bankStatement.delete({ where: { id: statementId } });

    return NextResponse.json({ message: 'Statement deleted' });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error deleting statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
