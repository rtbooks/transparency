import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createBill } from '@/services/bill.service';
import { z } from 'zod';

const pledgeSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().nullable().optional(),
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
    let contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          type: 'INDIVIDUAL',
          roles: ['DONOR'],
          versionId: crypto.randomUUID(),
          validFrom: new Date(),
          validTo: new Date('9999-12-31T23:59:59.999Z'),
          systemFrom: new Date(),
          systemTo: new Date('9999-12-31T23:59:59.999Z'),
        },
      });
    }

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

    // Find a Revenue account (prefer Donation Revenue)
    let revenueAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        type: 'REVENUE',
        name: { contains: 'Donation' },
      }),
    });

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
