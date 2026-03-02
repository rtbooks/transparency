import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const result = await completeReconciliation(id, organization.id, user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message?.includes('Cannot complete') || error?.message?.includes('already completed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error completing reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
