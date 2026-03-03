import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { findProgramSpendingById, linkTransaction } from '@/services/program-spending.service';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const linkSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.union([z.number(), z.string().transform(Number)]).pipe(z.number().positive()),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const links = await prisma.programSpendingTransaction.findMany({
      where: { programSpendingId: id },
      orderBy: { linkedAt: 'desc' },
    });

    // Resolve transaction details
    const transactions = await Promise.all(
      links.map(async (link) => {
        const tx = await prisma.transaction.findFirst({
          where: buildCurrentVersionWhere({ id: link.transactionId }),
          select: {
            id: true,
            description: true,
            amount: true,
            transactionDate: true,
            type: true,
          },
        });
        return {
          linkId: link.id,
          transactionId: link.transactionId,
          amount: Number(link.amount),
          linkedAt: link.linkedAt,
          transaction: tx ? {
            ...tx,
            amount: Number(tx.amount),
          } : null,
        };
      })
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error listing linked transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = linkSchema.parse(body);

    // Verify transaction belongs to this org
    const tx = await prisma.transaction.findFirst({
      where: buildCurrentVersionWhere({ id: validated.transactionId, organizationId: ctx.orgId }),
    });
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 400 });
    }

    // Prevent linking a transaction already linked to another spending item
    const existingLink = await prisma.programSpendingTransaction.findFirst({
      where: { transactionId: validated.transactionId },
    });
    if (existingLink && existingLink.programSpendingId !== id) {
      return NextResponse.json(
        { error: 'This transaction is already linked to another program spending item' },
        { status: 409 }
      );
    }

    // Look up account types to determine sign
    const [debitAcct, creditAcct] = await Promise.all([
      prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: tx.debitAccountId }),
        select: { type: true },
      }),
      prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: tx.creditAccountId }),
        select: { type: true },
      }),
    ]);

    // Determine signed amount: debit to expense = positive (spending),
    // credit to expense = negative (refund/reduction)
    let signedAmount = validated.amount;
    if (debitAcct?.type === 'EXPENSE' && creditAcct?.type !== 'EXPENSE') {
      signedAmount = Math.abs(validated.amount);
    } else if (creditAcct?.type === 'EXPENSE' && debitAcct?.type !== 'EXPENSE') {
      signedAmount = -Math.abs(validated.amount);
    }
    // If both sides are expense accounts (transfer between), keep positive

    const link = await linkTransaction(
      id,
      validated.transactionId,
      signedAmount as unknown as Prisma.Decimal,
      ctx.userId
    );

    return NextResponse.json({
      ...link,
      amount: Number(link.amount),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error linking transaction:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
