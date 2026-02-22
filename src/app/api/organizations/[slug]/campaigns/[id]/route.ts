import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { updateCampaign, getCampaignById } from '@/services/campaign.service';
import { z } from 'zod';

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  targetAmount: z.number().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
});

/**
 * GET /api/organizations/[slug]/campaigns/[id]
 * Get a single campaign with progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const campaign = await getCampaignById(id);
    if (!campaign || campaign.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...campaign,
      targetAmount: campaign.targetAmount ? Number(campaign.targetAmount) : null,
    });
  } catch (error) {
    console.error('Error getting campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/organizations/[slug]/campaigns/[id]
 * Update a campaign (admin only).
 */
export async function PATCH(
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
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Admin check
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    const isAdmin = user.isPlatformAdmin || (orgUser && orgUser.role === 'ORG_ADMIN');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify campaign belongs to this org
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateCampaignSchema.parse(body);

    const updated = await updateCampaign(id, {
      ...validated,
      startDate: validated.startDate !== undefined
        ? (validated.startDate ? new Date(validated.startDate) : null)
        : undefined,
      endDate: validated.endDate !== undefined
        ? (validated.endDate ? new Date(validated.endDate) : null)
        : undefined,
    });

    return NextResponse.json({
      ...updated,
      targetAmount: updated.targetAmount ? Number(updated.targetAmount) : null,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
