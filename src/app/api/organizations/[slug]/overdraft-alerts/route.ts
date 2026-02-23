import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getOverdraftAlerts } from '@/services/projected-balance.service';

/**
 * GET /api/organizations/[slug]/overdraft-alerts
 * Returns accounts at risk of overdraft from pending payable bills.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const alerts = await getOverdraftAlerts(organization.id);

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Error getting overdraft alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
