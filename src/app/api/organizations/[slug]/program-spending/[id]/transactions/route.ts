import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== organization.id) {
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
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = linkSchema.parse(body);

    // Verify transaction belongs to this org
    const tx = await prisma.transaction.findFirst({
      where: buildCurrentVersionWhere({ id: validated.transactionId, organizationId: organization.id }),
    });
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 400 });
    }

    const link = await linkTransaction(
      id,
      validated.transactionId,
      validated.amount as unknown as Prisma.Decimal,
      user.id
    );

    return NextResponse.json({
      ...link,
      amount: Number(link.amount),
    }, { status: 201 });
  } catch (error) {
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
