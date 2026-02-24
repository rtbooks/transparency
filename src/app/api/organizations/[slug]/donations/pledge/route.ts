import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = pledgeSchema.parse(body);

    const contact = await findOrCreateForUser(organization.id, user.id, user.name, user.email);

    const arAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
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
      if (!campaign || campaign.organizationId !== organization.id || campaign.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 400 });
      }
      campaignId = campaign.id;
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: campaign.accountId, organizationId: organization.id }),
      });
    } else if (organization.donationsAccountId) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: organization.donationsAccountId, organizationId: organization.id }),
      });
    }

    if (!revenueAccount) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'REVENUE' }),
      });
    }

    if (!revenueAccount) {
      return NextResponse.json({ error: 'No Revenue account configured.' }, { status: 400 });
    }

    const donation = await createPledgeDonation({
      organizationId: organization.id,
      contactId: contact.id,
      type: 'PLEDGE',
      amount: validated.amount,
      description: validated.description,
      donationDate: new Date(),
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      campaignId,
      arAccountId: arAccount.id,
      revenueAccountId: revenueAccount.id,
      createdBy: user.id,
    });

    return NextResponse.json(donation, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating pledge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
