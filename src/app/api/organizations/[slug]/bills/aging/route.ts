import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/organizations/[slug]/bills/aging
 * Returns aging summary for payables and receivables
 * Buckets: Current (not yet due), 1-30, 31-60, 61-90, 90+ days past due
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const now = new Date();

    // Fetch all open bills (PENDING, PARTIAL, OVERDUE)
    const openBills = await prisma.bill.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      select: {
        id: true,
        direction: true,
        amount: true,
        amountPaid: true,
        dueDate: true,
        contactId: true,
        contact: { select: { name: true } },
        billNumber: true,
        description: true,
      },
    });

    const aging = {
      payables: createAgingBuckets(),
      receivables: createAgingBuckets(),
    };

    for (const bill of openBills) {
      const remaining = parseFloat(bill.amount.toString()) - parseFloat(bill.amountPaid.toString());
      if (remaining <= 0) continue;

      const bucket = bill.direction === 'PAYABLE' ? aging.payables : aging.receivables;
      const daysOverdue = bill.dueDate
        ? Math.max(0, Math.floor((now.getTime() - new Date(bill.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const category = !bill.dueDate || daysOverdue === 0
        ? 'current'
        : daysOverdue <= 30
          ? 'days1to30'
          : daysOverdue <= 60
            ? 'days31to60'
            : daysOverdue <= 90
              ? 'days61to90'
              : 'days90plus';

      bucket[category].amount += remaining;
      bucket[category].count += 1;
      bucket.total.amount += remaining;
      bucket.total.count += 1;
    }

    return NextResponse.json({ aging });
  } catch (error) {
    console.error('Error fetching aging summary:', error);
    return NextResponse.json({ error: 'Failed to fetch aging summary' }, { status: 500 });
  }
}

function createAgingBuckets() {
  return {
    current: { amount: 0, count: 0 },
    days1to30: { amount: 0, count: 0 },
    days31to60: { amount: 0, count: 0 },
    days61to90: { amount: 0, count: 0 },
    days90plus: { amount: 0, count: 0 },
    total: { amount: 0, count: 0 },
  };
}
