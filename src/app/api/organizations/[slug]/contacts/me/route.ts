import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getContactForUser } from '@/services/contact.service';

/**
 * GET /api/organizations/[slug]/contacts/me
 * Returns the current user's linked contact in this organization, or 404.
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

    if (!contact) {
      return NextResponse.json({ error: 'No linked contact' }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error fetching user contact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
