import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { toggleReconciliationItem } from '@/services/account-reconciliation.service';
import { z } from 'zod';

const toggleSchema = z.object({
  transactionId: z.string(),
});

/**
 * POST /api/organizations/[slug]/reconciliations/[id]/toggle
 * Toggle a transaction's cleared status in a reconciliation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const validated = toggleSchema.parse(body);

    const result = await toggleReconciliationItem(id, validated.transactionId, ctx.orgId);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('not found') || error?.message?.includes('completed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error toggling reconciliation item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
