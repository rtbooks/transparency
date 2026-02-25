import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';
import { sendCampaignInviteEmail } from '@/lib/email/send-campaign-invite';

const inviteSchema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional(),
});

/**
 * POST /api/organizations/[slug]/campaigns/[id]/invite
 * Send a campaign donation invite email. Requires auth + org membership.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: campaignId } = await params;
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

    // Verify user is a member
    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUser && !user.isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify campaign exists and belongs to the org
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = inviteSchema.parse(body);

    // Build the donate URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'));
    const donateUrl = `${baseUrl}/org/${slug}/donate/${campaignId}`;

    const senderName = user.name || user.email || 'A supporter';

    await sendCampaignInviteEmail({
      to: validated.email,
      senderName,
      organizationName: organization.name,
      campaignName: campaign.name,
      campaignDescription: campaign.description,
      personalMessage: validated.message,
      donateUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error sending campaign invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
