import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const updateSchema = z.object({
  bankName: z.string().min(1).max(200).optional(),
  accountNumberLast4: z.string().min(4).max(4).optional(),
  accountType: z.enum(['checking', 'savings']).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/organizations/[slug]/bank-accounts/[id]
 * Update a bank account.
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

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/bank-accounts/[id]
 * Deactivate a bank account (soft delete).
 */
export async function DELETE(
  request: NextRequest,
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
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    await prisma.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
