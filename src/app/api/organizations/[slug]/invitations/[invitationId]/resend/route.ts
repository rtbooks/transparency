import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sendInvitationEmail } from '@/lib/email/send-invitation';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{
    slug: string;
    invitationId: string;
  }>;
}

// POST /api/organizations/[slug]/invitations/[invitationId]/resend - Resend an invitation
export async function POST(
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
      select: {
        id: true,
        name: true,
        isPlatformAdmin: true,
      },
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

    // Platform admins or ORG_ADMIN can resend invitations
    const canResend = user.isPlatformAdmin || (userAccess && userAccess.role === 'ORG_ADMIN');
    
    if (!canResend) {
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

    // Generate new token and extend expiration
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

    // Update invitation with new token and expiration
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${newToken}`;

    // Send invitation email (await to ensure it completes before serverless freeze)
    const emailSent = await sendInvitationEmail({
      to: invitation.email,
      inviterName: user.name || 'A team member',
      organizationName: organization.name,
      role: invitation.role,
      inviteUrl,
      expiresInDays: 7,
    });
    if (!emailSent) {
      console.warn('[Invitation] Resend email failed for', invitation.email);
    }

    return NextResponse.json({
      message: 'Invitation resent successfully',
      invitation: updatedInvitation,
      inviteUrl,
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
