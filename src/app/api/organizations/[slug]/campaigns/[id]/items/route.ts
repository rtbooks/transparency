import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { addCampaignItem, updateCampaignItem, deleteCampaignItem } from '@/services/campaign.service';

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  price: z.number().positive(),
  maxQuantity: z.number().int().positive().nullable().optional(),
  minPerOrder: z.number().int().min(0).optional(),
  maxPerOrder: z.number().int().positive().nullable().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateItemSchema = itemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * GET /api/organizations/[slug]/campaigns/[id]/items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { id } = await params;
    const items = await prisma.campaignItem.findMany({
      where: { campaignId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(items.map(i => ({ ...i, price: Number(i.price) })));
  } catch (error) {
    console.error('Error listing campaign items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/campaigns/[id]/items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.campaignType !== 'EVENT') {
      return NextResponse.json({ error: 'Items can only be added to EVENT campaigns' }, { status: 400 });
    }

    const body = await request.json();
    const validated = itemSchema.parse(body);
    const item = await addCampaignItem(id, validated);

    return NextResponse.json({ ...item, price: Number(item.price) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating campaign item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/organizations/[slug]/campaigns/[id]/items
 * Body must include `itemId` to identify which item to update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const { itemId, ...updates } = body;
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    // Verify item belongs to this campaign
    const existing = await prisma.campaignItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.campaignId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const validated = updateItemSchema.parse(updates);
    const item = await updateCampaignItem(itemId, validated);

    return NextResponse.json({ ...item, price: Number(item.price) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating campaign item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/campaigns/[id]/items
 * Body must include `itemId`.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const { itemId } = body;
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const existing = await prisma.campaignItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.campaignId !== id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await deleteCampaignItem(itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error deleting campaign item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
