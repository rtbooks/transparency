import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { findProgramSpendingById, unlinkTransaction } from '@/services/program-spending.service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; txId: string }> }
) {
  try {
    const { slug, id, txId } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await unlinkTransaction(id, txId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error unlinking transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
