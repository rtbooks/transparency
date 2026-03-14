import { NextRequest, NextResponse } from 'next/server';
import { withPlatformAuth, type PlatformAuthContext } from '@/lib/auth/with-platform-auth';
import { AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
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
  lineItems: z.array(z.object({
    campaignItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional(),
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
    const ctx = await withPlatformAuth(slug);

    const isAdmin = ctx.isPlatformAdmin || ctx.orgRole === 'ORG_ADMIN';
    const isMember = ctx.orgRole !== null;

    // Find the user's contact record(s) in this organization
    const userContacts = await prisma.contact.findMany({
      where: buildCurrentVersionWhere({
        organizationId: ctx.orgId,
        userId: ctx.userId,
      }),
    });
    const userContactIds = userContacts.map(c => c.id);

    const { searchParams } = new URL(request.url);
    const viewAll = searchParams.get('view') === 'all';

    let donations;
    if (viewAll && isMember) {
      // Org-wide view: all donations (members and admins only)
      donations = await listDonations(ctx.orgId);
    } else {
      // Personal view: only current user's donations
      donations = await getMyDonations(ctx.orgId, userContactIds);
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
    if (error instanceof AuthError) return authErrorResponse(error);
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
    const ctx = await withPlatformAuth(slug);
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
    const validated = createDonationSchema.parse(body);

    // Find or create donor's contact record
    const contact = await findOrCreateForUser(
      ctx.orgId,
      ctx.userId,
      user.name,
      user.email
    );

    // Find Accounts Receivable account — prefer org-configured, then auto-detect
    let arAccount;
    if (organization.donationsArAccountId) {
      arAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          id: organization.donationsArAccountId,
          organizationId: ctx.orgId,
          isActive: true,
        }),
      });
    }
    if (!arAccount) {
      arAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          organizationId: ctx.orgId,
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
        where: buildCurrentVersionWhere({
          organizationId: ctx.orgId,
          type: 'REVENUE',
          name: { contains: 'Donation' },
        }),
      });
    }

    if (!revenueAccount) {
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          organizationId: ctx.orgId,
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
          organizationId: ctx.orgId,
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
      organizationId: ctx.orgId,
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
      lineItems: validated.lineItems ?? undefined,
      arAccountId: arAccount.id,
      revenueAccountId: revenueAccount.id,
      cashAccountId,
      createdBy: ctx.userId,
    };

    const donation = validated.type === 'PLEDGE'
      ? await createPledgeDonation(input)
      : await createOneTimeDonation(input);

    return NextResponse.json(donation, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating donation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
