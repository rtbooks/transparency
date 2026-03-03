import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { completeReconciliation } from '@/services/reconciliation.service';

/**
 * POST /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]/complete
 * Finalize reconciliation: mark all matched transactions as reconciled.
 */
export async function POST(
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

    const result = await completeReconciliation(statementId, ctx.userId);

    return NextResponse.json({
      message: 'Reconciliation completed',
      ...result,
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error completing reconciliation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('already') ? 400 : 500 }
    );
  }
}
