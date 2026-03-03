import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData, MAX_DATE } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';

const updatePledgeSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  cancel: z.boolean().optional(),
});

/**
 * PATCH /api/organizations/[slug]/donations/pledge/[id]
 * Allows pledge owners to modify or cancel their own unpaid pledges.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    // Find the bill/pledge
    const bill = await prisma.bill.findFirst({
      where: { id, organizationId: ctx.orgId, direction: 'RECEIVABLE' },
      include: { payments: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });
    }

    // Verify ownership: the pledge's contact must belong to this user
    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: bill.contactId, userId: ctx.userId }),
    });

    // Allow admins to also modify pledges
    const isAdmin = ctx.isPlatformAdmin || ctx.role === 'ORG_ADMIN';

    if (!contact && !isAdmin) {
      return NextResponse.json({ error: 'You can only modify your own pledges' }, { status: 403 });
    }

    // Cannot modify paid or cancelled pledges
    if (bill.status === 'PAID' || bill.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot modify a pledge that is ${bill.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Cannot modify pledges that have received payments
    if (bill.payments.length > 0 || Number(bill.amountPaid) > 0) {
      return NextResponse.json(
        { error: 'Cannot modify a pledge that has received payments. Contact the organization admin for assistance.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updatePledgeSchema.parse(body);

    // Handle cancellation
    if (validated.cancel) {
      const cancelled = await prisma.$transaction(async (tx) => {
        const updated = await tx.bill.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        // Reverse the accrual transaction if it exists
        if (bill.accrualTransactionId) {
          const accrualTx = await tx.transaction.findFirst({
            where: buildCurrentVersionWhere({ id: bill.accrualTransactionId }),
          });
          if (accrualTx) {
            const now = new Date();
            await tx.transaction.updateMany({
              where: { versionId: accrualTx.versionId, systemTo: MAX_DATE },
              data: { validTo: now, systemTo: now, isDeleted: true, deletedAt: now, deletedBy: ctx.userId },
            });
          }
        }

        return updated;
      });

      return NextResponse.json(cancelled);
    }

    // Handle updates
    const result = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};

      if (validated.description !== undefined) {
        data.description = validated.description;
      }
      if (validated.dueDate !== undefined) {
        data.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
      }
      if (validated.amount !== undefined) {
        data.amount = validated.amount as unknown as Prisma.Decimal;

        // Also update the accrual transaction to keep accounting consistent
        if (bill.accrualTransactionId) {
          const accrualTx = await tx.transaction.findFirst({
            where: buildCurrentVersionWhere({ id: bill.accrualTransactionId }),
          });
          if (accrualTx) {
            const now = new Date();
            await closeVersion(tx.transaction, accrualTx.versionId, now, 'transaction');
            await tx.transaction.create({
              data: buildNewVersionData(accrualTx, { amount: validated.amount as unknown as Prisma.Decimal } as any, now) as any,
            });
          }
        }
      }

      if (Object.keys(data).length === 0) {
        return bill;
      }

      return await tx.bill.update({
        where: { id },
        data,
      });
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating pledge:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'The pledge or its linked transaction could not be found. It may have been modified or deleted.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
