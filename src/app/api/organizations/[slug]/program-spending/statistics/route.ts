import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getSpendingStatistics } from '@/services/program-spending.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const stats = await getSpendingStatistics(organization.id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting spending statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
