import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import {
  findProgramSpendingById,
  updateProgramSpending,
  updateSpendingStatus,
  deleteProgramSpending,
  getLinkedTransactions,
} from '@/services/program-spending.service';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  estimatedAmount: z.number().positive().optional(),
  targetDate: z.string().nullable().optional(),
  status: z.enum(['PLANNED', 'PURCHASED', 'CANCELLED']).optional(),
});

async function getAuthContext(slug: string) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { error: 'Unauthorized', status: 401 };

  const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
  if (!user) return { error: 'User not found', status: 404 };

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
  if (!organization) return { error: 'Organization not found', status: 404 };

  const orgUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
  });
  if (!orgUsers[0]) return { error: 'Access denied', status: 403 };

  return { user, organization, orgUser: orgUsers[0] };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await getAuthContext(slug);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const linkedTxs = await getLinkedTransactions(id);

    // Resolve transaction details for each linked transaction
    const transactionDetails = await Promise.all(
      linkedTxs.map(async (link) => {
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
          ...link,
          amount: Number(link.amount),
          transaction: tx ? {
            ...tx,
            amount: Number(tx.amount),
          } : null,
        };
      })
    );

    const actualTotal = transactionDetails.reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({
      ...item,
      estimatedAmount: Number(item.estimatedAmount),
      actualTotal,
      linkedTransactions: transactionDetails,
    });
  } catch (error) {
    console.error('Error getting program spending:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await getAuthContext(slug);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    if (ctx.orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Handle status change separately (may set completedAt)
    if (validated.status && validated.status !== item.status) {
      const updated = await updateSpendingStatus(id, validated.status, ctx.user.id);
      return NextResponse.json({
        ...updated,
        estimatedAmount: Number(updated.estimatedAmount),
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.estimatedAmount !== undefined) updateData.estimatedAmount = validated.estimatedAmount as unknown as Prisma.Decimal;
    if (validated.targetDate !== undefined) updateData.targetDate = validated.targetDate ? new Date(validated.targetDate) : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        ...item,
        estimatedAmount: Number(item.estimatedAmount),
      });
    }

    const updated = await updateProgramSpending(id, updateData, ctx.user.id);
    return NextResponse.json({
      ...updated,
      estimatedAmount: Number(updated.estimatedAmount),
    });
  } catch (error) {
    console.error('Error updating program spending:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await getAuthContext(slug);
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    if (ctx.orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteProgramSpending(id, ctx.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting program spending:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
