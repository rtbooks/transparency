import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const tierSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  maxSlots: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/organizations/[slug]/campaigns/[id]/tiers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { id } = await params;
    const tiers = await prisma.campaignTier.findMany({
      where: { campaignId: id },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(tiers.map(t => ({ ...t, amount: Number(t.amount) })));
  } catch (error) {
    console.error('Error listing tiers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/campaigns/[id]/tiers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = tierSchema.parse(body);

    const tier = await prisma.campaignTier.create({
      data: {
        campaignId: id,
        name: validated.name,
        amount: validated.amount,
        maxSlots: validated.maxSlots ?? null,
        sortOrder: validated.sortOrder ?? 0,
      },
    });

    return NextResponse.json({ ...tier, amount: Number(tier.amount) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating tier:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
