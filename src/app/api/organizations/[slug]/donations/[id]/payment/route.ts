import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { recordDonationPayment } from '@/services/donation.service';
import { recordPayment } from '@/services/bill-payment.service';
import { recalculateBillStatus } from '@/services/bill.service';
import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().positive(),
  transactionDate: z.string(),
  cashAccountId: z.string().uuid(),
  description: z.string().optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentMethod: z.string().optional(),
});

/**
 * POST /api/organizations/[slug]/donations/[id]/payment
 * Record a payment received against a pledge donation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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

    // Admin-only for recording payments
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const isAdmin = user.isPlatformAdmin || orgUsers[0]?.role === 'ORG_ADMIN';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can record donation payments' }, { status: 403 });
    }

    const donation = await prisma.donation.findFirst({
      where: { id, organizationId: organization.id },
    });

    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    }

    if (donation.type !== 'PLEDGE') {
      return NextResponse.json({ error: 'Only pledge donations accept payments' }, { status: 400 });
    }

    if (!donation.billId) {
      return NextResponse.json({ error: 'Donation has no linked bill for payment tracking' }, { status: 400 });
    }

    const body = await request.json();
    const validated = paymentSchema.parse(body);

    // Record the bill payment (creates transaction + updates bill status)
    const billPayment = await recordPayment({
      billId: donation.billId,
      organizationId: organization.id,
      amount: validated.amount,
      transactionDate: new Date(validated.transactionDate.length === 10 ? validated.transactionDate + 'T12:00:00' : validated.transactionDate),
      cashAccountId: validated.cashAccountId,
      description: validated.description,
      referenceNumber: validated.referenceNumber,
      notes: validated.notes,
      createdBy: user.id,
      paymentMethod: validated.paymentMethod,
    });

    // Recalculate bill status (amountPaid, status) from linked transactions
    await recalculateBillStatus(donation.billId);

    // Update the donation's received amount and status
    await recordDonationPayment(id, organization.id, validated.amount);

    return NextResponse.json(billPayment, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('exceeds') || error?.message?.includes('Cannot record')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error recording donation payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
