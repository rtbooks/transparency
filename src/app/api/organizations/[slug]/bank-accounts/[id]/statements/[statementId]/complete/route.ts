import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const statement = await prisma.bankStatement.findUnique({ where: { id: statementId } });
    if (!statement || statement.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    const result = await completeReconciliation(statementId, user.id);

    return NextResponse.json({
      message: 'Reconciliation completed',
      ...result,
    });
  } catch (error: any) {
    console.error('Error completing reconciliation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('already') ? 400 : 500 }
    );
  }
}
