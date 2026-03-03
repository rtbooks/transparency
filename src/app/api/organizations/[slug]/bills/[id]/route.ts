import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { getBill, updateBill, cancelBill } from '@/services/bill.service';
import { z } from 'zod';

const updateBillSchema = z.object({
  description: z.string().min(1).nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  fundingAccountId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    const bill = await getBill(id, ctx.orgId);

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const validated = updateBillSchema.parse(body);

    // Handle cancel as a special case
    if (validated.status === 'CANCELLED') {
      const cancelled = await cancelBill(id, ctx.orgId, ctx.userId);
      return NextResponse.json(cancelled);
    }

    const updates: any = { ...validated };
    if (validated.issueDate !== undefined) {
      updates.issueDate = validated.issueDate ? new Date(validated.issueDate) : null;
    }
    if (validated.dueDate !== undefined) {
      updates.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    }

    const updated = await updateBill(id, ctx.orgId, updates);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
