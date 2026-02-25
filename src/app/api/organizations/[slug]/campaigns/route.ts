import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createCampaign, listCampaigns, getTierSlotsFilled } from '@/services/campaign.service';
import { z } from 'zod';

const createCampaignSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  targetAmount: z.number().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  // Campaign constraint fields
  campaignType: z.enum(['OPEN', 'FIXED_UNIT', 'TIERED']).optional(),
  unitPrice: z.number().positive().nullable().optional(),
  maxUnits: z.number().int().positive().nullable().optional(),
  unitLabel: z.string().nullable().optional(),
  allowMultiUnit: z.boolean().optional(),
  // Tiers for TIERED campaigns
  tiers: z.array(z.object({
    name: z.string().min(1),
    amount: z.number().positive(),
    maxSlots: z.number().int().positive().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
});

/**
 * GET /api/organizations/[slug]/campaigns
 * List campaigns. Public for donors (ACTIVE only), full list for admins.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Determine role for filtering
    let isAdmin = false;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
      if (user) {
        if (user.isPlatformAdmin) {
          isAdmin = true;
        } else {
          const orgUsers = await prisma.organizationUser.findMany({
            where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
          });
          isAdmin = orgUsers[0]?.role === 'ORG_ADMIN';
        }
      }
    }

    const statusFilter = isAdmin ? undefined : 'ACTIVE';
    const campaigns = await listCampaigns(organization.id, { statusFilter });

    // Serialize Decimal fields and enrich tiers
    const serialized = await Promise.all(campaigns.map(async (c) => {
      const campaignTiers = (c as any).tiers || [];
      const enrichedTiers = await Promise.all(
        campaignTiers.map(async (t: any) => ({
          ...t,
          amount: Number(t.amount),
          slotsFilled: await getTierSlotsFilled(t.id),
        }))
      );
      return {
        ...c,
        targetAmount: c.targetAmount ? Number(c.targetAmount) : null,
        unitPrice: c.unitPrice ? Number(c.unitPrice) : null,
        tiers: enrichedTiers,
      };
    }));

    return NextResponse.json({
      campaigns: serialized,
      donationsAccountId: organization.donationsAccountId,
    });
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/campaigns
 * Create a new campaign (admin only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const body = await request.json();
    const validated = createCampaignSchema.parse(body);

    const campaign = await createCampaign({
      organizationId: organization.id,
      accountId: validated.accountId,
      name: validated.name,
      description: validated.description,
      targetAmount: validated.targetAmount,
      startDate: validated.startDate ? new Date(validated.startDate) : null,
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      createdBy: user.id,
      campaignType: validated.campaignType,
      unitPrice: validated.unitPrice,
      maxUnits: validated.maxUnits,
      unitLabel: validated.unitLabel,
      allowMultiUnit: validated.allowMultiUnit,
    });

    // Create tiers for TIERED campaigns
    if (validated.campaignType === 'TIERED' && validated.tiers?.length) {
      for (const [i, tier] of validated.tiers.entries()) {
        await prisma.campaignTier.create({
          data: {
            campaignId: campaign.id,
            name: tier.name,
            amount: tier.amount,
            maxSlots: tier.maxSlots ?? null,
            sortOrder: tier.sortOrder ?? i,
          },
        });
      }
    }

    // Re-fetch with tiers
    const result = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('not found') || error?.message?.includes('must be under')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
