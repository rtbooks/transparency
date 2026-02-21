import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createBill, listBills } from '@/services/bill.service';
import { z } from 'zod';

const createBillSchema = z.object({
  contactId: z.string().uuid(),
  billNumber: z.string().nullable().optional(),
  direction: z.enum(['PAYABLE', 'RECEIVABLE']),
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().nullable().optional(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
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

    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: { where: { userId: user.id } },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!organization.organizationUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const direction = searchParams.get('direction') || undefined;
    const status = searchParams.get('status') || undefined;
    const contactId = searchParams.get('contactId') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await listBills(organization.id, {
      direction,
      status,
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

    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: { where: { userId: user.id } },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = organization.organizationUsers[0];
    if (!orgUser || orgUser.role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createBillSchema.parse(body);

    // Verify contact belongs to this organization
    const contact = await prisma.contact.findFirst({
      where: { id: validated.contactId, organizationId: organization.id },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 400 });
    }

    const bill = await createBill({
      organizationId: organization.id,
      contactId: validated.contactId,
      billNumber: validated.billNumber ?? null,
      direction: validated.direction,
      amount: validated.amount,
      description: validated.description,
      category: validated.category ?? null,
      issueDate: new Date(validated.issueDate),
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      notes: validated.notes ?? null,
      createdBy: user.id,
    });

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
