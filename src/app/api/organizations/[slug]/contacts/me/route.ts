import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getContactForUser, linkContactToUser } from '@/services/contact.service';

/**
 * GET /api/organizations/[slug]/contacts/me
 * Returns the current user's linked contact in this organization, or 404.
 * Also returns unlinked contacts matching the user's email as `claimable`.
 */
export async function GET(
  _request: NextRequest,
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

    // Verify membership
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });

    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const contact = await getContactForUser(organization.id, user.id);

    if (contact) {
      return NextResponse.json(contact);
    }

    // No linked contact — look for claimable contacts matching user's email
    const claimable = user.email
      ? await prisma.contact.findMany({
          where: buildCurrentVersionWhere({
            organizationId: organization.id,
            email: { equals: user.email, mode: 'insensitive' },
            userId: null,
          }),
          select: { id: true, name: true, email: true, roles: true, type: true },
        })
      : [];

    return NextResponse.json(
      { error: 'No linked contact', claimable },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching user contact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/contacts/me
 * Claim an unlinked contact by ID. The contact's email must match the user's email.
 */
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

    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const contactId = body.contactId;

    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    // Verify the contact exists, is unlinked, and email matches
    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({
        id: contactId,
        organizationId: organization.id,
        userId: null,
      }),
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found or already linked' }, { status: 404 });
    }

    if (
      !contact.email ||
      !user.email ||
      contact.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Contact email does not match your account email' },
        { status: 403 }
      );
    }

    const linked = await linkContactToUser(
      organization.id,
      contactId,
      user.id,
      user.id
    );

    return NextResponse.json(linked);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already linked')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error claiming contact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
