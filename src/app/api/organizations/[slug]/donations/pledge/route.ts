import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createBill } from '@/services/bill.service';
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
 * Self-serve pledge creation by donors. Auto-resolves AR/Revenue accounts
 * and creates/links a contact record for the donor.
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
    const validated = pledgeSchema.parse(body);

    // Find or create donor's contact record
    const contact = await findOrCreateForUser(
      organization.id,
      user.id,
      user.name,
      user.email
    );

    // Find Accounts Receivable account
    const arAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        type: 'ASSET',
        name: { contains: 'Receivable' },
      }),
    });

    if (!arAccount) {
      return NextResponse.json(
        { error: 'Organization has no Accounts Receivable account configured. Please contact the organization admin.' },
        { status: 400 }
      );
    }

    // Find a Revenue account — campaign-directed or fallback
    let revenueAccount;

    if (validated.campaignId) {
      // Donor selected a specific campaign — use its linked account
      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
      });
      if (!campaign || campaign.organizationId !== organization.id || campaign.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 400 });
      }
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: campaign.accountId, organizationId: organization.id }),
      });
      if (!revenueAccount) {
        return NextResponse.json({ error: 'Campaign account not found' }, { status: 400 });
      }
    } else if (organization.donationsAccountId) {
      // No campaign selected — use the org's donations account (general donation)
      revenueAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: organization.donationsAccountId, organizationId: organization.id }),
      });
    }

    // Fallback: auto-search for a Revenue account
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
        { error: 'Organization has no Revenue account configured. Please contact the organization admin.' },
        { status: 400 }
      );
    }

    const bill = await createBill({
      organizationId: organization.id,
      contactId: contact.id,
      direction: 'RECEIVABLE',
      amount: validated.amount,
      description: validated.description,
      issueDate: new Date(),
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      createdBy: user.id,
      liabilityOrAssetAccountId: arAccount.id,
      expenseOrRevenueAccountId: revenueAccount.id,
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error creating pledge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
