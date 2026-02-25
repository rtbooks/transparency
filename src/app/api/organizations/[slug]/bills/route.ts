import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createBill, listBills } from '@/services/bill.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const dateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date' }
);

const createBillSchema = z.object({
  contactId: z.string().uuid(),
  direction: z.enum(['PAYABLE', 'RECEIVABLE']),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
  issueDate: dateString,
  dueDate: dateString.nullable().optional(),
  notes: z.string().nullable().optional(),
  liabilityOrAssetAccountId: z.string().uuid(),
  expenseOrRevenueAccountId: z.string().uuid(),
  fundingAccountId: z.string().uuid().nullable().optional(),
  isReimbursement: z.boolean().optional(),
});

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

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const direction = searchParams.get('direction') || undefined;
    const status = searchParams.get('status') || undefined;
    const statusNotIn = searchParams.get('statusNotIn') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await listBills(organization.id, {
      direction,
      status,
      statusNotIn: statusNotIn?.split(','),
      contactId,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      bills: result.bills,
      pagination: {
        page,
        limit,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error listing bills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createBillSchema.parse(body);

    // Verify contact belongs to this organization
    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: validated.contactId, organizationId: organization.id }),
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 400 });
    }

    const bill = await createBill({
      organizationId: organization.id,
      contactId: validated.contactId,
      direction: validated.direction,
      amount: validated.amount,
      description: validated.description || '',
      issueDate: new Date(validated.issueDate),
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      notes: validated.notes ?? null,
      createdBy: user.id,
      liabilityOrAssetAccountId: validated.liabilityOrAssetAccountId,
      expenseOrRevenueAccountId: validated.expenseOrRevenueAccountId,
      isReimbursement: validated.isReimbursement,
    });

    // Set funding account if provided (PAYABLE bills only)
    if (validated.fundingAccountId && validated.direction === 'PAYABLE') {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { fundingAccountId: validated.fundingAccountId },
      });
    }

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
