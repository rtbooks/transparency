import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { completeReconciliation } from '@/services/account-reconciliation.service';

/**
 * POST /api/organizations/[slug]/reconciliations/[id]/complete
 * Complete a reconciliation — marks cleared transactions as reconciled.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const result = await completeReconciliation(id, ctx.orgId, ctx.userId);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error?.message?.includes('Cannot complete') || error?.message?.includes('already completed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error completing reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
