import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';
import { hasRole } from '@/lib/auth/permissions';
import { sendInvitationEmail } from '@/lib/email/send-invitation';
import crypto from 'crypto';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['SUPPORTER', 'ORG_ADMIN']),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;

    // Find the organization
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Find the current user and their role
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      select: {
        id: true,
        name: true,
        isPlatformAdmin: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userOrgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const currentUserRole = userOrgUsers[0]?.role;

    // Platform admins or ORG_ADMIN can invite users
    const canInvite = user.isPlatformAdmin || (currentUserRole && hasRole(currentUserRole, 'ORG_ADMIN'));
    
    if (!canInvite) {
      return NextResponse.json(
        { error: 'Only organization admins can invite users' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, role } = inviteSchema.parse(body);

    // Check if user already exists in the organization
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingOrgUsers = await prisma.organizationUser.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id, userId: existingUser.id }),
      });
      if (existingOrgUsers.length > 0) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        );
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email,
        },
      },
    });

    if (existingInvitation) {
      if (existingInvitation.status === 'PENDING') {
        return NextResponse.json(
          { error: 'An invitation has already been sent to this email' },
          { status: 400 }
        );
      }
      
      // Delete old invitation (ACCEPTED, REVOKED, or EXPIRED) to allow new one
      await prisma.invitation.delete({
        where: { id: existingInvitation.id },
      });
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: organization.id,
        email,
        role,
        token,
        invitedById: user.id,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${token}`;

    // Send invitation email (await to ensure it completes before serverless freeze)
    const emailSent = await sendInvitationEmail({
      to: email,
      inviterName: user.name || 'A team member',
      organizationName: organization.name,
      role,
      inviteUrl,
      expiresInDays: 7,
      organizationLogoUrl: organization.logoUrl
        ? `${baseUrl}/api/organizations/${slug}/logo`
        : undefined,
    });
    if (!emailSent) {
      console.warn('[Invitation] Email failed to send for', email);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - List invitations for an organization
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;

    // Find the organization
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Verify user has permission
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userOrgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });

    if (userOrgUsers.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const currentUserRole = userOrgUsers[0].role;

    if (!hasRole(currentUserRole, 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch invitations
    const invitations = await prisma.invitation.findMany({
      where: { organizationId: organization.id },
      include: {
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
