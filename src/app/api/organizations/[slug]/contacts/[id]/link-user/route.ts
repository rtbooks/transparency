import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { linkContactToUser, unlinkContactFromUser } from '@/services/contact.service';
import { z } from 'zod';

const linkSchema = z.object({
  userId: z.string().uuid('Must provide a valid user ID'),
});

/**
 * POST /api/organizations/[slug]/contacts/[id]/link-user
 * Link a contact to a platform user. ORG_ADMIN only.
 */
export async function POST(
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

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = linkSchema.parse(body);

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const updated = await linkContactToUser(
      organization.id,
      id,
      validated.userId,
      user.id
    );

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes('already linked')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error linking contact to user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/contacts/[id]/link-user
 * Unlink a contact from its platform user. ORG_ADMIN only.
 */
export async function DELETE(
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
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updated = await unlinkContactFromUser(organization.id, id, user.id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error unlinking contact from user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
