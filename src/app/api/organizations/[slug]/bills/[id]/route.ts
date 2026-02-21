import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getBill, updateBill, cancelBill } from '@/services/bill.service';
import { z } from 'zod';

const updateBillSchema = z.object({
  description: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
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

    const bill = await getBill(id, organization.id);

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error getting bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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
    const validated = updateBillSchema.parse(body);

    // Handle cancel as a special case
    if (validated.status === 'CANCELLED') {
      const cancelled = await cancelBill(id, organization.id);
      return NextResponse.json(cancelled);
    }

    const updates: any = { ...validated };
    if (validated.dueDate !== undefined) {
      updates.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    }

    const updated = await updateBill(id, organization.id, updates);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating bill:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Bill not found') {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      }
      if (error.message.startsWith('Invalid status transition') || error.message.startsWith('Cannot cancel')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
