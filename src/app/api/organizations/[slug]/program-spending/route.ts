import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { createProgramSpending, findProgramSpendingByOrganization, findProgramSpendingByStatus } from '@/services/program-spending.service';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  estimatedAmount: z.number().positive(),
  targetDate: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    let items;
    if (status) {
      items = await findProgramSpendingByStatus(ctx.orgId, status as 'PLANNED' | 'PURCHASED' | 'CANCELLED');
    } else {
      items = await findProgramSpendingByOrganization(ctx.orgId);
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      );
    }

    // Get linked transaction totals for each item
    const itemIds = items.map((i) => i.id);
    const totals = await prisma.programSpendingTransaction.groupBy({
      by: ['programSpendingId'],
      where: { programSpendingId: { in: itemIds } },
      _sum: { amount: true },
      _count: true,
    });

    const totalMap = new Map(totals.map((t) => [t.programSpendingId, {
      actualTotal: Number(t._sum.amount || 0),
      transactionCount: t._count,
    }]));

    const result = items.map((item) => ({
      ...item,
      estimatedAmount: Number(item.estimatedAmount),
      actualTotal: totalMap.get(item.id)?.actualTotal || 0,
      transactionCount: totalMap.get(item.id)?.transactionCount || 0,
    }));

    return NextResponse.json({ items: result });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error listing program spending:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const validated = createSchema.parse(body);

    const item = await createProgramSpending({
      organizationId: ctx.orgId,
      title: validated.title,
      description: validated.description,
      estimatedAmount: validated.estimatedAmount as unknown as Prisma.Decimal,
      targetDate: validated.targetDate ? new Date(validated.targetDate) : null,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json({
      ...item,
      estimatedAmount: Number(item.estimatedAmount),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error creating program spending:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
