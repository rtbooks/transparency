import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const detail = await getReconciliationDetail(id, organization.id);
    return NextResponse.json(detail);
  } catch (error: any) {
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    await deleteReconciliation(id, organization.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message?.includes('completed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
