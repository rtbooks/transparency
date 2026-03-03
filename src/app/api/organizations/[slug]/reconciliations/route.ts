import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { startReconciliation, listReconciliations, getLastEndingBalance } from '@/services/account-reconciliation.service';
import { z } from 'zod';

const createSchema = z.object({
  accountId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  beginningBalance: z.number(),
  endingBalance: z.number(),
});

/**
 * GET /api/organizations/[slug]/reconciliations
 * List reconciliations, optionally filtered by accountId.
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

    const accountId = request.nextUrl.searchParams.get('accountId') || undefined;
    const reconciliations = await listReconciliations(organization.id, accountId);

    return NextResponse.json(reconciliations);
  } catch (error) {
    console.error('Error listing reconciliations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/reconciliations
 * Start a new reconciliation.
 */
export async function POST(
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

    const body = await request.json();
    const validated = createSchema.parse(body);

    const safeDateParse = (s: string) => new Date(s.length === 10 ? s + 'T12:00:00' : s);

    // Use start-of-day for period start, end-of-day for period end
    const periodStartDate = safeDateParse(validated.periodStart);
    periodStartDate.setUTCHours(0, 0, 0, 0);
    const periodEndDate = safeDateParse(validated.periodEnd);
    periodEndDate.setUTCHours(23, 59, 59, 999);

    const reconciliation = await startReconciliation({
      organizationId: organization.id,
      accountId: validated.accountId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      beginningBalance: validated.beginningBalance,
      endingBalance: validated.endingBalance,
      createdBy: user.id,
    });

    return NextResponse.json(reconciliation, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error starting reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
