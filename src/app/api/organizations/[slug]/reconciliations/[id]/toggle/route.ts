import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const validated = toggleSchema.parse(body);

    const result = await toggleReconciliationItem(id, validated.transactionId, organization.id);
    return NextResponse.json(result);
  } catch (error: any) {
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
