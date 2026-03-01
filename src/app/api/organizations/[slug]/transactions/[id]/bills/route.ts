import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

/**
 * GET /api/organizations/[slug]/transactions/[id]/bills
 * Returns bills linked to a transaction via BillPayment or accrualTransactionId.
 */
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

    // Find bills linked via BillPayment
    const billPayments = await prisma.billPayment.findMany({
      where: { transactionId: id },
      include: { bill: true },
    });

    // Find bills where this transaction is the accrual transaction
    const accrualBills = await prisma.bill.findMany({
      where: {
        accrualTransactionId: id,
        organizationId: organization.id,
      },
    });

    // Combine and deduplicate
    const billMap = new Map<string, { id: string; billId: string; description: string; direction: string; status: string }>();

    for (const bp of billPayments) {
      if (bp.bill && bp.bill.organizationId === organization.id) {
        billMap.set(bp.bill.id, {
          id: bp.id,
          billId: bp.bill.id,
          description: bp.bill.description,
          direction: bp.bill.direction,
          status: bp.bill.status,
        });
      }
    }

    for (const bill of accrualBills) {
      if (!billMap.has(bill.id)) {
        billMap.set(bill.id, {
          id: `accrual-${bill.id}`,
          billId: bill.id,
          description: bill.description,
          direction: bill.direction,
          status: bill.status,
        });
      }
    }

    return NextResponse.json({ bills: Array.from(billMap.values()) });
  } catch (error) {
    console.error('Error fetching linked bills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
