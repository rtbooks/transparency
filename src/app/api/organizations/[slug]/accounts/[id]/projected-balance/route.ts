import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getProjectedBalance, checkOverdraftRisk } from '@/services/projected-balance.service';

/**
 * GET /api/organizations/[slug]/accounts/[id]/projected-balance
 * Returns current balance, pending payables, projected balance, and overdraft status.
 * Query params: ?additionalAmount=500 to check impact of a new bill.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const additionalAmount = parseFloat(
      request.nextUrl.searchParams.get('additionalAmount') || '0'
    );

    if (additionalAmount > 0) {
      const result = await checkOverdraftRisk(organization.id, id, additionalAmount);
      return NextResponse.json(result);
    }

    const result = await getProjectedBalance(organization.id, id);
    if (!result) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting projected balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
