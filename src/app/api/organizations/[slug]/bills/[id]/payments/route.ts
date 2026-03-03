import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { recordPayment, linkPayment } from '@/services/bill-payment.service';
import { recalculateBillStatus } from '@/services/bill.service';
import { syncDonationFromBill } from '@/services/donation.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const dateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date' }
);

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  transactionDate: dateString,
  cashAccountId: z.string().uuid(),
  description: z.string().optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const linkPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: billId } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();

    // Determine if this is a "record payment" (creates transaction) or "link payment" (uses existing)
    if (body.transactionId) {
      const validated = linkPaymentSchema.parse(body);
      const billPayment = await linkPayment(
        {
          billId,
          transactionId: validated.transactionId,
          notes: validated.notes ?? null,
        },
        ctx.orgId
      );
      return NextResponse.json(billPayment, { status: 201 });
    }

    const validated = recordPaymentSchema.parse(body);

    // Verify cash account belongs to this organization
    const cashAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id: validated.cashAccountId, organizationId: ctx.orgId }),
    });

    if (!cashAccount) {
      return NextResponse.json({ error: 'Invalid account selection' }, { status: 400 });
    }

    const billPayment = await prisma.$transaction(async (tx) => {
      const payment = await recordPayment({
        billId,
        organizationId: ctx.orgId,
        amount: validated.amount,
        transactionDate: new Date(validated.transactionDate.length === 10 ? validated.transactionDate + 'T12:00:00' : validated.transactionDate),
        cashAccountId: validated.cashAccountId,
        description: validated.description,
        referenceNumber: validated.referenceNumber ?? null,
        notes: validated.notes ?? null,
        createdBy: ctx.userId,
      }, tx);

      // Recalculate bill status within the same transaction
      await recalculateBillStatus(billId, tx);

      // Sync linked donation status (no-op if bill has no donation)
      await syncDonationFromBill(billId, tx);

      return payment;
    });

    return NextResponse.json(billPayment, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error recording payment:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Cannot') || error.message.includes('exceeds')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
