import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { voidTransaction } from '@/services/transaction.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const voidTransactionSchema = z.object({
  voidReason: z.string().min(1, 'A reason for voiding is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const validatedData = voidTransactionSchema.parse(body);

    // Block voiding reconciled transactions
    const existingTxn = await prisma.transaction.findFirst({
      where: buildCurrentVersionWhere({ id, organizationId: ctx.orgId }),
    });
    if (existingTxn?.reconciled) {
      return NextResponse.json({ error: 'Cannot void a reconciled transaction' }, { status: 400 });
    }

    const voided = await voidTransaction(id, ctx.orgId, validatedData, ctx.userId);
    return NextResponse.json(voided);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error voiding transaction:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Transaction not found or already voided') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
