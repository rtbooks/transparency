import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { MAX_DATE } from '@/lib/temporal/temporal-utils';

/**
 * GET /api/organizations/[slug]/contacts/[id]/transactions
 * Returns transactions linked to a specific contact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findFirst({
      where: { slug, isDeleted: false },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where = {
      organizationId: organization.id,
      contactId: id,
      isVoided: false,
      systemTo: MAX_DATE,
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          debitAccount: { select: { id: true, code: true, name: true, type: true } },
          creditAccount: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching contact transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch contact transactions' }, { status: 500 });
  }
}
