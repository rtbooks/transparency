import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { getReconciliationDetail, deleteReconciliation } from '@/services/account-reconciliation.service';

/**
 * GET /api/organizations/[slug]/reconciliations/[id]
 * Get reconciliation detail with transactions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    const detail = await getReconciliationDetail(id, ctx.orgId);
    return NextResponse.json(detail);
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error?.message === 'Reconciliation not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('Error getting reconciliation detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/reconciliations/[id]
 * Delete an in-progress reconciliation.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    await deleteReconciliation(id, ctx.orgId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error?.message?.includes('completed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
