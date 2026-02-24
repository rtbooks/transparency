import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

    // Find the donation
    const donation = await prisma.donation.findFirst({
      where: { id, organizationId: organization.id },
    });

    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    }

    // Verify ownership: the donation's contact must belong to this user
    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: donation.contactId, userId: user.id }),
    });

    // Allow admins to also modify donations
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const isAdmin = user.isPlatformAdmin || orgUsers[0]?.role === 'ORG_ADMIN';

    if (!contact && !isAdmin) {
      return NextResponse.json({ error: 'You can only modify your own donations' }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateDonationSchema.parse(body);

    if (validated.cancel) {
      const cancelled = await cancelDonation(id, organization.id, user.id);
      return NextResponse.json(cancelled);
    }

    const updates: any = {};
    if (validated.amount !== undefined) updates.amount = validated.amount;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.donorMessage !== undefined) updates.donorMessage = validated.donorMessage;
    if (validated.dueDate !== undefined) updates.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;

    const updated = await updateDonation(id, organization.id, updates);
    return NextResponse.json(updated);
  } catch (error: any) {
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
