import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasRole } from '@/lib/auth/permissions';
import crypto from 'crypto';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['DONOR', 'ORG_ADMIN']),
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
    const organization = await prisma.organization.findUnique({
      where: { slug },
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
      include: {
        organizations: {
          where: { organizationId: organization.id },
        },
      },
    });

    if (!user || user.organizations.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const currentUserRole = user.organizations[0].role;

    // Only ORG_ADMIN and PLATFORM_ADMIN can invite users
    if (!hasRole(currentUserRole, 'ORG_ADMIN')) {
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
      include: {
        organizations: {
          where: { organizationId: organization.id },
        },
      },
    });

    if (existingUser && existingUser.organizations.length > 0) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
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

    // TODO: Send email with invitation link
    // For now, we'll just return the invitation
    // In production, integrate with an email service (SendGrid, Resend, etc.)

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        inviteUrl, // In production, this would be sent via email
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
    const organization = await prisma.organization.findUnique({
      where: { slug },
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
      include: {
        organizations: {
          where: { organizationId: organization.id },
        },
      },
    });

    if (!user || user.organizations.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const currentUserRole = user.organizations[0].role;

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
