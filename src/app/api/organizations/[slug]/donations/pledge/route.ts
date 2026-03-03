import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createPledgeDonation } from '@/services/donation.service';
import { findOrCreateForUser } from '@/services/contact.service';
import { z } from 'zod';

const pledgeSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/organizations/[slug]/donations/pledge
 * @deprecated Use POST /api/organizations/[slug]/donations with type: 'PLEDGE'
 * Kept for backward compatibility with existing UI.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug);

    // Fetch org details for account configuration
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch user details for contact creation
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = pledgeSchema.parse(body);

    const contact = await findOrCreateForUser(ctx.orgId, ctx.userId, user.name, user.email);

    const arAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: ctx.orgId,
        type: 'ASSET',
        name: { contains: 'Receivable' },
      }),
    });
    if (!arAccount) {
      return NextResponse.json({ error: 'No Accounts Receivable account configured.' }, { status: 400 });
    }

    let revenueAccount;
    let campaignId: string | null = null;

    if (validated.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: validated.campaignId } });
      if (!campaign || campaign.organizationId !== ctx.orgId || campaign.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 400 });
      }
      campaignId = campaign.id;
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: campaign.accountId, organizationId: ctx.orgId }),
      });
    } else if (organization.donationsAccountId) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: organization.donationsAccountId, organizationId: ctx.orgId }),
      });
    }

    if (!revenueAccount) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ organizationId: ctx.orgId, type: 'REVENUE' }),
      });
    }

    if (!revenueAccount) {
      return NextResponse.json({ error: 'No Revenue account configured.' }, { status: 400 });
    }

    const donation = await createPledgeDonation({
      organizationId: ctx.orgId,
      contactId: contact.id,
      type: 'PLEDGE',
      amount: validated.amount,
      description: validated.description,
      donationDate: new Date(),
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      campaignId,
      arAccountId: arAccount.id,
      revenueAccountId: revenueAccount.id,
      createdBy: ctx.userId,
    });

    return NextResponse.json(donation, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating pledge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
