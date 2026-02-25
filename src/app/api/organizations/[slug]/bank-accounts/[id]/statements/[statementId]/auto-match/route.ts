import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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

    const summary = await autoMatchStatement(statementId, bankAccountId, organization.id);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error auto-matching:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
