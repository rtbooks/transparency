import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getLastEndingBalance } from '@/services/account-reconciliation.service';

/**
 * GET /api/organizations/[slug]/reconciliations/last-balance?accountId=...
 * Get the last completed reconciliation's ending balance for an account.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const accountId = request.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

    const lastBalance = await getLastEndingBalance(organization.id, accountId);
    return NextResponse.json({ lastEndingBalance: lastBalance });
  } catch (error) {
    console.error('Error getting last balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
