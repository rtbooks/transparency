import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { autoMatchStatement } from '@/services/reconciliation.service';

/**
 * POST /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]/auto-match
 * Run auto-matching algorithm on unmatched statement lines.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; statementId: string }> }
) {
  try {
    const { slug, id: bankAccountId, statementId } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const statement = await prisma.bankStatement.findUnique({ where: { id: statementId } });
    if (!statement || statement.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    if (statement.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Statement already reconciled' }, { status: 400 });
    }

    // Update status to IN_PROGRESS if still DRAFT
    if (statement.status === 'DRAFT') {
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    const summary = await autoMatchStatement(statementId, bankAccountId, ctx.orgId);

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error auto-matching:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
