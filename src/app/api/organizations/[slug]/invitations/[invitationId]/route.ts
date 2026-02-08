import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    slug: string;
    invitationId: string;
  }>;
}

// DELETE /api/organizations/[slug]/invitations/[invitationId] - Revoke an invitation
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { slug, invitationId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find organization
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: {
          where: { userId: user.id },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const userAccess = organization.organizationUsers[0];

    // Only ORG_ADMIN and PLATFORM_ADMIN can revoke invitations
    if (
      !userAccess ||
      (userAccess.role !== 'ORG_ADMIN' && userAccess.role !== 'PLATFORM_ADMIN')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the invitation belongs to this organization
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update invitation status to REVOKED
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Invitation revoked successfully',
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
