import { NextRequest, NextResponse } from 'next/server';
import { withPlatformAuth } from '@/lib/auth/with-platform-auth';
import { AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { updateDonation, cancelDonation } from '@/services/donation.service';
import { z } from 'zod';

const updateDonationSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  donorMessage: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  cancel: z.boolean().optional(),
});

/**
 * PATCH /api/organizations/[slug]/donations/[id]
 * Update or cancel a donation. Validates ownership (donor can modify own, admin can modify any).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withPlatformAuth(slug);

    // Find the donation
    const donation = await prisma.donation.findFirst({
      where: { id, organizationId: ctx.orgId },
    });

    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    }

    // Verify ownership: the donation's contact must belong to this user
    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: donation.contactId, userId: ctx.userId }),
    });

    // Allow admins to also modify donations
    const isAdmin = ctx.isPlatformAdmin || ctx.orgRole === 'ORG_ADMIN';

    if (!contact && !isAdmin) {
      return NextResponse.json({ error: 'You can only modify your own donations' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateDonationSchema.parse(body);

    if (validated.cancel) {
      const cancelled = await cancelDonation(id, ctx.orgId, ctx.userId, isAdmin);
      return NextResponse.json(cancelled);
    }

    const updates: any = { isAdmin };
    if (validated.amount !== undefined) updates.amount = validated.amount;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.donorMessage !== undefined) updates.donorMessage = validated.donorMessage;
    if (validated.dueDate !== undefined) updates.dueDate = validated.dueDate ? new Date(validated.dueDate.length === 10 ? validated.dueDate + 'T12:00:00' : validated.dueDate) : null;

    const updated = await updateDonation(id, ctx.orgId, updates);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('Cannot modify') || error?.message?.includes('Cannot cancel')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating donation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
