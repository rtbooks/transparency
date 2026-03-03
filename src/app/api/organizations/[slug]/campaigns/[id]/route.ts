import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { updateCampaign, getCampaignById, getTierSlotsFilled } from '@/services/campaign.service';
import { z } from 'zod';

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  targetAmount: z.number().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  unitPrice: z.number().positive().nullable().optional(),
  maxUnits: z.number().int().positive().nullable().optional(),
  unitLabel: z.string().nullable().optional(),
  allowMultiUnit: z.boolean().optional(),
  tiers: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    amount: z.number().positive(),
    maxSlots: z.number().int().positive().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    price: z.number().positive(),
    maxQuantity: z.number().int().positive().nullable().optional(),
    minPerOrder: z.number().int().min(0).optional(),
    maxPerOrder: z.number().int().positive().nullable().optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
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

    const campaignTiers = (campaign as any).tiers || [];
    const campaignItems = (campaign as any).items || [];
    const enrichedTiers = await Promise.all(
      campaignTiers.map(async (t: any) => ({
        ...t,
        amount: Number(t.amount),
        slotsFilled: await getTierSlotsFilled(t.id),
      }))
    );

    return NextResponse.json({
      ...campaign,
      targetAmount: campaign.targetAmount ? Number(campaign.targetAmount) : null,
      unitPrice: campaign.unitPrice ? Number(campaign.unitPrice) : null,
      tiers: enrichedTiers,
      items: campaignItems.map((i: any) => ({ ...i, price: Number(i.price) })),
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

    const { tiers, items, ...campaignFields } = validated;

    const updated = await updateCampaign(id, {
      ...campaignFields,
      startDate: campaignFields.startDate !== undefined
        ? (campaignFields.startDate ? new Date(campaignFields.startDate) : null)
        : undefined,
      endDate: campaignFields.endDate !== undefined
        ? (campaignFields.endDate ? new Date(campaignFields.endDate) : null)
        : undefined,
    });

    // Sync TIERED tiers: upsert provided, deactivate removed
    if (tiers !== undefined && existing.campaignType === 'TIERED') {
      const existingTiers = await prisma.campaignTier.findMany({ where: { campaignId: id } });
      const existingIds = new Set(existingTiers.map(t => t.id));
      const incomingIds = new Set(tiers.filter(t => t.id).map(t => t.id!));

      for (const [i, tier] of tiers.entries()) {
        if (tier.id && existingIds.has(tier.id)) {
          await prisma.campaignTier.update({
            where: { id: tier.id },
            data: { name: tier.name, amount: tier.amount, maxSlots: tier.maxSlots ?? null, sortOrder: tier.sortOrder ?? i },
          });
        } else {
          await prisma.campaignTier.create({
            data: { campaignId: id, name: tier.name, amount: tier.amount, maxSlots: tier.maxSlots ?? null, sortOrder: tier.sortOrder ?? i },
          });
        }
      }
      // Delete tiers that were removed (only if no donations reference them)
      for (const existing of existingTiers) {
        if (!incomingIds.has(existing.id)) {
          const donationCount = await prisma.donation.count({ where: { tierId: existing.id } });
          if (donationCount === 0) {
            await prisma.campaignTier.delete({ where: { id: existing.id } });
          }
        }
      }
    }

    // Sync EVENT items: upsert provided, soft-delete removed
    if (items !== undefined && existing.campaignType === 'EVENT') {
      const existingItems = await prisma.campaignItem.findMany({ where: { campaignId: id } });
      const existingIds = new Set(existingItems.map(i => i.id));
      const incomingIds = new Set(items.filter(i => i.id).map(i => i.id!));

      for (const [i, item] of items.entries()) {
        if (item.id && existingIds.has(item.id)) {
          await prisma.campaignItem.update({
            where: { id: item.id },
            data: {
              name: item.name, description: item.description ?? null, category: item.category ?? null,
              price: item.price, maxQuantity: item.maxQuantity ?? null,
              minPerOrder: item.minPerOrder ?? 0, maxPerOrder: item.maxPerOrder ?? null,
              isRequired: item.isRequired ?? false, sortOrder: item.sortOrder ?? i,
            },
          });
        } else {
          await prisma.campaignItem.create({
            data: {
              campaignId: id, name: item.name, description: item.description ?? null,
              category: item.category ?? null, price: item.price, maxQuantity: item.maxQuantity ?? null,
              minPerOrder: item.minPerOrder ?? 0, maxPerOrder: item.maxPerOrder ?? null,
              isRequired: item.isRequired ?? false, sortOrder: item.sortOrder ?? i,
            },
          });
        }
      }
      // Soft-delete items that were removed (preserve FK references)
      for (const existing of existingItems) {
        if (!incomingIds.has(existing.id)) {
          await prisma.campaignItem.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
        }
      }
    }

    // Re-fetch with tiers + items for response
    const result = await prisma.campaign.findUnique({
      where: { id },
      include: {
        tiers: { orderBy: { sortOrder: 'asc' } },
        items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({
      ...result,
      targetAmount: result?.targetAmount ? Number(result.targetAmount) : null,
      unitPrice: result?.unitPrice ? Number(result.unitPrice) : null,
      tiers: (result as any)?.tiers?.map((t: any) => ({ ...t, amount: Number(t.amount) })) || [],
      items: (result as any)?.items?.map((i: any) => ({ ...i, price: Number(i.price) })) || [],
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
