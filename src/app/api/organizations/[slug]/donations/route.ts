import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { listDonations, getMyDonations, createPledgeDonation, createOneTimeDonation } from '@/services/donation.service';
import { findOrCreateForUser } from '@/services/contact.service';
import { z } from 'zod';

const createDonationSchema = z.object({
  type: z.enum(['ONE_TIME', 'PLEDGE']),
  amount: z.number().positive(),
  description: z.string().optional(),
  donorMessage: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  unitCount: z.number().int().positive().nullable().optional(),
  tierId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/organizations/[slug]/donations
 * Returns donations for the org. Supports ?view=all for org-wide view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

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
    const orgUser = orgUsers[0];

    if (!orgUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isAdmin = user.isPlatformAdmin || orgUser.role === 'ORG_ADMIN';

    // Find the user's contact record(s) in this organization
    const userContacts = await prisma.contact.findMany({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    const userContactIds = userContacts.map(c => c.id);

    const { searchParams } = new URL(request.url);
    const viewAll = searchParams.get('view') === 'all';

    let donations;
    if (viewAll) {
      // Org-wide view: all donations
      donations = await listDonations(organization.id);
    } else {
      // Personal view: only current user's donations
      donations = await getMyDonations(organization.id, userContactIds);
    }

    const totalPledged = donations.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalReceived = donations.reduce((sum, d) => sum + Number(d.amountReceived), 0);

    return NextResponse.json({
      donations,
      // Legacy field name for backward compat with existing UI
      pledges: donations,
      summary: {
        totalPledged,
        totalPaid: totalReceived,
        outstanding: totalPledged - totalReceived,
      },
      isAdmin,
      userContactIds,
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/donations
 * Create a new donation (one-time or pledge).
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

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify membership
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });

    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createDonationSchema.parse(body);

    // Find or create donor's contact record
    const contact = await findOrCreateForUser(
      organization.id,
      user.id,
      user.name,
      user.email
    );

    // Find Accounts Receivable account — prefer org-configured, then auto-detect
    let arAccount;
    if (organization.donationsArAccountId) {
      arAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          id: organization.donationsArAccountId,
          organizationId: organization.id,
          isActive: true,
        }),
      });
    }
    if (!arAccount) {
      arAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          organizationId: organization.id,
          type: 'ASSET',
          name: { contains: 'Receivable' },
          isActive: true,
        }),
      });
    }

    if (!arAccount) {
      return NextResponse.json(
        { error: 'Organization has no Accounts Receivable account configured.' },
        { status: 400 }
      );
    }

    // Find a Revenue account — campaign-directed or fallback
    let revenueAccount;
    let campaignId: string | null = null;

    if (validated.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
      });
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
        where: buildCurrentVersionWhere({
          organizationId: organization.id,
          type: 'REVENUE',
          name: { contains: 'Donation' },
        }),
      });
    }

    if (!revenueAccount) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          organizationId: organization.id,
          type: 'REVENUE',
        }),
      });
    }

    if (!revenueAccount) {
      return NextResponse.json(
        { error: 'Organization has no Revenue account configured.' },
        { status: 400 }
      );
    }

    // For one-time donations, find a cash/bank account
    let cashAccountId: string | undefined;
    if (validated.type === 'ONE_TIME') {
      const cashAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          organizationId: organization.id,
          type: 'ASSET',
          name: { contains: 'Cash' },
          isActive: true,
        }),
      });
      if (!cashAccount) {
        return NextResponse.json(
          { error: 'Organization has no Cash account configured for receiving donations.' },
          { status: 400 }
        );
      }
      cashAccountId = cashAccount.id;
    }

    // Default dueDate to 1 week from now for pledges when not specified
    let dueDate: Date | null = null;
    if (validated.dueDate) {
      dueDate = new Date(validated.dueDate.length === 10 ? validated.dueDate + 'T12:00:00' : validated.dueDate);
    } else if (validated.type === 'PLEDGE') {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
    }

    const input = {
      organizationId: organization.id,
      contactId: contact.id,
      type: validated.type as 'ONE_TIME' | 'PLEDGE',
      amount: validated.amount,
      description: validated.description,
      donorMessage: validated.donorMessage,
      isAnonymous: validated.isAnonymous,
      donationDate: new Date(),
      dueDate,
      campaignId,
      unitCount: validated.unitCount ?? undefined,
      tierId: validated.tierId ?? undefined,
      arAccountId: arAccount.id,
      revenueAccountId: revenueAccount.id,
      cashAccountId,
      createdBy: user.id,
    };

    const donation = validated.type === 'PLEDGE'
      ? await createPledgeDonation(input)
      : await createOneTimeDonation(input);

    return NextResponse.json(donation, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating donation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
