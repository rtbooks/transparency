import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { editTransaction } from '@/services/transaction.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const editTransactionSchema = z.object({
  transactionDate: z.string().datetime().optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  debitAccountId: z.string().uuid().optional(),
  creditAccountId: z.string().uuid().optional(),
  referenceNumber: z.string().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  changeReason: z.string().min(1, 'A reason for the change is required'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    // Parse and validate body
    const body = await request.json();
    const validatedData = editTransactionSchema.parse(body);

    // If changing accounts, verify they exist and belong to org
    if (validatedData.debitAccountId) {
      const account = await prisma.account.findFirst({ where: buildCurrentVersionWhere({ id: validatedData.debitAccountId }) });
      if (!account || account.organizationId !== ctx.orgId) {
        return NextResponse.json({ error: 'Invalid debit account' }, { status: 400 });
      }
    }
    if (validatedData.creditAccountId) {
      const account = await prisma.account.findFirst({ where: buildCurrentVersionWhere({ id: validatedData.creditAccountId }) });
      if (!account || account.organizationId !== ctx.orgId) {
        return NextResponse.json({ error: 'Invalid credit account' }, { status: 400 });
      }
    }

    // Block edits to reconciled transactions
    const existingTxn = await prisma.transaction.findFirst({
      where: buildCurrentVersionWhere({ id, organizationId: ctx.orgId }),
    });
    if (existingTxn?.reconciled) {
      return NextResponse.json({ error: 'Cannot edit a reconciled transaction' }, { status: 400 });
    }

    // Call the service
    const updated = await editTransaction(id, ctx.orgId, validatedData, ctx.userId);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error editing transaction:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Transaction not found or already voided') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    if (includeHistory) {
      // Return all versions
      const { getTransactionHistory } = await import('@/services/transaction.service');
      const history = await getTransactionHistory(id, ctx.orgId);
      return NextResponse.json({ transaction: history[0], history });
    }

    // Return current version only
    const { MAX_DATE } = await import('@/lib/temporal/temporal-utils');
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        organizationId: ctx.orgId,
        validTo: MAX_DATE,
        isDeleted: false,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error fetching transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
